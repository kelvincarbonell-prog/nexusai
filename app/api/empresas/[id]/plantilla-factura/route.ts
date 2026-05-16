import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { checkQuotaOrThrow } from "@/lib/storage/quota";

const Schema = z.object({
  color_primario: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  color_secundario: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  serie: z.string().max(10).optional(),
  pie_factura: z.string().max(500).optional(),
  email_plantilla: z.string().max(2000).optional(),
  logo_base64: z.string().optional(),
  logo_mime: z.string().optional(),
});

const BUCKET = "branding";

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;
  const admin = createSupabaseAdmin();
  const { data: empresa } = await admin.from("empresas").select("metadata").eq("id", id).maybeSingle();
  if (!empresa) return jsonError("Empresa no encontrada", 404);
  const meta = (empresa.metadata ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    ok: true,
    plantilla: {
      logo_url: meta.logo_url ?? null,
      color_primario: meta.color_primario ?? "#7c5cff",
      color_secundario: meta.color_secundario ?? "#67e8f9",
      serie: meta.serie_factura ?? "FAC",
      pie_factura: meta.pie_factura ?? "",
      email_plantilla: meta.email_plantilla ?? "Hola {cliente},\n\nAdjunto la factura {numero} por {total}. El vencimiento es el {vencimiento}.\n\nGracias por confiar en nosotros.",
    },
  });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, id))) return jsonError("Sin permiso", 403);

  const { data: existing } = await admin.from("empresas").select("metadata").eq("id", id).single();
  const prevMeta = (existing?.metadata ?? {}) as Record<string, unknown>;
  const newMeta: Record<string, unknown> = { ...prevMeta };

  if (parsed.data.color_primario) newMeta.color_primario = parsed.data.color_primario;
  if (parsed.data.color_secundario) newMeta.color_secundario = parsed.data.color_secundario;
  if (parsed.data.serie) newMeta.serie_factura = parsed.data.serie;
  if (parsed.data.pie_factura != null) newMeta.pie_factura = parsed.data.pie_factura;
  if (parsed.data.email_plantilla != null) newMeta.email_plantilla = parsed.data.email_plantilla;

  if (parsed.data.logo_base64 && parsed.data.logo_mime) {
    const bytes = Buffer.from(parsed.data.logo_base64, "base64");
    try {
      await checkQuotaOrThrow(user.id, bytes.length);
    } catch (e: unknown) {
      return jsonError(e instanceof Error ? e.message : "Cuota excedida", 413);
    }
    await admin.storage.createBucket(BUCKET, { public: true }).catch(() => {});
    const ext = parsed.data.logo_mime.split("/")[1] ?? "png";
    const path = `${user.id}/${id}-logo-${Date.now()}.${ext}`;
    const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: parsed.data.logo_mime,
      upsert: true,
    });
    if (uploadErr) return jsonError(uploadErr.message, 500);
    const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
    newMeta.logo_url = pub.publicUrl;
  }

  const { error } = await admin.from("empresas").update({ metadata: newMeta }).eq("id", id);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, plantilla: newMeta });
}
