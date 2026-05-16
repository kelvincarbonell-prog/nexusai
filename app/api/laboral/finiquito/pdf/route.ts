import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { calcularFiniquito } from "@/lib/laboral/payroll/finiquito";
import { generateFiniquitoPDF } from "@/lib/laboral/pdf/finiquito";

const Schema = z.object({
  trabajador_id: z.string().uuid(),
  fecha_baja: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  causa: z.enum(["despido_improcedente", "despido_objetivo", "fin_contrato", "dimision", "mutuo_acuerdo", "jubilacion"]),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  const { data: trabajador } = await admin.from("trabajadores").select("*").eq("id", parsed.data.trabajador_id).single();
  if (!trabajador) return jsonError("Trabajador no encontrado", 404);
  if (!(await isGestorOrAdmin(admin, user.id, trabajador.empresa_id))) return jsonError("Sin permiso", 403);
  if (!trabajador.fecha_alta) return jsonError("El trabajador no tiene fecha de alta", 400);
  if (!trabajador.salario_bruto_anual) return jsonError("El trabajador no tiene salario", 400);

  const { data: empresa } = await admin.from("empresas").select("nombre,nif,metadata").eq("id", trabajador.empresa_id).single();
  if (!empresa) return jsonError("Empresa no encontrada", 404);

  const result = calcularFiniquito({
    salario_bruto_anual: Number(trabajador.salario_bruto_anual),
    fecha_alta: trabajador.fecha_alta,
    fecha_baja: parsed.data.fecha_baja,
    causa: parsed.data.causa,
    irpf_pct: trabajador.irpf_pct ? Number(trabajador.irpf_pct) : undefined,
  });

  const meta = (empresa.metadata ?? {}) as Record<string, unknown>;
  const trabMeta = (trabajador.metadata ?? {}) as Record<string, unknown>;

  const bytes = await generateFiniquitoPDF({
    empresa: { nombre: empresa.nombre, nif: empresa.nif ?? "—", direccion: meta.cliente_direccion as string | undefined },
    trabajador: {
      nombre: trabajador.nombre,
      dni: trabajador.dni ?? "—",
      nss: trabajador.nss ?? undefined,
      puesto: trabMeta.puesto as string | undefined,
      fecha_alta: trabajador.fecha_alta,
    },
    fecha_baja: parsed.data.fecha_baja,
    causa: parsed.data.causa,
    result,
  });

  return new NextResponse(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="finiquito-${trabajador.dni ?? trabajador.id.slice(0, 8)}.pdf"`,
    },
  });
}
