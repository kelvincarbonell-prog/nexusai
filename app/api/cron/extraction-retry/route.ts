import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { confidenceScore, extractInvoiceFromImage, extractInvoiceFromText } from "@/lib/agents/invoice-extractor";

/**
 * Cron de reintento de extracciones encoladas.
 *
 * Cada 30 min:
 *  1. Toma las extracciones en `status=queued` con next_retry_at <= now() (orden FIFO).
 *  2. Reintenta la extracción.
 *  3. Si vuelve a fallar por saturación/network: incrementa retry_count
 *     y suma tiempo al siguiente retry (30 + retry_count*15 min, max 6h).
 *  4. Si éxito: pasa a "extracted" / "needs_manual_review" según matching.
 *  5. Si falla por motivo no transitorio (formato, sin contenido): pasa a "failed".
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
    if (provided !== secret) return NextResponse.json({ ok: false }, { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "CRON_SECRET requerido" }, { status: 503 });
  }

  const admin = createSupabaseAdmin();
  const ahoraIso = new Date().toISOString();

  const { data: pendientes } = await admin
    .from("facturas_recibidas_extracciones")
    .select("id,empresa_id,storage_path,filename,raw_text,retry_count,datos_extraidos")
    .eq("status", "queued")
    .lte("next_retry_at", ahoraIso)
    .order("created_at", { ascending: true })
    .limit(20);

  if (!pendientes || pendientes.length === 0) {
    return NextResponse.json({ ok: true, procesadas: 0 });
  }

  const { matchFacturaEmpresa } = await import("@/lib/extraction/matching");
  let resueltas = 0;
  let aunEnCola = 0;

  for (const row of pendientes) {
    // Recupera el archivo si tenemos storage_path
    let extraction: Awaited<ReturnType<typeof extractInvoiceFromImage>> | null = null;
    try {
      if (row.storage_path) {
        const { data: signed } = await admin.storage.from("ocr-uploads").createSignedUrl(row.storage_path, 600);
        if (signed?.signedUrl) {
          const res = await fetch(signed.signedUrl);
          const blob = await res.arrayBuffer();
          const base64 = Buffer.from(blob).toString("base64");
          extraction = await extractInvoiceFromImage("application/octet-stream", base64);
        }
      } else if (row.raw_text) {
        extraction = await extractInvoiceFromText(String(row.raw_text));
      }
    } catch (e) {
      extraction = { ok: false, provider: "none", error: e instanceof Error ? e.message : "Error red" };
    }

    if (!extraction) {
      // No tenemos contenido recuperable → marca failed
      await admin
        .from("facturas_recibidas_extracciones")
        .update({ status: "failed", error: "Sin contenido recuperable para reintentar." })
        .eq("id", row.id);
      continue;
    }

    const datos = extraction.ok ? extraction.data ?? {} : {};
    const confidence = extraction.ok ? confidenceScore(datos) : 0;
    const errStr = (extraction.error ?? "").toLowerCase();
    const isTransient = !extraction.ok && (
      errStr.includes("rate") || errStr.includes("429") || errStr.includes("timeout") ||
      errStr.includes("network") || errStr.includes("quota") || errStr.includes("unavailable")
    );

    if (isTransient) {
      // Aún saturado: aumenta tiempo
      const newRetry = (row.retry_count ?? 0) + 1;
      const minutos = Math.min(360, 30 + newRetry * 15);
      const nextAt = new Date(Date.now() + minutos * 60_000).toISOString();
      await admin
        .from("facturas_recibidas_extracciones")
        .update({
          retry_count: newRetry,
          next_retry_at: nextAt,
          eta_seconds: minutos * 60,
          error: extraction.error,
        })
        .eq("id", row.id);
      aunEnCola++;
      continue;
    }

    if (!extraction.ok) {
      await admin
        .from("facturas_recibidas_extracciones")
        .update({ status: "failed", error: extraction.error, next_retry_at: null, eta_seconds: null })
        .eq("id", row.id);
      continue;
    }

    // Éxito: aplica matching
    const { data: empresa } = await admin.from("empresas").select("nif,nombre").eq("id", row.empresa_id).maybeSingle();
    const match = empresa
      ? matchFacturaEmpresa(datos as Record<string, unknown>, { nif: empresa.nif, nombre: empresa.nombre })
      : { ok: true, score: 0, warnings: [], empresa_es_cliente: null };

    const status = !match.ok
      ? "needs_manual_review"
      : confidence >= 50
        ? "extracted"
        : "pending";

    await admin
      .from("facturas_recibidas_extracciones")
      .update({
        status,
        datos_extraidos: datos,
        confidence,
        match_score: match.score,
        match_warnings: match.warnings,
        next_retry_at: null,
        eta_seconds: null,
        error: null,
      })
      .eq("id", row.id);
    resueltas++;
  }

  return NextResponse.json({ ok: true, procesadas: pendientes.length, resueltas, aun_en_cola: aunEnCola });
}
