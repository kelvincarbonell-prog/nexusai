import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { buildRemesaPain001 } from "@/lib/laboral/sepa/remesa-pain001";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  fecha_ejecucion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  formato: z.enum(["xml", "json"]).default("xml"),
});

/**
 * Genera la remesa SEPA pain.001 para pagar todas las nóminas del periodo
 * en un solo fichero que se sube al banco.
 */
export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const { data: empresa } = await admin
    .from("empresas")
    .select("nombre,nif,iban,metadata")
    .eq("id", parsed.data.empresa_id)
    .maybeSingle();
  if (!empresa) return jsonError("Empresa no encontrada", 404);
  if (!empresa.iban) return jsonError("La empresa no tiene IBAN configurado. Añádelo en datos fiscales antes de generar la remesa.");
  if (!empresa.nif) return jsonError("La empresa no tiene NIF configurado.");

  const { data: nominas } = await admin
    .from("nominas")
    .select("id,trabajador_id,total,metadata")
    .eq("empresa_id", parsed.data.empresa_id)
    .eq("periodo", parsed.data.periodo);
  if (!nominas || nominas.length === 0) return jsonError(`Sin nóminas para el periodo ${parsed.data.periodo}`);

  // Carga trabajadores con IBAN para conocer el destinatario
  const trabIds = nominas.map((n) => n.trabajador_id).filter(Boolean) as string[];
  const { data: trabajadores } = await admin
    .from("trabajadores")
    .select("id,nombre,apellidos,dni,iban")
    .in("id", trabIds);
  const trabMap = new Map((trabajadores ?? []).map((t) => [t.id, t]));

  const beneficiarios: Array<{ nombre: string; nif?: string; iban: string; importe: number; concepto: string; ref: string }> = [];
  const errores: string[] = [];
  for (const n of nominas) {
    const t = n.trabajador_id ? trabMap.get(n.trabajador_id) : null;
    if (!t) { errores.push(`Nómina ${n.id} sin trabajador`); continue; }
    if (!t.iban) { errores.push(`${t.nombre} sin IBAN configurado`); continue; }
    const meta = (n.metadata ?? {}) as Record<string, number | undefined>;
    const liquido = Number(meta.liquido ?? n.total ?? 0);
    if (liquido <= 0) { errores.push(`${t.nombre} líquido inválido`); continue; }
    beneficiarios.push({
      nombre: t.apellidos ? `${t.apellidos}, ${t.nombre}` : t.nombre,
      nif: t.dni ?? undefined,
      iban: t.iban,
      importe: liquido,
      concepto: `Nomina ${parsed.data.periodo}`,
      ref: n.id,
    });
  }

  if (beneficiarios.length === 0) {
    return NextResponse.json({ ok: false, error: "Ninguna nómina con datos para remesar", errores }, { status: 400 });
  }

  try {
    const result = buildRemesaPain001({
      ordenante: { nombre: empresa.nombre ?? empresa.nif, nif: empresa.nif, iban: empresa.iban },
      fecha_ejecucion: parsed.data.fecha_ejecucion,
      beneficiarios,
      motivo: `Nominas ${parsed.data.periodo}`,
    });

    if (parsed.data.formato === "json") {
      return NextResponse.json({
        ok: true,
        message_id: result.message_id,
        total_importe: result.total_importe,
        total_lineas: result.total_lineas,
        omitidas: errores.length,
        errores,
      });
    }

    const filename = `remesa-${parsed.data.periodo}-${empresa.nif}.xml`;
    return new NextResponse(result.xml, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: unknown) {
    return jsonError(e instanceof Error ? e.message : "No se pudo generar la remesa", 500);
  }
}
