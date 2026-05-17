import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { generatePayrollPDF } from "@/lib/laboral/payroll/pdf";
import type { ConceptoLinea, NominaResult } from "@/lib/laboral/payroll/calc";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  notificar_por_email: z.boolean().default(true),
});

/**
 * Genera el PDF de cada nómina del periodo, lo sube al Storage en una ruta
 * accesible al trabajador (cuando éste tenga acceso al portal del cliente)
 * y crea una entrada en `documentos` por cada nómina publicada.
 *
 * Resultado:
 *   - publicadas: nº de nóminas con PDF subido y registrado
 *   - omitidas:   ya publicadas (idempotente)
 *   - errores:    fallos puntuales
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
    .select("id,nombre,nif,metadata")
    .eq("id", parsed.data.empresa_id)
    .maybeSingle();
  if (!empresa) return jsonError("Empresa no encontrada", 404);

  const { data: nominas } = await admin
    .from("nominas")
    .select("id,trabajador_id,periodo,metadata")
    .eq("empresa_id", parsed.data.empresa_id)
    .eq("periodo", parsed.data.periodo);

  if (!nominas || nominas.length === 0) {
    return jsonError(`Sin nóminas para el periodo ${parsed.data.periodo}. Genéralas primero.`);
  }

  // Pre-carga trabajadores para inyectar en PDF
  const trabIds = Array.from(new Set(nominas.map((n) => n.trabajador_id).filter(Boolean)));
  const { data: trabajadores } = await admin
    .from("trabajadores")
    .select("id,nombre,apellidos,dni,nss,puesto,email")
    .in("id", trabIds);
  const trabajadorMap = new Map((trabajadores ?? []).map((t) => [t.id, t]));

  // Documentos ya publicados (idempotencia)
  const { data: existentes } = await admin
    .from("documentos")
    .select("id,metadata")
    .eq("empresa_id", parsed.data.empresa_id)
    .eq("tipo", "nomina")
    .filter("metadata->>periodo", "eq", parsed.data.periodo);
  const yaPublicadas = new Set(
    (existentes ?? [])
      .map((d) => {
        const m = (d.metadata ?? {}) as Record<string, unknown>;
        return m.nomina_id as string | undefined;
      })
      .filter(Boolean) as string[],
  );

  let publicadas = 0;
  let omitidas = 0;
  const errores: Array<{ trabajador?: string; error: string }> = [];

  for (const n of nominas) {
    if (yaPublicadas.has(n.id)) {
      omitidas++;
      continue;
    }
    const trab = n.trabajador_id ? trabajadorMap.get(n.trabajador_id) : null;
    const meta = (n.metadata ?? {}) as Partial<NominaResult> & { conceptos?: ConceptoLinea[] };
    if (!meta.conceptos || !meta.devengo_bruto) {
      errores.push({ trabajador: trab?.nombre, error: "Nómina sin desglose. Regenérala." });
      continue;
    }
    const result: NominaResult = {
      devengo_bruto: meta.devengo_bruto ?? 0,
      base_cotizacion_cc: meta.base_cotizacion_cc ?? 0,
      base_cotizacion_atyepy: meta.base_cotizacion_atyepy ?? 0,
      base_irpf: meta.base_irpf ?? 0,
      ss_trabajador: meta.ss_trabajador ?? 0,
      irpf_retenido: meta.irpf_retenido ?? 0,
      total_deducciones: meta.total_deducciones ?? 0,
      liquido: meta.liquido ?? 0,
      ss_empresa: meta.ss_empresa ?? 0,
      conceptos: meta.conceptos ?? [],
      irpf_pct_aplicado: meta.irpf_pct_aplicado ?? 0,
    };

    try {
      const { bytes } = await generatePayrollPDF({
        empresa: {
          nombre: empresa.nombre ?? "",
          nif: empresa.nif ?? "",
          direccion: (empresa.metadata as { direccion?: string } | null)?.direccion,
        },
        trabajador: {
          nombre: trab?.apellidos ? `${trab.apellidos}, ${trab.nombre}` : trab?.nombre ?? "Trabajador/a",
          dni: trab?.dni ?? undefined,
          nss: trab?.nss ?? undefined,
          puesto: trab?.puesto ?? undefined,
        },
        periodo: parsed.data.periodo,
        result,
        generado_en: new Date().toISOString(),
      });

      const path = `${empresa.id}/nominas/${parsed.data.periodo}/${n.id}.pdf`;
      const buf = bytes as unknown as Uint8Array;
      const { error: upErr } = await admin.storage
        .from("documentos")
        .upload(path, buf, { contentType: "application/pdf", upsert: true });
      if (upErr) throw new Error(upErr.message);

      const { error: docErr } = await admin.from("documentos").insert({
        empresa_id: empresa.id,
        gestor_id: user.id,
        tipo: "nomina",
        nombre: `Nómina ${parsed.data.periodo} · ${trab?.nombre ?? "Trabajador"}`,
        storage_path: path,
        estado: "publicado",
        metadata: {
          nomina_id: n.id,
          trabajador_id: n.trabajador_id,
          periodo: parsed.data.periodo,
          liquido: result.liquido,
          generado_en: new Date().toISOString(),
        },
      });
      if (docErr) throw new Error(docErr.message);

      // Notifica al trabajador si tiene cuenta de portal asociada
      if (n.trabajador_id) {
        try {
          await admin.from("notificaciones").insert({
            destinatario_id: n.trabajador_id,
            empresa_id: empresa.id,
            tipo: "documento_subido",
            titulo: `Nómina ${parsed.data.periodo} disponible`,
            detalle: `Tu nómina de ${parsed.data.periodo} ya está en tu portal. Líquido: ${result.liquido.toFixed(2)} €.`,
            url: `/portal?empresa=${empresa.id}&tab=documentos`,
            severidad: "good",
            metadata: { documento_tipo: "nomina", periodo: parsed.data.periodo },
          });
        } catch {
          // Si trabajador_id no apunta a un user válido (FK constraint), ignora silenciosamente.
        }
      }

      publicadas++;
    } catch (e: unknown) {
      errores.push({
        trabajador: trab?.nombre,
        error: e instanceof Error ? e.message : "Error desconocido",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    periodo: parsed.data.periodo,
    publicadas,
    omitidas,
    errores,
    total: nominas.length,
  });
}
