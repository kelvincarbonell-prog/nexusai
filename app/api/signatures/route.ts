import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, refId } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const SignatureRequest = z.object({
  ref: z.string().regex(/^NX-[A-Z0-9-]+$/).optional(),
  empresaId: z.string().uuid().optional(),
  empresa: z.string().max(180).default("Sin nombre"),
  docTipo: z.string().max(120).default("Documento"),
  signedBase64: z.string().min(1),
  originalHash: z.string().max(128).optional(),
  certInfo: z.string().max(500).optional(),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const admin = createSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const empresaId = searchParams.get("empresaId");

  let query = admin
    .from("firma_docs")
    .select("ref,empresa_id,empresa,doc_tipo,filename,file_size,formato,timestamp_firma,signed_hash")
    .eq("gestor_id", user.id)
    .order("timestamp_firma", { ascending: false })
    .limit(100);

  if (empresaId) query = query.eq("empresa_id", empresaId);
  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ ok: true, docs: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = SignatureRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Body inválido");

  const data = parsed.data;
  const ref = data.ref ?? refId();
  const signedBytes = Buffer.from(data.signedBase64, "base64");
  if (signedBytes.length > 10 * 1024 * 1024) return jsonError("Documento demasiado grande", 413);

  const ext = signedBytes.subarray(0, 4).toString() === "%PDF" ? "pdf" : "p7s";
  const filename = `${ref}.${ext}`;
  const storagePath = `${user.id}/${filename}`;
  const admin = createSupabaseAdmin();

  const { error: uploadError } = await admin.storage
    .from("signed-documents")
    .upload(storagePath, signedBytes, {
      contentType: ext === "pdf" ? "application/pdf" : "application/pkcs7-signature",
      upsert: false,
    });

  if (uploadError) return jsonError(uploadError.message, 500);

  const signedHash = await sha256(signedBytes);
  const row = {
    ref,
    empresa_id: data.empresaId ?? null,
    empresa: data.empresa,
    doc_tipo: data.docTipo,
    gestor_id: user.id,
    gestor_email: user.email ?? "",
    original_hash: data.originalHash ?? "",
    signed_hash: signedHash,
    cert_info: data.certInfo ?? "",
    filename,
    storage_path: storagePath,
    file_size: signedBytes.length,
    formato: ext.toUpperCase(),
  };

  const { error: dbError } = await admin.from("firma_docs").insert(row);
  if (dbError) return jsonError(dbError.message, 500);

  return NextResponse.json({
    ok: true,
    ref,
    filename,
    url: `/api/signatures/${encodeURIComponent(ref)}`,
    hash: signedHash,
    size: signedBytes.length,
    formato: ext.toUpperCase(),
  });
}

async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
