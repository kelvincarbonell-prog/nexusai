import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const Schema = z.object({
  endpoint: z.string().url().max(500),
  p256dh: z.string().min(1).max(200),
  auth: z.string().min(1).max(200),
  user_agent: z.string().max(500).optional(),
  device_label: z.string().max(120).optional(),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("push_subscriptions")
    .upsert({
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      user_agent: parsed.data.user_agent ?? request.headers.get("user-agent") ?? null,
      device_label: parsed.data.device_label,
      active: true,
    }, { onConflict: "user_id,endpoint" })
    .select("id")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo guardar", 500);
  return NextResponse.json({ ok: true, id: data.id });
}

export async function DELETE(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const endpoint = request.nextUrl.searchParams.get("endpoint");
  if (!endpoint) return jsonError("Falta endpoint");
  const admin = createSupabaseAdmin();
  await admin.from("push_subscriptions").update({ active: false }).eq("user_id", user.id).eq("endpoint", endpoint);
  return NextResponse.json({ ok: true });
}
