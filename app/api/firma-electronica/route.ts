import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

/**
 * Firma electrónica simple (eIDAS nivel básico).
 *
 * Persiste:
 *   - Imagen PNG de la firma manuscrita.
 *   - SHA-256 del documento que se firma + datos del firmante.
 *   - Timestamp + IP del firmante (audit trail).
 *
 * Validez: suficiente para recibís de nómina, finiquito, registro horario,
 * entrega de EPIs, acuerdos internos. NO sustituye a firma cualificada con
 * certificado para documentos AEAT/notariales.
 */

const Schema = z.object({
  empresa_id: z.string().uuid(),
  documento_tipo: z.enum(["nomina", "finiquito", "registro_horario", "epi", "contrato", "documento", "acuerdo"]),
  documento_ref: z.string().min(1).max(180),     // ej. "nomina_2026-04_juanperez"
  hash_documento: z.string().length(64).optional(), // SHA-256 hex del PDF firmado
  firma_png_base64: z.string().min(50).max(5_000_000),
  firmante_nombre: z.string().min(2).max(180),
  firmante_dni: z.string().max(20).optional(),
  firmante_rol: z.enum(["trabajador", "empresa", "gestor"]).default("trabajador"),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  // Sube la imagen PNG al Storage en una carpeta privada por empresa
  const safeRef = parsed.data.documento_ref.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const ts = Date.now();
  const path = `${parsed.data.empresa_id}/firmas/${parsed.data.documento_tipo}/${ts}-${safeRef}.png`;
  const buf = Buffer.from(parsed.data.firma_png_base64, "base64");
  const { error: upErr } = await admin.storage.from("signed-documents").upload(path, buf, {
    contentType: "image/png",
    upsert: false,
  });
  if (upErr) return jsonError(`No se pudo subir la firma: ${upErr.message}`, 500);

  // Calcula huella forense de la firma
  const firmaHash = crypto.createHash("sha256").update(buf).digest("hex");
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const ua = request.headers.get("user-agent") ?? null;

  const { data, error } = await admin
    .from("firma_docs")
    .insert({
      ref: `FIR-${ts}-${safeRef}`,
      empresa_id: parsed.data.empresa_id,
      empresa: parsed.data.firmante_rol === "empresa" ? parsed.data.firmante_nombre : null,
      doc_tipo: parsed.data.documento_tipo,
      gestor_id: user.id,
      gestor_email: user.email ?? "",
      original_hash: parsed.data.hash_documento ?? "",
      signed_hash: firmaHash,
      cert_info: `Firma manuscrita · ${parsed.data.firmante_rol} · ${parsed.data.firmante_nombre}${parsed.data.firmante_dni ? ` · ${parsed.data.firmante_dni}` : ""}`,
      filename: `${safeRef}.png`,
      storage_path: path,
      file_size: buf.length,
      formato: "PNG-FIRMA",
      metadata: {
        documento_ref: parsed.data.documento_ref,
        firmante: {
          nombre: parsed.data.firmante_nombre,
          dni: parsed.data.firmante_dni,
          rol: parsed.data.firmante_rol,
          ip,
          user_agent: ua,
          firmado_en: new Date().toISOString(),
        },
        eidas_nivel: "simple",
      },
    })
    .select("id,ref,storage_path")
    .single();

  if (error || !data) return jsonError(error?.message ?? "No se pudo registrar la firma", 500);

  return NextResponse.json({
    ok: true,
    ref: data.ref,
    storage_path: data.storage_path,
    hash: firmaHash,
    timestamp: new Date().toISOString(),
    nivel: "simple",
  });
}
