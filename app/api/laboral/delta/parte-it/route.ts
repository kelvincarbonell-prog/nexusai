import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { generarParteITXML, validarParteIT } from "@/lib/laboral/delta/parte-it";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  trabajador_id: z.string().uuid(),
  tipo: z.enum(["baja", "alta", "confirmacion"]),
  contingencia: z.enum(["cc", "ep", "atrabajo", "atrayecto"]),
  parte: z.object({
    fecha_emision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    fecha_baja: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    fecha_alta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    diagnostico: z.string().max(120).optional(),
    duracion_estimada_dias: z.number().int().min(1).max(540).optional(),
    medico_colegiado: z.string().max(60).optional(),
    centro_medico: z.string().max(180).optional(),
    causa_alta: z.enum(["curacion", "incomparecencia", "fallecimiento", "propuesta_inc_perm", "agotamiento"]).optional(),
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
    admin.from("empresas").select("nif,nombre,ccc").eq("id", parsed.data.empresa_id).maybeSingle(),
    admin
      .from("trabajadores")
      .select("nombre,apellidos,dni,nss,fecha_nacimiento")
      .eq("id", parsed.data.trabajador_id)
      .eq("empresa_id", parsed.data.empresa_id)
      .maybeSingle(),
  ]);
  if (!empresa) return jsonError("Empresa no encontrada", 404);
  if (!trab) return jsonError("Trabajador no encontrado en esta empresa", 404);

  const apellidos = trab.apellidos ?? trab.nombre?.split(" ").slice(1).join(" ") ?? "";
  const nombre = trab.apellidos ? trab.nombre : trab.nombre?.split(" ")[0] ?? "";

  const input = {
    tipo: parsed.data.tipo,
    contingencia: parsed.data.contingencia,
    empresa: {
      nif: empresa.nif ?? "",
      razon_social: empresa.nombre ?? "",
      ccc: empresa.ccc ?? "",
    },
    trabajador: {
      dni: trab.dni ?? "",
      naf: trab.nss ?? "",
      nombre: nombre ?? "",
      apellidos: apellidos ?? "",
      fecha_nacimiento: trab.fecha_nacimiento ?? "",
    },
    parte: parsed.data.parte,
  };

  const errores = validarParteIT(input);
  if (parsed.data.formato === "json") {
    return NextResponse.json({ ok: errores.length === 0, errores, input });
  }
  if (errores.length > 0) {
    return NextResponse.json({ ok: false, error: "Datos incompletos", errores }, { status: 400 });
  }
  const xml = generarParteITXML(input);
  return new NextResponse(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "content-disposition": `attachment; filename="parte-it-${trab.dni}-${parsed.data.parte.fecha_baja}.xml"`,
    },
  });
}
