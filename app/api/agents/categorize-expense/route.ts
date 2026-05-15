import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { categorizeExpense } from "@/lib/agents/expense-categorizer";
import { checkAgentRateLimit } from "@/lib/agents/rate-limit";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  vendor_name: z.string().max(180).optional(),
  vendor_nif: z.string().max(30).optional(),
  concepto: z.string().max(500).optional(),
  total: z.number().min(0).max(1_000_000).optional(),
  gasto_id: z.string().uuid().optional(),
  persist: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const rl = await checkAgentRateLimit({ userId: user.id, agentId: "expense-categorizer", perMinute: 60, perHour: 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: rl.reason },
      { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined },
    );
  }

  const start = Date.now();
  const result = await categorizeExpense({
    empresa_id: parsed.data.empresa_id,
    vendor_name: parsed.data.vendor_name,
    vendor_nif: parsed.data.vendor_nif,
    concepto: parsed.data.concepto,
    total: parsed.data.total,
  });

  if (!result) {
    await admin.from("agent_runs").insert({
      empresa_id: parsed.data.empresa_id,
      agent_id: "expense-categorizer",
      triggered_by: user.id,
      source: "manual",
      input: parsed.data,
      output: {},
      status: "failed",
      duration_ms: Date.now() - start,
    });
    return jsonError("No se pudo categorizar", 502);
  }

  if (parsed.data.persist) {
    await admin.from("expense_categorization_history").insert({
      empresa_id: parsed.data.empresa_id,
      vendor_nif: parsed.data.vendor_nif ?? null,
      vendor_name: parsed.data.vendor_name ?? null,
      concepto: parsed.data.concepto ?? null,
      pgc_account_code: result.pgc_account_code,
      pgc_account_id: result.pgc_account_id ?? null,
      gasto_id: parsed.data.gasto_id ?? null,
      confidence: result.confidence,
      learned_from: result.source,
      created_by: user.id,
    });
  }

  await admin.from("agent_runs").insert({
    empresa_id: parsed.data.empresa_id,
    agent_id: "expense-categorizer",
    triggered_by: user.id,
    source: "manual",
    input: parsed.data,
    output: result,
    status: "success",
    duration_ms: Date.now() - start,
    provider: result.source,
  });

  return NextResponse.json({ ok: true, result });
}
