import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { confidenceScore, extractInvoiceFromImage, extractInvoiceFromText } from "@/lib/agents/invoice-extractor";
import { checkAgentRateLimit } from "@/lib/agents/rate-limit";

const MAX_BASE64 = 8_000_000; // ~6 MB binario

const Schema = z.object({
  empresa_id: z.string().uuid(),
  source: z.enum(["upload", "email", "manual", "mobile"]).default("upload"),
  filename: z.string().max(240).optional(),
  mime_type: z.string().max(120).optional(),
  base64: z.string().max(MAX_BASE64).optional(),
  text: z.string().max(40000).optional(),
  inbound_email_id: z.string().uuid().optional(),
  storage_path: z.string().max(500).optional(),
}).refine((d) => Boolean(d.base64 || d.text), { message: "base64 o text requerido" });

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const rl = await checkAgentRateLimit({ userId: user.id, agentId: "invoice-extractor", perMinute: 20, perHour: 300 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: rl.reason },
      { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined },
    );
  }

  const start = Date.now();
  const extraction = parsed.data.base64
    ? await extractInvoiceFromImage(parsed.data.mime_type ?? "image/png", parsed.data.base64)
    : await extractInvoiceFromText(parsed.data.text ?? "");

  const datos = extraction.ok ? extraction.data ?? {} : {};
  const confidence = extraction.ok ? confidenceScore(datos) : 0;
  const status = extraction.ok && confidence >= 50 ? "extracted" : extraction.ok ? "pending" : "failed";

  // Sube el archivo original a storage (ocr-uploads) para poder visualizarlo después.
  let storagePath = parsed.data.storage_path ?? null;
  if (!storagePath && parsed.data.base64) {
    try {
      const safeFilename = (parsed.data.filename ?? "factura").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
      const ts = Date.now();
      const candidate = `${parsed.data.empresa_id}/${ts}-${safeFilename}`;
      const fileBuf = Uint8Array.from(atob(parsed.data.base64), (c) => c.charCodeAt(0));
      const up = await admin.storage.from("ocr-uploads").upload(candidate, fileBuf, {
        contentType: parsed.data.mime_type ?? "application/octet-stream",
        upsert: false,
      });
      if (!up.error) storagePath = candidate;
    } catch {
      // Si falla el storage, seguimos sin storage_path — la extracción ya está hecha.
    }
  }

  const { data: row, error } = await admin
    .from("facturas_recibidas_extracciones")
    .insert({
      empresa_id: parsed.data.empresa_id,
      gestor_id: user.id,
      source: parsed.data.source,
      inbound_email_id: parsed.data.inbound_email_id ?? null,
      storage_path: storagePath,
      filename: parsed.data.filename ?? null,
      raw_text: extraction.raw ?? null,
      datos_extraidos: datos,
      status,
      confidence,
      error: extraction.ok ? null : extraction.error,
    })
    .select("*")
    .single();
  if (error || !row) return jsonError(error?.message ?? "No se pudo guardar", 500);

  await admin.from("agent_runs").insert({
    empresa_id: parsed.data.empresa_id,
    agent_id: "invoice-extractor",
    triggered_by: user.id,
    source: parsed.data.source,
    input: { filename: parsed.data.filename, has_image: Boolean(parsed.data.base64) },
    output: { confidence, status },
    status: extraction.ok ? "success" : "failed",
    duration_ms: Date.now() - start,
    provider: extraction.provider,
    error: extraction.ok ? null : extraction.error,
  });

  return NextResponse.json({ ok: extraction.ok, item: row, confidence, provider: extraction.provider, error: extraction.error });
}
