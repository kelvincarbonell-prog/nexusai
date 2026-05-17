import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { confidenceScore, extractInvoiceFromImage, extractInvoiceFromText } from "@/lib/agents/invoice-extractor";
import { checkAgentRateLimit } from "@/lib/agents/rate-limit";
import { categorizeExpense } from "@/lib/agents/expense-categorizer";
import { asentarGasto, autoAsientosActivado } from "@/lib/accounting/auto-asientos";

const AUTO_CONFIRM_THRESHOLD = 70;

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

  // ============================================================
  // AUTO-CONFIRM: si la confianza es alta, crear gasto + asiento
  // ============================================================
  let auto_gasto_id: string | null = null;
  let auto_asiento_id: string | null = null;
  let auto_cuenta_pgc: string | null = null;
  if (extraction.ok && confidence >= AUTO_CONFIRM_THRESHOLD && status === "extracted") {
    try {
      // 1) Auto-categorización IA (busca histórico, regla, IA fallback)
      const cat = await categorizeExpense({
        empresa_id: parsed.data.empresa_id,
        vendor_name: datos.vendor_name as string | undefined,
        vendor_nif: datos.vendor_nif as string | undefined,
        concepto: datos.concepto as string | undefined,
        total: typeof datos.total === "number" ? datos.total : undefined,
      });
      auto_cuenta_pgc = cat?.pgc_account_code ?? null;

      // 2) Crea el gasto
      const base = Number(datos.base ?? 0);
      const iva = Number(datos.iva ?? 0);
      const total = Number(datos.total ?? base + iva);
      const irpf = Number(datos.irpf ?? 0);
      const { data: gasto } = await admin
        .from("gastos")
        .insert({
          empresa_id: parsed.data.empresa_id,
          gestor_id: user.id,
          proveedor: (datos.vendor_name as string | undefined) ?? "Proveedor",
          concepto: (datos.concepto as string | undefined) ?? (datos.invoice_number as string | undefined) ?? "Factura recibida",
          fecha: (datos.issue_date as string | undefined) ?? new Date().toISOString().slice(0, 10),
          base, iva, total,
          estado: "pendiente",
          metadata: {
            proveedor_nif: datos.vendor_nif ?? null,
            retencion_irpf: irpf,
            origen_ocr: row.id,
            cuenta_pgc: auto_cuenta_pgc,
            categoria_confianza: cat?.confidence ?? null,
            categoria_fuente: cat?.source ?? null,
            auto_confirmado: true,
          },
        })
        .select("id")
        .single();
      if (gasto?.id) {
        auto_gasto_id = gasto.id;
        await admin
          .from("facturas_recibidas_extracciones")
          .update({ gasto_id: gasto.id, status: "reviewed" })
          .eq("id", row.id);

        // 3) Asiento automático si está activado en la empresa
        if (await autoAsientosActivado(admin, parsed.data.empresa_id)) {
          const asiento = await asentarGasto(
            admin,
            {
              id: gasto.id,
              empresa_id: parsed.data.empresa_id,
              fecha: (datos.issue_date as string | undefined) ?? new Date().toISOString().slice(0, 10),
              proveedor: (datos.vendor_name as string | undefined) ?? null,
              concepto: (datos.concepto as string | undefined) ?? null,
              base, iva, total,
              metadata: { proveedor_nif: datos.vendor_nif ?? null, retencion_irpf: irpf },
            },
            user.id,
            { cuenta_pgc: auto_cuenta_pgc ?? undefined },
          );
          auto_asiento_id = asiento?.id ?? null;
        }

        // 4) Guarda en histórico de categorización (aprende para próximas)
        if (cat) {
          try {
            await admin.from("expense_categorization_history").insert({
              empresa_id: parsed.data.empresa_id,
              vendor_nif: (datos.vendor_nif as string | undefined) ?? null,
              vendor_name: (datos.vendor_name as string | undefined) ?? null,
              concepto: (datos.concepto as string | undefined) ?? null,
              pgc_account_code: cat.pgc_account_code,
              confidence: cat.confidence,
              learned_from: cat.source,
              created_by: user.id,
              gasto_id: gasto.id,
            });
          } catch {
            // no bloquea
          }
        }
      }
    } catch {
      // Si falla cualquier paso, devuelves la extracción tal cual y el gestor confirma manual.
    }
  }

  return NextResponse.json({
    ok: extraction.ok,
    item: row,
    confidence,
    provider: extraction.provider,
    error: extraction.error,
    auto_confirmado: Boolean(auto_gasto_id),
    auto_gasto_id,
    auto_asiento_id,
    auto_cuenta_pgc,
  });
}
