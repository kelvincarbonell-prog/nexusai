import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/notificaciones?solo_no_leidas=1
 *   Devuelve las notificaciones del usuario logueado.
 *
 * PATCH /api/notificaciones
 *   Body: { id?: string, ids?: string[], marcar_todas?: boolean }
 *   Marca como leídas.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const soloNoLeidas = request.nextUrl.searchParams.get("solo_no_leidas") === "1";
  const admin = createSupabaseAdmin();

  let q = admin
    .from("notificaciones")
    .select("id,empresa_id,tipo,titulo,detalle,url,severidad,leida,metadata,created_at")
    .eq("destinatario_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (soloNoLeidas) q = q.eq("leida", false);

  const { data, error } = await q;
  if (error) return jsonError(error.message, 500);

  const noLeidas = (data ?? []).filter((n) => !n.leida).length;
  return NextResponse.json({ ok: true, items: data ?? [], no_leidas: noLeidas });
}

const PatchSchema = z.object({
  id: z.string().uuid().optional(),
  ids: z.array(z.string().uuid()).max(200).optional(),
  marcar_todas: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  const now = new Date().toISOString();

  if (parsed.data.marcar_todas) {
    await admin
      .from("notificaciones")
      .update({ leida: true, leida_at: now })
      .eq("destinatario_id", user.id)
      .eq("leida", false);
    return NextResponse.json({ ok: true });
  }

  const ids = parsed.data.ids ?? (parsed.data.id ? [parsed.data.id] : []);
  if (ids.length === 0) return jsonError("Sin ids");
  await admin
    .from("notificaciones")
    .update({ leida: true, leida_at: now })
    .eq("destinatario_id", user.id)
    .in("id", ids);
  return NextResponse.json({ ok: true });
}
