import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { generateContratoPDF, type ContratoModalidad } from "@/lib/laboral/pdf/contrato";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;

  const admin = createSupabaseAdmin();
  const { data: contrato } = await admin
    .from("contratos_laborales")
    .select("*")
    .eq("id", id)
    .single();
  if (!contrato) return jsonError("Contrato no encontrado", 404);
  if (!(await canAccessLaborCompany(admin, user.id, contrato.empresa_id))) return jsonError("Sin acceso", 403);

  const [{ data: trabajador }, { data: empresa }] = await Promise.all([
    admin.from("trabajadores").select("nombre,dni,nss,fecha_nacimiento,metadata").eq("id", contrato.trabajador_id).single(),
    admin.from("empresas").select("nombre,nif,metadata").eq("id", contrato.empresa_id).single(),
  ]);
  if (!trabajador || !empresa) return jsonError("Datos faltantes", 404);

  const empresaMeta = (empresa.metadata ?? {}) as Record<string, unknown>;
  const trabMeta = (trabajador.metadata ?? {}) as Record<string, unknown>;

  const modalidadMap: Record<string, ContratoModalidad> = {
    indefinido: "indefinido",
    temporal: "temporal",
    "obra y servicio": "obra_servicio",
    obra_servicio: "obra_servicio",
    practicas: "practicas",
    "practicas profesionales": "practicas",
    formacion: "formacion",
    formativo: "formacion",
    "fijo discontinuo": "fijo_discontinuo",
    fijo_discontinuo: "fijo_discontinuo",
  };

  const modalidad = modalidadMap[(contrato.tipo_contrato ?? "").toLowerCase()] ?? "indefinido";

  const bytes = await generateContratoPDF({
    modalidad,
    empresa: {
      nombre: empresa.nombre,
      nif: empresa.nif ?? "—",
      direccion: empresaMeta.cliente_direccion as string | undefined,
      nombre_representante: empresaMeta.representante_nombre as string | undefined,
      cif_representante: empresaMeta.representante_dni as string | undefined,
    },
    trabajador: {
      nombre: trabajador.nombre ?? "",
      dni: trabajador.dni ?? "—",
      nss: trabajador.nss ?? undefined,
      fecha_nacimiento: trabajador.fecha_nacimiento ?? undefined,
      direccion: trabMeta.direccion as string | undefined,
    },
    puesto: trabMeta.puesto as string | undefined ?? "Trabajador/a",
    categoria_profesional: contrato.categoria ?? undefined,
    convenio: contrato.convenio ?? undefined,
    fecha_inicio: contrato.fecha_inicio,
    fecha_fin: contrato.fecha_fin ?? undefined,
    jornada_horas: Number(contrato.jornada_horas ?? 40),
    salario_bruto_anual: Number(contrato.salario_bruto_anual ?? 0),
    centro_trabajo: empresaMeta.cliente_direccion as string | undefined,
  });

  return new NextResponse(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="contrato-${contrato.id.slice(0, 8)}.pdf"`,
    },
  });
}
