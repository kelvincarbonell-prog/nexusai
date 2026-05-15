import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const Schema = z.object({
  filename: z.string().max(240),
  mime_type: z.string().regex(/^image\/(png|jpe?g|webp|gif)$/i),
  base64: z.string().min(1).max(4_000_000), // ~3 MB binario
});

const BUCKET = "avatars";

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();

  // Asegurar el bucket existe (público para mostrar la foto vía URL directa)
  await admin.storage.createBucket(BUCKET, { public: true }).catch(() => {
    /* ya existe */
  });

  const ext = parsed.data.filename.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const buffer = Buffer.from(parsed.data.base64, "base64");

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: parsed.data.mime_type, upsert: true });
  if (uploadErr) return jsonError(uploadErr.message, 500);

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;

  const { error: updErr } = await admin.from("perfiles").update({ foto_url: url }).eq("id", user.id);
  if (updErr) return jsonError(updErr.message, 500);

  return NextResponse.json({ ok: true, foto_url: url });
}
