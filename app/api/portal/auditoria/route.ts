import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

/**
 * Audit timeline for a client. Aggregates events that mention the empresa_id
 * across high-signal tables: aeat_declaraciones, facturas, gastos, nominas,
 * agent_runs, automation_executions.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");
  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);

  const [decl, fac, gas, nom, runs] = await Promise.all([
    admin
      .from("aeat_declaraciones")
      .select("modelo,periodo,ejercicio,status,updated_at")
      .eq("empresa_id", empresaId)
      .order("updated_at", { ascending: false })
      .limit(15),
    admin
      .from("facturas")
      .select("id,numero,tipo,total,estado,fecha_emision,created_at")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(15),
    admin
      .from("gastos")
      .select("id,proveedor,concepto,total,estado,fecha,created_at")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(15),
    admin
      .from("nominas")
      .select("id,periodo,total,estado,updated_at")
      .eq("empresa_id", empresaId)
      .order("updated_at", { ascending: false })
      .limit(10),
    admin
      .from("agent_runs")
      .select("id,agent_id,status,source,created_at,provider")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  type Evt = { kind: string; when: string; title: string; meta?: string };
  const events: Evt[] = [];
  for (const d of decl.data ?? []) {
    events.push({
      kind: "aeat",
      when: d.updated_at,
      title: `Modelo ${d.modelo} ${d.periodo} ${d.ejercicio} · ${d.status}`,
    });
  }
  for (const f of fac.data ?? []) {
    events.push({
      kind: f.tipo === "emitida" ? "factura_emit" : "factura_reci",
      when: f.created_at,
      title: `${f.tipo === "emitida" ? "Emitida" : "Recibida"} ${f.numero ?? f.id.slice(0, 8)} · ${f.estado}`,
      meta: f.total ? `${Number(f.total).toFixed(2)} €` : undefined,
    });
  }
  for (const g of gas.data ?? []) {
    events.push({
      kind: "gasto",
      when: g.created_at,
      title: `Gasto ${g.proveedor ?? ""}: ${g.concepto ?? ""}`,
      meta: g.total ? `${Number(g.total).toFixed(2)} €` : undefined,
    });
  }
  for (const n of nom.data ?? []) {
    events.push({
      kind: "nomina",
      when: n.updated_at,
      title: `Nómina ${n.periodo} · ${n.estado}`,
      meta: n.total ? `${Number(n.total).toFixed(2)} €` : undefined,
    });
  }
  for (const r of runs.data ?? []) {
    events.push({
      kind: "agent",
      when: r.created_at,
      title: `Agente ${r.agent_id} · ${r.status}`,
      meta: r.provider ?? undefined,
    });
  }

  events.sort((a, b) => b.when.localeCompare(a.when));
  return NextResponse.json({ ok: true, events: events.slice(0, 80) });
}
