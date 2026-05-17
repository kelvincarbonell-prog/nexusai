import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { generarContrataXML, validarContrata } from "@/lib/laboral/sepe/contrata";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  trabajador_id: z.string().uuid(),
  contrato: z.object({
    tipo: z.string().min(3).max(3),
    fecha_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    fecha_fin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    jornada_horas_semanales: z.number().min(1).max(60),
    jornada_tipo: z.enum(["completa", "parcial"]),
    salario_bruto_anual: z.number().min(0),
    convenio_codigo: z.string().max(40).optional(),
    ocupacion: z.string().max(20).optional(),
    motivo: z.string().max(500).optional(),
    clausulas_especificas: z.array(z.string().max(200)).max(20).optional(),
    bonificaciones: z.array(z.object({ codigo: z.string().max(20), descripcion: z.string().max(200).optional() })).max(20).optional(),
  }),
  formato: z.enum(["xml", "json"]).default("xml"),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const [{ data: empresa }, { data: trab }] = await Promise.all([
    admin.from("empresas").select("nif,nombre,ccc,cnae").eq("id", parsed.data.empresa_id).maybeSingle(),
    admin
      .from("trabajadores")
      .select("nombre,apellidos,dni,nss,fecha_nacimiento,sexo")
      .eq("id", parsed.data.trabajador_id)
      .eq("empresa_id", parsed.data.empresa_id)
      .maybeSingle(),
  ]);
  if (!empresa) return jsonError("Empresa no encontrada", 404);
  if (!trab) return jsonError("Trabajador no encontrado en esta empresa", 404);

  const apellidos = trab.apellidos ?? trab.nombre?.split(" ").slice(1).join(" ") ?? "";
  const nombre = trab.apellidos ? trab.nombre : trab.nombre?.split(" ")[0] ?? "";

  const input = {
    empresa: {
      nif: empresa.nif ?? "",
      razon_social: empresa.nombre ?? "",
      ccc: empresa.ccc ?? "",
      cnae: empresa.cnae ?? undefined,
    },
    trabajador: {
      dni: trab.dni ?? "",
      naf: trab.nss ?? "",
      nombre: nombre ?? "",
      apellidos: apellidos ?? "",
      fecha_nacimiento: trab.fecha_nacimiento ?? "",
      sexo: (trab.sexo === "6" || trab.sexo === "1") ? (trab.sexo as "1" | "6") : ("1" as const),
    },
    contrato: parsed.data.contrato,
  };

  const errores = validarContrata(input);
  if (parsed.data.formato === "json") {
    return NextResponse.json({ ok: errores.length === 0, errores, input });
  }
  if (errores.length > 0) {
    return NextResponse.json({ ok: false, error: "Datos incompletos", errores }, { status: 400 });
  }
  const xml = generarContrataXML(input);
  return new NextResponse(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "content-disposition": `attachment; filename="contrata-${trab.dni}-${parsed.data.contrato.fecha_inicio}.xml"`,
    },
  });
}
