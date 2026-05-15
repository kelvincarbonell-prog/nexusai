import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";

const Schema = z.object({ enabled: z.boolean() });

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const { id } = await ctx.params;
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Body inválido");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, id))) return jsonError("Sin permiso", 403);

  const { data: empresa, error: fetchErr } = await admin
    .from("empresas")
    .select("metadata")
    .eq("id", id)
    .single();
  if (fetchErr || !empresa) return jsonError("Empresa no encontrada", 404);

  const meta = (empresa.metadata ?? {}) as Record<string, unknown>;
  const newMeta = {
    ...meta,
    verifactu_enabled: parsed.data.enabled,
    verifactu_activated_at: parsed.data.enabled ? new Date().toISOString() : null,
    verifactu_activated_by: parsed.data.enabled ? user.id : null,
  };

  const { error } = await admin.from("empresas").update({ metadata: newMeta }).eq("id", id);
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ ok: true, verifactu_enabled: parsed.data.enabled });
}
