import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Tracking ligero de tiempo dedicado a un cliente.
 * Cada heartbeat (cada ~30s) se registra como un agent_run con
 * agent_id='time-tracking' y duration_ms del intervalo.
 *
 * Lo agregamos a la tabla existente agent_runs para no añadir más DDL.
 */

const Schema = z.object({
  empresa_id: z.string().uuid(),
  duration_ms: z.number().int().min(500).max(120_000),
  path: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  await admin.from("agent_runs").insert({
    empresa_id: parsed.data.empresa_id,
    agent_id: "time-tracking",
    triggered_by: user.id,
    source: "ui",
    input: { path: parsed.data.path },
    output: {},
    status: "success",
    duration_ms: parsed.data.duration_ms,
  });

  return NextResponse.json({ ok: true });
}
