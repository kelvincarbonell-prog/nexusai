import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

const Schema = z.object({
  signature_b64: z.string().min(50),
  certificate_b64: z.string().min(50),
  formato: z.string().max(40).optional(),
  algoritmo: z.string().max(40).optional(),
  empresa_id: z.string().uuid(),
  kind: z.string().max(40),
});

/**
 * Persiste la firma de un modelo AEAT (u otro) hecha con Autofirma desde el
 * navegador. Sube el .csig al Storage y marca la declaración como firmada.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const sigBuf = Buffer.from(parsed.data.signature_b64, "base64");
  const sha = crypto.createHash("sha256").update(sigBuf).digest("hex");

  const ts = Date.now();
  const ext = (parsed.data.formato ?? "csig").toLowerCase().includes("xades") ? "xsig" : "csig";
  const path = `${parsed.data.empresa_id}/firmas-aeat/${id}-${ts}.${ext}`;
  await admin.storage.from("signed-documents").upload(path, sigBuf, {
    contentType: "application/octet-stream",
    upsert: true,
  });

  // Marca la declaración como firmada (best-effort; si faltan columnas no rompe)
  if (parsed.data.kind === "modelo_aeat") {
    try {
      await admin
        .from("aeat_declaraciones")
        .update({
          status: "firmado",
          firmado_at: new Date().toISOString(),
          firmado_por: user.id,
          firma_path: path,
          firma_hash: sha,
        })
        .eq("id", id);
    } catch {
      // silencio: si la tabla no tiene las columnas firmado_*, no rompe
    }
  }

  return NextResponse.json({
    ok: true,
    storage_path: path,
    hash: sha,
    siguiente: "Descarga el archivo firmado y súbelo a la sede AEAT, o usa el deep-link.",
  });
}
