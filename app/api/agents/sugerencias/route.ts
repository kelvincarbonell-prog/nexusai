import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

/**
 * Sugerencias inteligentes basadas en histórico del propio cliente.
 *
 * GET kind=cuenta_pgc       proveedor → cuenta PGC más usada en sus gastos previos
 * GET kind=iban_cliente     contacto_nombre / contacto_nif → último IBAN usado
 * GET kind=iva_proveedor    proveedor → tipo IVA más frecuente
 * GET kind=prevision_iva    ejercicio + trimestre → predicción cierre IVA
 * GET kind=gastos_cesados   empresa → proveedores activos hace 1+ año sin facturas en 6 meses
 */

const Q = z.object({
  empresa_id: z.string().uuid(),
  kind: z.enum(["cuenta_pgc", "iban_cliente", "iva_proveedor", "prevision_iva", "gastos_cesados"]),
  proveedor: z.string().optional(),
  contacto_nombre: z.string().optional(),
  contacto_nif: z.string().optional(),
  ejercicio: z.coerce.number().int().min(2017).max(2100).optional(),
  trimestre: z.enum(["1T", "2T", "3T", "4T"]).optional(),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Q.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const { empresa_id, kind } = parsed.data;

  // 1) Cuenta PGC sugerida para un proveedor
  if (kind === "cuenta_pgc") {
    const prov = (parsed.data.proveedor ?? "").trim();
    if (!prov) return jsonError("Falta proveedor");
    const { data } = await admin
      .from("gastos")
      .select("metadata")
      .eq("empresa_id", empresa_id)
      .ilike("proveedor", `%${prov.slice(0, 12)}%`)
      .limit(20);
    const cuentas = new Map<string, number>();
    for (const g of data ?? []) {
      const meta = (g.metadata ?? {}) as Record<string, unknown>;
      const cc = (meta.cuenta_pgc as string) ?? null;
      if (cc) cuentas.set(cc, (cuentas.get(cc) ?? 0) + 1);
    }
    const top = Array.from(cuentas.entries()).sort((a, b) => b[1] - a[1])[0];
    if (top) return NextResponse.json({ ok: true, sugerencia: top[0], usos: top[1], confianza: Math.min(1, top[1] / 5) });
    return NextResponse.json({ ok: true, sugerencia: null });
  }

  // 2) IBAN del cliente para una factura
  if (kind === "iban_cliente") {
    const nif = (parsed.data.contacto_nif ?? "").trim().toUpperCase();
    const nombre = (parsed.data.contacto_nombre ?? "").trim();
    if (!nif && !nombre) return jsonError("Falta contacto_nif o contacto_nombre");
    // 1) busca en contactos
    if (nif) {
      const { data: c } = await admin.from("contactos").select("iban,nombre").eq("empresa_id", empresa_id).eq("nif", nif).maybeSingle();
      if (c?.iban) return NextResponse.json({ ok: true, sugerencia: c.iban, fuente: "contactos" });
    }
    // 2) busca en facturas previas con mismo cliente
    let qb = admin.from("facturas").select("metadata,contacto_nombre").eq("empresa_id", empresa_id).limit(1).order("created_at", { ascending: false });
    if (nif) qb = qb.eq("contacto_nif", nif);
    else qb = qb.ilike("contacto_nombre", `%${nombre.slice(0, 12)}%`);
    const { data: fs } = await qb;
    const f = (fs ?? [])[0];
    const meta = (f?.metadata ?? {}) as Record<string, unknown>;
    if (meta.iban) return NextResponse.json({ ok: true, sugerencia: meta.iban, fuente: "factura_previa" });
    return NextResponse.json({ ok: true, sugerencia: null });
  }

  // 3) IVA habitual de un proveedor
  if (kind === "iva_proveedor") {
    const prov = (parsed.data.proveedor ?? "").trim();
    if (!prov) return jsonError("Falta proveedor");
    const { data } = await admin
      .from("gastos")
      .select("base,iva")
      .eq("empresa_id", empresa_id)
      .ilike("proveedor", `%${prov.slice(0, 12)}%`)
      .limit(20);
    const tipos = new Map<number, number>();
    for (const g of data ?? []) {
      const b = Number(g.base ?? 0);
      const i = Number(g.iva ?? 0);
      if (b > 0 && i >= 0) {
        const pct = Math.round((i / b) * 100);
        if (pct === 0 || pct === 4 || pct === 10 || pct === 21) {
          tipos.set(pct, (tipos.get(pct) ?? 0) + 1);
        }
      }
    }
    const top = Array.from(tipos.entries()).sort((a, b) => b[1] - a[1])[0];
    if (top) return NextResponse.json({ ok: true, sugerencia: top[0], usos: top[1], confianza: Math.min(1, top[1] / 3) });
    return NextResponse.json({ ok: true, sugerencia: 21, fuente: "default" });
  }

  // 4) Predicción cierre IVA del trimestre actual basado en datos parciales
  if (kind === "prevision_iva") {
    const ej = parsed.data.ejercicio ?? new Date().getUTCFullYear();
    const trim = parsed.data.trimestre ?? `${Math.ceil((new Date().getUTCMonth() + 1) / 3)}T` as "1T" | "2T" | "3T" | "4T";
    const tIdx = Number(trim[0]);
    const startMonth = (tIdx - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    const lastDay = new Date(Date.UTC(ej, endMonth, 0)).getUTCDate();
    const from = `${ej}-${String(startMonth).padStart(2, "0")}-01`;
    const to = `${ej}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const hoy = new Date().toISOString().slice(0, 10);
    const fechaTope = hoy < to ? hoy : to;
    const totalDias = (new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86_400_000 + 1;
    const diasTranscurridos = Math.max(1, (new Date(fechaTope + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86_400_000 + 1);

    const [{ data: emit }, { data: reci }] = await Promise.all([
      admin.from("facturas").select("base,iva").eq("empresa_id", empresa_id).in("tipo", ["emitida", "simplificada"]).gte("fecha_emision", from).lte("fecha_emision", fechaTope),
      admin.from("facturas").select("base,iva").eq("empresa_id", empresa_id).eq("tipo", "recibida").gte("fecha_emision", from).lte("fecha_emision", fechaTope),
    ]);
    const ivaRep = (emit ?? []).reduce((s, f) => s + Number(f.iva ?? 0), 0);
    const ivaSop = (reci ?? []).reduce((s, f) => s + Number(f.iva ?? 0), 0);
    const cuotaParcial = ivaRep - ivaSop;
    const factor = totalDias / diasTranscurridos;
    const cuotaProyectada = cuotaParcial * factor;
    return NextResponse.json({
      ok: true,
      trimestre: trim,
      ejercicio: ej,
      dias_transcurridos: Math.floor(diasTranscurridos),
      dias_totales: Math.floor(totalDias),
      iva_repercutido_parcial: Math.round(ivaRep * 100) / 100,
      iva_soportado_parcial: Math.round(ivaSop * 100) / 100,
      cuota_parcial: Math.round(cuotaParcial * 100) / 100,
      cuota_proyectada: Math.round(cuotaProyectada * 100) / 100,
      confianza: Math.min(1, diasTranscurridos / 30),
    });
  }

  // 5) Gastos cesados: proveedores con historial pero sin actividad reciente
  if (kind === "gastos_cesados") {
    const hace6m = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);
    const hace2a = new Date(Date.now() - 730 * 86_400_000).toISOString().slice(0, 10);
    const { data } = await admin
      .from("gastos")
      .select("proveedor,fecha")
      .eq("empresa_id", empresa_id)
      .gte("fecha", hace2a)
      .order("fecha", { ascending: true })
      .limit(5000);
    const byProv = new Map<string, { primera: string; ultima: string; total: number }>();
    for (const g of data ?? []) {
      const p = (g.proveedor ?? "").trim();
      if (!p) continue;
      const prev = byProv.get(p) ?? { primera: g.fecha, ultima: g.fecha, total: 0 };
      if (g.fecha < prev.primera) prev.primera = g.fecha;
      if (g.fecha > prev.ultima) prev.ultima = g.fecha;
      prev.total += 1;
      byProv.set(p, prev);
    }
    const cesados = Array.from(byProv.entries())
      .filter(([, v]) => v.ultima < hace6m && v.total >= 3)
      .map(([proveedor, v]) => ({ proveedor, ultima_factura: v.ultima, facturas_totales: v.total }))
      .sort((a, b) => a.ultima_factura.localeCompare(b.ultima_factura))
      .slice(0, 20);
    return NextResponse.json({ ok: true, items: cesados });
  }

  return jsonError("kind no reconocido");
}
