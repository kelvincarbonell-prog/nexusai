import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { bestAvailableJSON, safeJSON } from "@/lib/agents/llm";
import { checkAgentRateLimit } from "@/lib/agents/rate-limit";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  query: z.string().min(2).max(500),
});

const INTENTS = [
  "iva_trimestre",
  "iva_mes",
  "facturas_pendientes",
  "facturas_mes",
  "gastos_mes",
  "gastos_categoria",
  "trabajadores_activos",
  "vacaciones_disponibles",
  "fichaje_estado",
  "saldo_tesoreria",
  "ayuda_general",
  "desconocido",
];

type IntentResult = { intent: string; periodo?: string; trabajador?: string; categoria?: string };

function currentQuarter() {
  const month = new Date().getUTCMonth() + 1;
  return Math.ceil(month / 3);
}

function quarterMonths(quarter: number, year: number): { from: string; to: string } {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  return {
    from: `${year}-${String(startMonth).padStart(2, "0")}-01`,
    to: `${year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const rl = await checkAgentRateLimit({ userId: user.id, agentId: "voice-assistant", perMinute: 30, perHour: 500 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: rl.reason },
      { status: 429, headers: rl.retryAfter ? { "Retry-After": String(rl.retryAfter) } : undefined },
    );
  }

  const intentPrompt = `Eres el clasificador de intención del asistente de voz de Modelo 26 para asesorías españolas.
Devuelve SOLO JSON: { "intent": uno de [${INTENTS.join(", ")}], "periodo": "Tn" o "YYYY-MM" o null, "trabajador": string o null, "categoria": string o null }

Ejemplos:
- "¿cuánto IVA llevo este trimestre?" -> {"intent":"iva_trimestre","periodo":"T${currentQuarter()}"}
- "facturas pendientes" -> {"intent":"facturas_pendientes"}
- "vacaciones de Juan" -> {"intent":"vacaciones_disponibles","trabajador":"Juan"}
- "gastos en transporte este mes" -> {"intent":"gastos_categoria","categoria":"transporte","periodo":"${new Date().toISOString().slice(0, 7)}"}

Pregunta del usuario: "${parsed.data.query}"`;

  const intentRes = await bestAvailableJSON(intentPrompt);
  const intent = safeJSON<IntentResult>(intentRes.text) ?? { intent: "desconocido" };

  const empresaId = parsed.data.empresa_id;
  let response = "";

  if (intent.intent === "iva_trimestre" || intent.intent === "iva_mes") {
    const now = new Date();
    let from: string, to: string;
    if (intent.intent === "iva_trimestre") {
      const q = intent.periodo?.match(/^T([1-4])$/);
      const quarter = q ? Number(q[1]) : currentQuarter();
      ({ from, to } = quarterMonths(quarter, now.getUTCFullYear()));
    } else {
      const m = intent.periodo?.match(/^(\d{4})-(\d{2})$/);
      const year = m ? Number(m[1]) : now.getUTCFullYear();
      const month = m ? Number(m[2]) : now.getUTCMonth() + 1;
      const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
      from = `${year}-${String(month).padStart(2, "0")}-01`;
      to = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    }
    const [{ data: emit }, { data: rec }] = await Promise.all([
      admin.from("facturas").select("iva").eq("empresa_id", empresaId).eq("tipo", "emitida").gte("fecha_emision", from).lte("fecha_emision", to),
      admin.from("facturas").select("iva").eq("empresa_id", empresaId).eq("tipo", "recibida").gte("fecha_emision", from).lte("fecha_emision", to),
    ]);
    const repercutido = (emit ?? []).reduce((s, r) => s + Number(r.iva ?? 0), 0);
    const soportado = (rec ?? []).reduce((s, r) => s + Number(r.iva ?? 0), 0);
    const liquidar = repercutido - soportado;
    response = `IVA del periodo ${from} a ${to}: repercutido ${repercutido.toFixed(2)} €, soportado ${soportado.toFixed(2)} €. ${liquidar >= 0 ? "A pagar" : "A devolver"}: ${Math.abs(liquidar).toFixed(2)} €.`;
  } else if (intent.intent === "facturas_pendientes") {
    const { data } = await admin
      .from("facturas")
      .select("id,total,estado,fecha_vencimiento")
      .eq("empresa_id", empresaId)
      .neq("estado", "cobrada")
      .eq("tipo", "emitida");
    const total = (data ?? []).reduce((s, f) => s + Number(f.total ?? 0), 0);
    response = `Tienes ${data?.length ?? 0} facturas pendientes de cobro por un total de ${total.toFixed(2)} €.`;
  } else if (intent.intent === "trabajadores_activos") {
    const { count } = await admin
      .from("trabajadores")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("activo", true);
    response = `Actualmente hay ${count ?? 0} trabajadores activos.`;
  } else if (intent.intent === "fichaje_estado") {
    const today = new Date().toISOString().slice(0, 10);
    const { count: openCount } = await admin
      .from("registro_horario")
      .select("*", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("fecha", today)
      .is("hora_salida", null);
    response = `Hoy hay ${openCount ?? 0} fichajes abiertos sin salida.`;
  } else if (intent.intent === "vacaciones_disponibles") {
    const { data } = await admin
      .from("ausencias")
      .select("tipo,dias,estado,trabajador_id")
      .eq("empresa_id", empresaId)
      .eq("tipo", "vacaciones")
      .gte("fecha_inicio", `${new Date().getUTCFullYear()}-01-01`);
    const total = (data ?? []).filter((a) => a.estado === "aprobada").reduce((s, a) => s + Number(a.dias ?? 0), 0);
    response = `En lo que va de año se han aprobado ${total} días de vacaciones.`;
  } else if (intent.intent === "gastos_mes" || intent.intent === "gastos_categoria") {
    const month = intent.periodo ?? new Date().toISOString().slice(0, 7);
    const [year, m] = month.split("-");
    const last = new Date(Date.UTC(Number(year), Number(m), 0)).getUTCDate();
    const from = `${month}-01`;
    const to = `${month}-${String(last).padStart(2, "0")}`;
    const { data } = await admin
      .from("gastos")
      .select("total,concepto")
      .eq("empresa_id", empresaId)
      .gte("fecha", from)
      .lte("fecha", to);
    let rows = data ?? [];
    if (intent.intent === "gastos_categoria" && intent.categoria) {
      rows = rows.filter((g) => g.concepto?.toLowerCase().includes((intent.categoria ?? "").toLowerCase()));
    }
    const total = rows.reduce((s, r) => s + Number(r.total ?? 0), 0);
    response = `Gastos${intent.categoria ? ` de ${intent.categoria}` : ""} en ${month}: ${total.toFixed(2)} € (${rows.length} apuntes).`;
  } else {
    response = "No tengo aún una consulta automatizada para eso. Pregunta por IVA, facturas pendientes, gastos, trabajadores activos, vacaciones o fichajes.";
  }

  await admin.from("agent_runs").insert({
    empresa_id: empresaId,
    agent_id: "voice-assistant",
    triggered_by: user.id,
    source: "voz",
    input: { query: parsed.data.query, intent: intent.intent },
    output: { response },
    status: "success",
    provider: intentRes.provider,
  });

  return NextResponse.json({ ok: true, intent: intent.intent, response });
}
