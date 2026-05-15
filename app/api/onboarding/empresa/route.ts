import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { validateNif } from "@/lib/aeat/validators";

const Schema = z.object({
  nombre: z.string().min(2).max(180),
  nif: z.string().min(8).max(20),
  account_type: z.enum(["autonomo", "empresa"]).default("empresa"),
  plan: z.string().max(40).default("negocio"),
});

function randomAlias() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `facturas-${out}`;
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const nifCheck = validateNif(parsed.data.nif);
  if (!nifCheck.ok) return jsonError(`NIF inválido: ${nifCheck.reason}`, 400);

  const admin = createSupabaseAdmin();
  const inboxAlias = randomAlias();

  const { data: empresa, error } = await admin
    .from("empresas")
    .insert({
      nombre: parsed.data.nombre,
      nif: parsed.data.nif.toUpperCase().replace(/\s|-/g, ""),
      gestor_id: user.id,
      owner_user_id: user.id,
      account_type: parsed.data.account_type,
      plan: parsed.data.plan,
      inbox_alias: inboxAlias,
    })
    .select("*")
    .single();

  if (error || !empresa) return jsonError(error?.message ?? "No se pudo crear la empresa", 500);

  // marca onboarding como completado en perfiles.metadata
  const { data: profile } = await admin.from("perfiles").select("metadata").eq("id", user.id).maybeSingle();
  const meta = (profile?.metadata ?? {}) as Record<string, unknown>;
  await admin
    .from("perfiles")
    .update({ metadata: { ...meta, onboarding_done: true, onboarding_done_at: new Date().toISOString() } })
    .eq("id", user.id);

  return NextResponse.json({ ok: true, empresa });
}

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const admin = createSupabaseAdmin();
  const { data: profile } = await admin.from("perfiles").select("metadata").eq("id", user.id).maybeSingle();
  const meta = (profile?.metadata ?? {}) as Record<string, unknown>;
  await admin
    .from("perfiles")
    .update({ metadata: { ...meta, onboarding_done: true, onboarding_skipped: true, onboarding_done_at: new Date().toISOString() } })
    .eq("id", user.id);
  return NextResponse.json({ ok: true });
}
