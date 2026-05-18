import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

/**
 * Detecta si una factura o gasto que el usuario está a punto de crear
 * podría ser un duplicado de uno ya registrado.
 *
 * Heurística:
 *   - Mismo proveedor + total + fecha (±3 días) → MUY probable
 *   - Mismo NIF emisor + total exacto + fecha (±15 días) → probable
 *   - Mismo total + nº factura → cierto
 */

const Schema = z.object({
  empresa_id: z.string().uuid(),
  tipo: z.enum(["factura", "gasto"]),
  proveedor: z.string().max(180).optional(),
  proveedor_nif: z.string().max(20).optional(),
  numero: z.string().max(60).optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total: z.number().min(0),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const fechaInicio = new Date(parsed.data.fecha + "T00:00:00");
  const fechaMin = new Date(fechaInicio.getTime() - 15 * 86_400_000).toISOString().slice(0, 10);
  const fechaMax = new Date(fechaInicio.getTime() + 15 * 86_400_000).toISOString().slice(0, 10);
  const totalMin = parsed.data.total * 0.99;
  const totalMax = parsed.data.total * 1.01;

  type Match = { id: string; descripcion: string; fecha: string; total: number; razon: string; confianza: number };
  const matches: Match[] = [];

  if (parsed.data.tipo === "gasto") {
    const { data } = await admin
      .from("gastos")
      .select("id,proveedor,fecha,total,metadata,concepto")
      .eq("empresa_id", parsed.data.empresa_id)
      .gte("fecha", fechaMin)
      .lte("fecha", fechaMax)
      .gte("total", totalMin)
      .lte("total", totalMax);
    for (const g of data ?? []) {
      const sameProv = parsed.data.proveedor && g.proveedor && g.proveedor.toLowerCase().includes(parsed.data.proveedor.toLowerCase().slice(0, 8));
      const sameNif = parsed.data.proveedor_nif && (g.metadata as Record<string, unknown> | null)?.proveedor_nif === parsed.data.proveedor_nif.toUpperCase();
      const sameTotal = Math.abs(Number(g.total) - parsed.data.total) < 0.5;
      const diasDif = Math.abs((new Date(g.fecha + "T00:00:00").getTime() - fechaInicio.getTime()) / 86_400_000);
      let confianza = 0;
      const razones: string[] = [];
      if (sameTotal) { confianza += 30; razones.push("mismo importe"); }
      if (sameProv) { confianza += 30; razones.push("mismo proveedor"); }
      if (sameNif) { confianza += 35; razones.push("mismo NIF"); }
      if (diasDif <= 3) { confianza += 20; razones.push(`fecha cercana (${Math.round(diasDif)}d)`); }
      if (confianza >= 60) {
        matches.push({
          id: g.id,
          descripcion: `${g.proveedor ?? "—"} · ${g.concepto ?? ""}`.slice(0, 80),
          fecha: g.fecha,
          total: Number(g.total),
          razon: razones.join(" · "),
          confianza,
        });
      }
    }
  } else {
    const { data } = await admin
      .from("facturas")
      .select("id,numero,serie,contacto_nombre,contacto_nif,fecha_emision,total")
      .eq("empresa_id", parsed.data.empresa_id)
      .gte("fecha_emision", fechaMin)
      .lte("fecha_emision", fechaMax)
      .gte("total", totalMin)
      .lte("total", totalMax);
    for (const f of data ?? []) {
      const sameNum = parsed.data.numero && f.numero && parsed.data.numero === f.numero;
      const sameTotal = Math.abs(Number(f.total) - parsed.data.total) < 0.5;
      const sameContacto = parsed.data.proveedor && f.contacto_nombre && f.contacto_nombre.toLowerCase().includes(parsed.data.proveedor.toLowerCase().slice(0, 8));
      const sameNif = parsed.data.proveedor_nif && f.contacto_nif === parsed.data.proveedor_nif.toUpperCase();
      let confianza = 0;
      const razones: string[] = [];
      if (sameNum) { confianza += 60; razones.push("mismo nº factura"); }
      if (sameTotal) { confianza += 25; razones.push("mismo importe"); }
      if (sameContacto) { confianza += 20; razones.push("mismo cliente"); }
      if (sameNif) { confianza += 25; razones.push("mismo NIF"); }
      if (confianza >= 60) {
        matches.push({
          id: f.id,
          descripcion: `${f.serie ?? ""}${f.numero ?? ""} · ${f.contacto_nombre ?? "—"}`,
          fecha: f.fecha_emision ?? "",
          total: Number(f.total),
          razon: razones.join(" · "),
          confianza,
        });
      }
    }
  }

  matches.sort((a, b) => b.confianza - a.confianza);
  return NextResponse.json({
    ok: true,
    posibles_duplicados: matches.slice(0, 5),
    es_duplicado_probable: matches.length > 0 && matches[0].confianza >= 80,
  });
}
