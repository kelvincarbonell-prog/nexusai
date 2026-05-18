import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { bestAvailableJSON } from "@/lib/agents/llm";

/**
 * Asistente IA para el gestor: responde preguntas sobre su cartera entera.
 *
 * Filosofía:
 *   1. Lee solo datos del propio gestor (RLS lógico).
 *   2. Calcula KPIs agregados antes de llamar a la IA (no le pasa BBDD entera).
 *   3. Si la pregunta tiene respuesta directa con los KPIs, contesta sin IA.
 *   4. Si necesita lenguaje natural, llama a Gemini con el resumen.
 *
 * Ejemplos:
 *   - "¿Qué cliente tiene más facturas vencidas?"
 *   - "Resumen de la cartera esta semana"
 *   - "Cuantos modelos AEAT vencen en 7 días"
 */

const Schema = z.object({
  message: z.string().min(2).max(2000),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  const { data: profile } = await admin.from("perfiles").select("rol,nombre").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  // Empresas de su cartera
  const empresasQ = isAdmin
    ? admin.from("empresas").select("id,nombre,nif").order("nombre").limit(500)
    : admin.from("empresas").select("id,nombre,nif").or(`gestor_id.eq.${user.id},owner_user_id.eq.${user.id}`).limit(500);
  const { data: empresas } = await empresasQ;
  if (!empresas || empresas.length === 0) {
    return NextResponse.json({ ok: true, answer: "Todavía no tienes empresas en tu cartera. Crea la primera desde Clientes." });
  }
  const empresaIds = empresas.map((e) => e.id);

  // Resumen agregado en paralelo
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: scans }, { data: vencidas }, { count: facturasMes }, { count: gastosMes }] = await Promise.all([
    admin
      .from("bot_scans")
      .select("empresa_id,score,categoria,alertas_total,alertas_danger,alertas_warning")
      .in("empresa_id", empresaIds)
      .eq("fecha", today),
    admin
      .from("facturas")
      .select("id,empresa_id,total,contacto_nombre,fecha_vencimiento")
      .in("empresa_id", empresaIds)
      .in("tipo", ["emitida", "simplificada"])
      .neq("estado", "cobrada")
      .lt("fecha_vencimiento", today)
      .limit(100),
    admin.from("facturas").select("*", { count: "exact", head: true }).in("empresa_id", empresaIds).gte("fecha_emision", today.slice(0, 7) + "-01"),
    admin.from("gastos").select("*", { count: "exact", head: true }).in("empresa_id", empresaIds).gte("fecha", today.slice(0, 7) + "-01"),
  ]);

  const empresaById = new Map(empresas.map((e) => [e.id, e]));
  const cartera = {
    total_empresas: empresas.length,
    criticos: (scans ?? []).filter((s) => s.categoria === "critico").length,
    en_atencion: (scans ?? []).filter((s) => s.categoria === "atencion").length,
    al_dia: (scans ?? []).filter((s) => s.categoria === "al_dia").length,
    sin_scan: empresas.length - (scans?.length ?? 0),
  };

  const topCriticos = (scans ?? [])
    .filter((s) => s.categoria === "critico" || s.alertas_danger > 0)
    .sort((a, b) => Number(b.alertas_danger) - Number(a.alertas_danger))
    .slice(0, 5)
    .map((s) => ({ empresa: empresaById.get(s.empresa_id)?.nombre, alertas_danger: s.alertas_danger, score: s.score }));

  const totalVencido = (vencidas ?? []).reduce((s, f) => s + Number(f.total ?? 0), 0);
  const porEmpresaVencido = new Map<string, number>();
  for (const f of vencidas ?? []) porEmpresaVencido.set(f.empresa_id, (porEmpresaVencido.get(f.empresa_id) ?? 0) + Number(f.total ?? 0));
  const topMorosos = Array.from(porEmpresaVencido.entries())
    .map(([id, total]) => ({ empresa: empresaById.get(id)?.nombre, vencido: Math.round(total) }))
    .sort((a, b) => b.vencido - a.vencido)
    .slice(0, 5);

  const resumen = {
    cartera,
    top_criticos: topCriticos,
    facturas_vencidas: { count: vencidas?.length ?? 0, importe_total: Math.round(totalVencido), top: topMorosos },
    actividad_mes: { facturas_emitidas: facturasMes ?? 0, gastos_registrados: gastosMes ?? 0 },
  };

  // IA: convierte el resumen en respuesta natural a la pregunta
  const prompt = `Eres el asistente del gestor de una asesoría española. Te paso un resumen agregado de su cartera (no datos de BBDD) y una pregunta. Responde en español, conciso, profesional, máximo 4 frases. Si la pregunta no se puede responder con los datos, dilo claramente.

Pregunta del gestor:
"""${parsed.data.message.slice(0, 1500)}"""

Resumen real de su cartera (${empresas.length} empresas):
${JSON.stringify(resumen, null, 2)}

Devuelve SOLO un texto plano. Sin JSON. Sin código.`;

  try {
    const llm = await bestAvailableJSON(prompt);
    if (llm.ok && llm.text) {
      const respuesta = llm.text.replace(/^```[a-z]*\n?|\n?```$/g, "").trim();
      return NextResponse.json({ ok: true, answer: respuesta, source: "ai", resumen });
    }
  } catch {
    // ignora
  }

  // Fallback: respuesta estructurada sin IA
  const partes: string[] = [];
  partes.push(`Tienes ${cartera.total_empresas} empresas en cartera.`);
  if (cartera.criticos > 0) partes.push(`${cartera.criticos} en estado crítico.`);
  if (vencidas && vencidas.length > 0) partes.push(`${vencidas.length} facturas vencidas (${Math.round(totalVencido).toLocaleString("es-ES")} €).`);
  if (cartera.criticos === 0 && cartera.en_atencion === 0) partes.push("Todo bajo control.");
  return NextResponse.json({ ok: true, answer: partes.join(" "), source: "fallback", resumen });
}
