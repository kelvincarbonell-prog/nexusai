import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { getAgent, resolveTemplate, coerceTypes } from "@/lib/agents/catalogo";

const Schema = z.object({
  agent_id: z.string().min(1),
  empresa_id: z.string().uuid(),
  inputs: z.record(z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])).default({}),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const agent = getAgent(parsed.data.agent_id);
  if (!agent) return jsonError("Agente no encontrado", 404);

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  // Resolver placeholders y normalizar tipos
  const normalizedInputs: Record<string, string | number | undefined> = {};
  for (const [k, v] of Object.entries(parsed.data.inputs)) {
    if (v == null) continue;
    normalizedInputs[k] = typeof v === "boolean" ? String(v) : (v as string | number);
  }

  const endpoint = String(resolveTemplate(agent.action.endpoint, parsed.data.empresa_id, normalizedInputs));
  const body = agent.action.body
    ? coerceTypes(resolveTemplate(agent.action.body, parsed.data.empresa_id, normalizedInputs))
    : null;
  const query = agent.action.query
    ? (resolveTemplate(agent.action.query, parsed.data.empresa_id, normalizedInputs) as Record<string, string>)
    : null;

  // Construir URL absoluta hacia el propio endpoint interno.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const url = new URL(endpoint, baseUrl);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const authHeader = request.headers.get("authorization");
  const startedAt = Date.now();

  let resp: Response;
  try {
    resp = await fetch(url.toString(), {
      method: agent.action.method,
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: body && agent.action.method !== "GET" ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    return jsonError(`Fallo de red ejecutando agente: ${e instanceof Error ? e.message : String(e)}`, 500);
  }

  const payload = await resp.json().catch(() => ({}));
  const duration = Date.now() - startedAt;

  // Registrar en agent_runs (no falla la respuesta si esto falla)
  try {
    await admin
      .from("agent_runs")
      .insert({
        empresa_id: parsed.data.empresa_id,
        agent_id: agent.id,
        triggered_by: user.id,
        source: "manual",
        input: normalizedInputs,
        output: { status: resp.status, payload: typeof payload === "object" ? payload : { value: payload } },
        status: resp.ok ? "success" : "failed",
        duration_ms: duration,
        error: resp.ok ? null : (typeof (payload as { error?: string }).error === "string" ? (payload as { error?: string }).error : `HTTP ${resp.status}`),
      });
  } catch {
    // ignore log error
  }

  if (!resp.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: (payload as { error?: string }).error ?? `HTTP ${resp.status}`,
        agent_id: agent.id,
        duration_ms: duration,
      },
      { status: resp.status },
    );
  }

  return NextResponse.json({
    ok: true,
    agent_id: agent.id,
    renderer: agent.resultRenderer ?? "json",
    duration_ms: duration,
    result: payload,
  });
}
