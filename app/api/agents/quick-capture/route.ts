import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { confidenceScore, extractInvoiceFromImage } from "@/lib/agents/invoice-extractor";
import { categorizeExpense } from "@/lib/agents/expense-categorizer";
import { checkAgentRateLimit } from "@/lib/agents/rate-limit";

/**
 * Endpoint optimizado para captura rápida desde móvil:
 * 1. Recibe la foto en base64
 * 2. Llama al agente extractor (Vision multi-proveedor)
 * 3. Llama al categorizador de gastos con los datos extraídos
 * 4. Devuelve TODO junto para que el usuario confirme y guarde en un solo tap.
 *
 * El usuario luego decide si crear el gasto, factura o solo descartar.
 */

const Schema = z.object({
  empresa_id: z.string().uuid(),
  mime_type: z.string().max(120).default("image/jpeg"),
  base64: z.string().min(1).max(8_000_000),
  filename: z.string().max(240).optional(),
  geo: z.object({ lat: z.number(), lng: z.number(), accuracy: z.number().optional() }).optional(),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const rl = await checkAgentRateLimit({ userId: user.id, agentId: "quick-capture", perMinute: 12, perHour: 200 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: rl.reason },
      { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined },
    );
  }

  const start = Date.now();
  const extraction = await extractInvoiceFromImage(parsed.data.mime_type, parsed.data.base64);

  if (!extraction.ok) {
    return NextResponse.json({
      ok: false,
      error: extraction.error,
      stage: "extract",
    }, { status: 502 });
  }

  const datos = extraction.data ?? {};
  const confidence = confidenceScore(datos);

  // Solo intentar categorización si tenemos vendor o concepto
  let cat = null;
  if (datos.vendor_name || datos.concepto) {
    cat = await categorizeExpense({
      empresa_id: parsed.data.empresa_id,
      vendor_name: datos.vendor_name,
      vendor_nif: datos.vendor_nif,
      concepto: datos.concepto,
      total: datos.total,
    });
  }

  // Persistir extracción pendiente de confirmación
  const { data: extRow } = await admin
    .from("facturas_recibidas_extracciones")
    .insert({
      empresa_id: parsed.data.empresa_id,
      gestor_id: user.id,
      source: "mobile",
      filename: parsed.data.filename ?? `foto_${Date.now()}.jpg`,
      datos_extraidos: datos,
      confidence,
      status: confidence >= 50 ? "extracted" : "pending",
      raw_text: extraction.raw ?? null,
    })
    .select("id")
    .single();

  await admin.from("agent_runs").insert({
    empresa_id: parsed.data.empresa_id,
    agent_id: "quick-capture",
    triggered_by: user.id,
    source: "movil",
    input: { filename: parsed.data.filename, geo: parsed.data.geo },
    output: { confidence, has_cat: Boolean(cat) },
    status: "success",
    duration_ms: Date.now() - start,
    provider: extraction.provider,
  });

  return NextResponse.json({
    ok: true,
    extraction_id: extRow?.id,
    datos,
    confidence,
    provider: extraction.provider,
    categorizacion: cat,
  });
}
