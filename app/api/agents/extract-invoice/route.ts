import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { confidenceScore, extractInvoiceFromImage, extractInvoiceFromText } from "@/lib/agents/invoice-extractor";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  source: z.enum(["upload", "email", "manual", "mobile"]).default("upload"),
  filename: z.string().max(240).optional(),
  mime_type: z.string().max(120).optional(),
  base64: z.string().optional(),
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

  const start = Date.now();
  const extraction = parsed.data.base64
    ? await extractInvoiceFromImage(parsed.data.mime_type ?? "image/png", parsed.data.base64)
    : await extractInvoiceFromText(parsed.data.text ?? "");

  const datos = extraction.ok ? extraction.data ?? {} : {};
  const confidence = extraction.ok ? confidenceScore(datos) : 0;
  const status = extraction.ok && confidence >= 50 ? "extracted" : extraction.ok ? "pending" : "failed";

  const { data: row, error } = await admin
    .from("facturas_recibidas_extracciones")
    .insert({
      empresa_id: parsed.data.empresa_id,
      gestor_id: user.id,
      source: parsed.data.source,
      inbound_email_id: parsed.data.inbound_email_id ?? null,
      storage_path: parsed.data.storage_path ?? null,
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
