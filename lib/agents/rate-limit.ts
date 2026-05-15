import { createSupabaseAdmin } from "@/lib/supabase/admin";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;

export type RateLimitOptions = {
  userId: string;
  agentId: string;
  perMinute?: number;
  perHour?: number;
};

export async function checkAgentRateLimit(opts: RateLimitOptions): Promise<{ ok: boolean; retryAfter?: number; reason?: string }> {
  const admin: SupabaseAdmin = createSupabaseAdmin();
  const now = Date.now();
  const sinceMinute = new Date(now - 60_000).toISOString();
  const sinceHour = new Date(now - 3_600_000).toISOString();
  const minuteLimit = opts.perMinute ?? 30;
  const hourLimit = opts.perHour ?? 300;

  const [{ count: minuteCount }, { count: hourCount }] = await Promise.all([
    admin
      .from("agent_runs")
      .select("*", { count: "exact", head: true })
      .eq("triggered_by", opts.userId)
      .eq("agent_id", opts.agentId)
      .gte("created_at", sinceMinute),
    admin
      .from("agent_runs")
      .select("*", { count: "exact", head: true })
      .eq("triggered_by", opts.userId)
      .eq("agent_id", opts.agentId)
      .gte("created_at", sinceHour),
  ]);

  if ((minuteCount ?? 0) >= minuteLimit) {
    return { ok: false, retryAfter: 60, reason: `Demasiadas peticiones (${minuteLimit}/min). Reintenta en 1 minuto.` };
  }
  if ((hourCount ?? 0) >= hourLimit) {
    return { ok: false, retryAfter: 3600, reason: `Cuota horaria agotada (${hourLimit}/h).` };
  }
  return { ok: true };
}
