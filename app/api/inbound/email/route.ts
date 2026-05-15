import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { confidenceScore, extractInvoiceFromImage, extractInvoiceFromText } from "@/lib/agents/invoice-extractor";

const MAX_ATTACHMENT_BASE64 = 8_000_000; // ~6 MB binario por adjunto
const MAX_ATTACHMENTS = 10;

const AttachmentSchema = z.object({
  name: z.string().max(240),
  content_type: z.string().max(120).optional(),
  content_base64: z.string().max(MAX_ATTACHMENT_BASE64),
});

const PayloadSchema = z.object({
  to: z.string().max(240),
  from: z.string().max(240).optional(),
  message_id: z.string().max(240).optional(),
  subject: z.string().max(500).optional(),
  body_text: z.string().max(40_000).optional(),
  body_html: z.string().max(200_000).optional(),
  attachments: z.array(AttachmentSchema).max(MAX_ATTACHMENTS).default([]),
});

function shouldProcessAttachment(att: z.infer<typeof AttachmentSchema>) {
  const ct = (att.content_type ?? "").toLowerCase();
  const name = att.name.toLowerCase();
  return (
    ct.startsWith("image/") ||
    ct === "application/pdf" ||
    name.endsWith(".pdf") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".webp")
  );
}

function aliasFromAddress(addr: string) {
  const local = addr.split("@")[0]?.trim().toLowerCase() ?? "";
  return local;
}

export async function POST(request: NextRequest) {
  const sharedSecret = process.env.INBOUND_EMAIL_SECRET;
  if (!sharedSecret) {
    if (process.env.NODE_ENV === "production") {
      return jsonError("Webhook deshabilitado: falta INBOUND_EMAIL_SECRET.", 503);
    }
    // En desarrollo aceptamos sin secret para facilitar pruebas locales.
  } else {
    const header = request.headers.get("x-nexusai-token") ?? request.headers.get("authorization") ?? "";
    const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
    if (provided !== sharedSecret) return jsonError("Token inválido", 401);
  }

  const parsed = PayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Payload inválido");

  const admin = createSupabaseAdmin();
  const alias = aliasFromAddress(parsed.data.to);
  if (!alias) return jsonError("Alias no resoluble");
  const { data: empresa } = await admin
    .from("empresas")
    .select("id,inbox_alias")
    .eq("inbox_alias", alias)
    .maybeSingle();

  const { data: inboundEmail } = await admin
    .from("inbound_emails")
    .insert({
      empresa_id: empresa?.id ?? null,
      inbox_alias: alias,
      message_id: parsed.data.message_id ?? null,
      from_addr: parsed.data.from ?? null,
      to_addr: parsed.data.to,
      subject: parsed.data.subject ?? null,
      body_text: parsed.data.body_text ?? null,
      body_html: parsed.data.body_html ?? null,
      attachments: parsed.data.attachments.map((a) => ({ name: a.name, content_type: a.content_type })),
      processed: false,
    })
    .select("*")
    .single();

  if (!empresa || !inboundEmail) {
    return NextResponse.json({ ok: true, matched: Boolean(empresa), message: "Email almacenado, sin empresa asociada." });
  }

  const results: Array<{ name: string; ok: boolean; confidence?: number; error?: string }> = [];
  for (const att of parsed.data.attachments) {
    if (!shouldProcessAttachment(att)) continue;
    const isPdf = (att.content_type ?? "").includes("pdf") || att.name.toLowerCase().endsWith(".pdf");
    const extraction = isPdf
      ? await extractInvoiceFromText(`PDF nombre: ${att.name}. Texto adjunto:\n${parsed.data.body_text ?? ""}`)
      : await extractInvoiceFromImage(att.content_type ?? "image/png", att.content_base64);

    const datos = extraction.ok ? extraction.data ?? {} : {};
    const confidence = extraction.ok ? confidenceScore(datos) : 0;
    const status = extraction.ok && confidence >= 50 ? "extracted" : extraction.ok ? "pending" : "failed";

    await admin.from("facturas_recibidas_extracciones").insert({
      empresa_id: empresa.id,
      source: "email",
      inbound_email_id: inboundEmail.id,
      filename: att.name,
      datos_extraidos: datos,
      confidence,
      status,
      error: extraction.ok ? null : extraction.error,
    });
    results.push({ name: att.name, ok: extraction.ok, confidence, error: extraction.error });
  }

  await admin
    .from("inbound_emails")
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq("id", inboundEmail.id);

  await admin.from("agent_runs").insert({
    empresa_id: empresa.id,
    agent_id: "email-ingest",
    source: "email",
    input: { alias, attachments: parsed.data.attachments.length },
    output: { results },
    status: results.every((r) => r.ok) ? "success" : results.some((r) => r.ok) ? "partial" : "failed",
  });

  return NextResponse.json({ ok: true, matched: true, results });
}
