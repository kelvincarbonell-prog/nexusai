import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const UpdateSchema = z.object({
  nombre: z.string().min(1).max(180).optional(),
  apellidos: z.string().max(180).optional(),
  nombre_gestoria: z.string().max(180).optional(),
  foto_url: z.string().url().optional().nullable(),
  metadata_patch: z.record(z.unknown()).optional(),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("perfiles")
    .select("id,email,nombre,apellidos,rol,nombre_gestoria,foto_url,metadata,created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, perfil: data });
}

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  const { metadata_patch, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest };

  if (metadata_patch) {
    const { data: existing } = await admin.from("perfiles").select("metadata").eq("id", user.id).maybeSingle();
    const prevMeta = (existing?.metadata ?? {}) as Record<string, unknown>;
    update.metadata = { ...prevMeta, ...metadata_patch };
  }

  const { data, error } = await admin.from("perfiles").update(update).eq("id", user.id).select("*").single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo actualizar", 500);
  return NextResponse.json({ ok: true, perfil: data });
}
