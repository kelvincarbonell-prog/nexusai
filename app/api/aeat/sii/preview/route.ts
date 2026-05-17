import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { buildSiiEnvelope } from "@/lib/aeat/sii/builder";
import { facturaToExpedida, facturaToRecibida } from "@/lib/aeat/sii/mapper";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  tipo: z.enum(["emitidas", "recibidas"]),
  ejercicio: z.number().int().min(2017).max(2100),
  mes: z.string().regex(/^(0[1-9]|1[0-2])$/),
});

/**
 * Genera el sobre SOAP SII (sin firmar) para un mes concreto.
 * Útil para preview/validación antes de enviar a AEAT con certificado.
 */
export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) {
    return jsonError("Solo gestor o admin", 403);
  }

  const { data: empresa } = await admin
    .from("empresas")
    .select("nif,nombre")
    .eq("id", parsed.data.empresa_id)
    .maybeSingle();
  if (!empresa?.nif) return jsonError("La empresa no tiene NIF configurado", 400);

  const from = `${parsed.data.ejercicio}-${parsed.data.mes}-01`;
  const lastDay = new Date(Date.UTC(parsed.data.ejercicio, Number(parsed.data.mes), 0)).getUTCDate();
  const to = `${parsed.data.ejercicio}-${parsed.data.mes}-${String(lastDay).padStart(2, "0")}`;

  const tiposEmitidas = ["emitida", "simplificada", "rectificativa"];
  const { data: facturas } = await admin
    .from("facturas")
    .select("id,numero,serie,tipo,fecha_emision,base,iva,iva_pct,total,contacto_nombre,contacto_nif,descripcion,clave_operacion")
    .eq("empresa_id", parsed.data.empresa_id)
    .gte("fecha_emision", from)
    .lte("fecha_emision", to)
    .in("tipo", parsed.data.tipo === "emitidas" ? tiposEmitidas : ["recibida"]);

  if (!facturas || facturas.length === 0) {
    return jsonError(`Sin facturas ${parsed.data.tipo} del periodo ${parsed.data.mes}/${parsed.data.ejercicio}`);
  }

  const xml = buildSiiEnvelope({
    operacion: "A0",
    titular: { nif: empresa.nif, nombre_razon: empresa.nombre ?? empresa.nif },
    facturas_expedidas:
      parsed.data.tipo === "emitidas"
        ? facturas.map((f) => facturaToExpedida(f, empresa.nif!))
        : undefined,
    facturas_recibidas:
      parsed.data.tipo === "recibidas"
        ? facturas.map((f) => facturaToRecibida(f))
        : undefined,
  });

  return NextResponse.json({
    ok: true,
    n_facturas: facturas.length,
    xml,
    note:
      "Sobre SOAP SII listo. Falta firma XAdES-EPES con certificado digital del titular antes de POST al endpoint AEAT.",
  });
}
