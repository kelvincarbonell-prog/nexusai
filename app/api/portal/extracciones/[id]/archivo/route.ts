import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

/**
 * Devuelve una signed URL temporal (15 min) para visualizar el archivo
 * original de una extracción OCR.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;
  const admin = createSupabaseAdmin();

  const { data: extr } = await admin
    .from("facturas_recibidas_extracciones")
    .select("empresa_id,storage_path,filename")
    .eq("id", id)
    .single();
  if (!extr) return jsonError("Extracción no encontrada", 404);
  if (!(await canAccessLaborCompany(admin, user.id, extr.empresa_id))) return jsonError("Sin acceso", 403);
  if (!extr.storage_path) return jsonError("Sin archivo guardado", 404);

  const { data: signed, error } = await admin.storage
    .from("ocr-uploads")
    .createSignedUrl(extr.storage_path, 900);
  if (error || !signed) return jsonError(error?.message ?? "No se pudo firmar", 500);

  return NextResponse.json({ ok: true, url: signed.signedUrl, filename: extr.filename });
}
