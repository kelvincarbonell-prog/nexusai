"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Empresa = { id: string; nombre: string };
type Run = {
  id: string;
  agent_id: string;
  source: string;
  status: "success" | "partial" | "failed";
  provider: string | null;
  duration_ms: number | null;
  cost_estimate: number | null;
  error: string | null;
  created_at: string;
};

const AGENT_LABELS: Record<string, string> = {
  "invoice-extractor": "Extractor de facturas",
  "expense-categorizer": "Categorizador de gastos",
  "duplicate-check": "Detector de duplicados",
  "quick-capture": "Captura rápida",
  "recordatorio": "Recordatorio de cobro",
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 4 }).format(n);

export function AgentRunsHistory({ empresas }: { empresas: Empresa[] }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch(`/api/agents/runs?empresa_id=${empresaId}`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setRuns(json.items ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const totals = useMemo(() => {
    const cost = runs.reduce((s, r) => s + Number(r.cost_estimate ?? 0), 0);
    const ok = runs.filter((r) => r.status === "success").length;
    const fail = runs.filter((r) => r.status === "failed").length;
    const partial = runs.filter((r) => r.status === "partial").length;
    return { cost, ok, fail, partial };
  }, [runs]);

  return (
    <article className="card span-12" style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span className="card-eyebrow">Historial de agentes IA</span>
          <h2 style={{ fontSize: 18, margin: "4px 0 0" }}>Últimas 50 ejecuciones</h2>
        </div>
        <div className="button-row">
          <span className="pill good">{totals.ok} OK</span>
          {totals.partial > 0 ? <span className="pill warn">{totals.partial} parcial</span> : null}
          {totals.fail > 0 ? <span className="pill bad">{totals.fail} fallos</span> : null}
          <span className="pill plain">≈ {EUR(totals.cost)}</span>
        </div>
      </div>

      <label className="label" style={{ maxWidth: 360 }}>
        Empresa
        <select className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </label>

      {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
      {loading ? <p className="muted">Cargando…</p> : null}

      {runs.length === 0 && !loading ? (
        <p className="muted" style={{ fontSize: 13 }}>Esta empresa aún no tiene ejecuciones de agentes.</p>
      ) : (
        <table className="table">
          <thead><tr><th>Cuándo</th><th>Agente</th><th>Origen</th><th>Estado</th><th>Proveedor</th><th className="num">Coste</th><th className="num">ms</th></tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                  {new Date(r.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                </td>
                <td>{AGENT_LABELS[r.agent_id] ?? r.agent_id}</td>
                <td><span className="pill plain" style={{ fontSize: 11 }}>{r.source}</span></td>
                <td>
                  <span className={`pill ${r.status === "success" ? "good" : r.status === "failed" ? "bad" : "warn"}`}>
                    {r.status}
                  </span>
                </td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{r.provider ?? "—"}</td>
                <td className="num">{r.cost_estimate != null ? EUR(Number(r.cost_estimate)) : "—"}</td>
                <td className="num">{r.duration_ms ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
