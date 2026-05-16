import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { calcularBonificaciones } from "@/lib/laboral/payroll/bonificaciones";

const Schema = z.object({
  trabajador_id: z.string().uuid(),
  parado_larga_duracion: z.boolean().optional(),
  primer_empleo_joven: z.boolean().optional(),
  victima_violencia: z.boolean().optional(),
  zona_rural_despoblada: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  const { data: trabajador } = await admin.from("trabajadores").select("*").eq("id", parsed.data.trabajador_id).single();
  if (!trabajador) return jsonError("Trabajador no encontrado", 404);
  if (!(await canAccessLaborCompany(admin, user.id, trabajador.empresa_id))) return jsonError("Sin acceso", 403);

  const meta = (trabajador.metadata ?? {}) as Record<string, unknown>;
  const edad = trabajador.fecha_nacimiento
    ? Math.floor((Date.now() - new Date(trabajador.fecha_nacimiento + "T00:00:00").getTime()) / (365.25 * 86_400_000))
    : 30;

  const bonis = calcularBonificaciones({
    edad,
    fecha_alta: trabajador.fecha_alta ?? new Date().toISOString().slice(0, 10),
    tipo_contrato: trabajador.tipo_contrato ?? "indefinido",
    discapacidad_pct: meta.discapacidad_pct as number | undefined,
    victima_violencia: parsed.data.victima_violencia ?? (meta.victima_violencia === true),
    parado_larga_duracion: parsed.data.parado_larga_duracion ?? false,
    primer_empleo_joven: parsed.data.primer_empleo_joven ?? false,
    zona_rural_despoblada: parsed.data.zona_rural_despoblada ?? false,
  });

  const totalAnual = bonis.reduce((s, b) => s + b.importe_anual, 0);

  return NextResponse.json({ ok: true, bonificaciones: bonis, total_anual: totalAnual });
}
