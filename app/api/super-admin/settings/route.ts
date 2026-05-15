import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const SettingSchema = z.object({
  key: z.string().min(2).max(80).regex(/^[a-z0-9_-]+$/),
  value: z.record(z.unknown()),
  description: z.string().max(500).optional(),
});

async function requireAdmin(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return { user: null, admin: null, allowed: false };
  const admin = createSupabaseAdmin();
  const { data } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  return { user, admin, allowed: data?.rol === "admin" };
}

export async function PUT(request: NextRequest) {
  const { user, admin, allowed } = await requireAdmin(request);
  if (!allowed || !admin || !user) return jsonError("No autorizado", 403);

  const parsed = SettingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Body inválido");

  const { error } = await admin.from("super_admin_settings").upsert({
    key: parsed.data.key,
    value: parsed.data.value,
    description: parsed.data.description ?? "",
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  });
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ ok: true });
}
