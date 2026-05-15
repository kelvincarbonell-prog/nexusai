import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const PatchSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("profile"),
    id: z.string().uuid(),
    rol: z.enum(["admin", "gestor", "asesor", "portal_cliente"]),
    nombre_gestoria: z.string().max(180).nullable().optional(),
  }),
  z.object({
    type: z.literal("company"),
    id: z.string().uuid(),
    estado: z.string().min(2).max(40),
    account_type: z.enum(["autonomo", "empresa"]),
    onboarding_source: z.enum(["gestoria", "self_serve"]),
    plan: z.string().min(2).max(40),
  }),
]);

async function requireAdmin(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return { user: null, admin: null, allowed: false };
  const admin = createSupabaseAdmin();
  const { data } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  return { user, admin, allowed: data?.rol === "admin" };
}

export async function PATCH(request: NextRequest) {
  const { user, admin, allowed } = await requireAdmin(request);
  if (!allowed || !admin || !user) return jsonError("No autorizado", 403);

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Body inválido");

  if (parsed.data.type === "profile") {
    const { error } = await admin
      .from("perfiles")
      .update({
        rol: parsed.data.rol,
        nombre_gestoria: parsed.data.nombre_gestoria ?? null,
      })
      .eq("id", parsed.data.id);
    if (error) return jsonError(error.message, 500);
  }

  if (parsed.data.type === "company") {
    const { error } = await admin
      .from("empresas")
      .update({
        estado: parsed.data.estado,
        account_type: parsed.data.account_type,
        onboarding_source: parsed.data.onboarding_source,
        plan: parsed.data.plan,
      })
      .eq("id", parsed.data.id);
    if (error) return jsonError(error.message, 500);
  }

  await admin.from("platform_audit_events").insert({
    actor_id: user.id,
    event_type: `super_admin.${parsed.data.type}.update`,
    target_table: parsed.data.type === "profile" ? "perfiles" : "empresas",
    target_id: parsed.data.id,
    metadata: parsed.data,
  });

  return NextResponse.json({ ok: true });
}
