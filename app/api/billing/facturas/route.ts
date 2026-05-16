import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany, isGestorOrAdmin } from "@/lib/laboral/access";

const Linea = z.object({
  descripcion: z.string().min(1).max(500),
  cantidad: z.number().min(0).default(1),
  precio_unitario: z.number().min(0),
  iva_pct: z.number().min(0).max(50).default(21),
  descuento_pct: z.number().min(0).max(100).default(0),
});

const Create = z.object({
  empresa_id: z.string().uuid(),
  tipo: z.enum(["emitida", "recibida", "simplificada"]).default("emitida"),
  contacto_nombre: z.string().min(1).max(180),
  contacto_nif: z.string().max(30).optional(),
  contacto_email: z.string().email().optional(),
  fecha_emision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha_vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  lineas: z.array(Linea).min(1).max(50),
  irpf_pct: z.number().min(0).max(50).default(0),
  notas: z.string().max(2000).optional(),
  estado: z.enum(["borrador", "emitida", "enviada", "pagada"]).default("borrador"),
});

function nextNumero(serie: string, ultimoNumero: number): string {
  return `${serie || "FAC"}-${String(ultimoNumero + 1).padStart(4, "0")}`;
}

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  const tipo = request.nextUrl.searchParams.get("tipo");
  if (!empresaId) return jsonError("Falta empresa_id");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);

  let q = admin
    .from("facturas")
    .select("id,numero,tipo,contacto_nombre,fecha_emision,fecha_vencimiento,base,iva,total,estado,payment_status,payment_link_url,metadata,created_at")
    .eq("empresa_id", empresaId)
    .order("fecha_emision", { ascending: false, nullsFirst: false })
    .limit(200);
  if (tipo) q = q.eq("tipo", tipo);
  const { data, error } = await q;
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  // Calcular totales
  let base = 0;
  let ivaTotal = 0;
  for (const l of parsed.data.lineas) {
    const sub = l.cantidad * l.precio_unitario * (1 - l.descuento_pct / 100);
    base += sub;
    ivaTotal += (sub * l.iva_pct) / 100;
  }
  base = Math.round(base * 100) / 100;
  ivaTotal = Math.round(ivaTotal * 100) / 100;
  const retencion = Math.round((base * parsed.data.irpf_pct / 100) * 100) / 100;
  const total = Math.round((base + ivaTotal - retencion) * 100) / 100;

  // Generar siguiente número usando la serie de la empresa
  const { data: empresa } = await admin
    .from("empresas")
    .select("metadata")
    .eq("id", parsed.data.empresa_id)
    .single();
  const empresaMeta = (empresa?.metadata ?? {}) as Record<string, unknown>;
  const serie = (empresaMeta.serie as string | undefined) ?? "FAC";

  const { data: lastFactura } = await admin
    .from("facturas")
    .select("numero")
    .eq("empresa_id", parsed.data.empresa_id)
    .eq("tipo", parsed.data.tipo)
    .ilike("numero", `${serie}-%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let ultimoNumero = (empresaMeta.numero_inicial as number | undefined) ?? 0;
  if (lastFactura?.numero) {
    const match = /-(\d+)$/.exec(lastFactura.numero);
    if (match) ultimoNumero = Math.max(ultimoNumero, Number(match[1]));
  }
  const numero = nextNumero(serie, ultimoNumero);

  const { data, error } = await admin
    .from("facturas")
    .insert({
      empresa_id: parsed.data.empresa_id,
      gestor_id: user.id,
      tipo: parsed.data.tipo,
      numero,
      contacto_nombre: parsed.data.contacto_nombre,
      fecha_emision: parsed.data.fecha_emision ?? new Date().toISOString().slice(0, 10),
      fecha_vencimiento: parsed.data.fecha_vencimiento ?? null,
      base,
      iva: ivaTotal,
      total,
      estado: parsed.data.estado,
      metadata: {
        contacto_nif: parsed.data.contacto_nif,
        contacto_email: parsed.data.contacto_email,
        lineas: parsed.data.lineas,
        irpf_pct: parsed.data.irpf_pct,
        retencion,
        notas: parsed.data.notas,
      },
    })
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo crear", 500);
  return NextResponse.json({ ok: true, factura: data });
}
