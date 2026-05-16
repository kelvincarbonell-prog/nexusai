"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Inputs = {
  operaciones_con_derecho: number;
  operaciones_sin_derecho: number;
  iva_soportado_total: number;
  iva_soportado_uso_exclusivo_con_derecho?: number;
  iva_soportado_uso_exclusivo_sin_derecho?: number;
  iva_soportado_uso_mixto?: number;
};

type Result = {
  pct_general: number;
  iva_deducible_general: number;
  pct_especial: number | null;
  iva_deducible_especial: number | null;
  diferencia_pct: number | null;
  recomendado: "general" | "especial";
  warnings: string[];
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function ProrrataCalculator() {
  const [inputs, setInputs] = useState<Inputs>({
    operaciones_con_derecho: 0,
    operaciones_sin_derecho: 0,
    iva_soportado_total: 0,
    iva_soportado_uso_exclusivo_con_derecho: 0,
    iva_soportado_uso_exclusivo_sin_derecho: 0,
    iva_soportado_uso_mixto: 0,
  });
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof Inputs>(k: K, v: Inputs[K]) {
    setInputs((p) => ({ ...p, [k]: v }));
  }

  async function calcular() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/aeat/prorrata", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      const { ok: _ok, ...rest } = json;
      void _ok;
      setResult(rest as Result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid">
      <article className="card span-12">
        <span className="card-eyebrow">Datos para la prorrata</span>
        <div className="form two-cols" style={{ marginTop: 12 }}>
          <label className="label">
            Operaciones con derecho a deducir (€)
            <input
              type="number"
              step="0.01"
              className="input"
              value={inputs.operaciones_con_derecho}
              onChange={(e) => set("operaciones_con_derecho", Number(e.target.value))}
            />
          </label>
          <label className="label">
            Operaciones sin derecho a deducir (€)
            <input
              type="number"
              step="0.01"
              className="input"
              value={inputs.operaciones_sin_derecho}
              onChange={(e) => set("operaciones_sin_derecho", Number(e.target.value))}
            />
          </label>
          <label className="label">
            IVA soportado total (€)
            <input
              type="number"
              step="0.01"
              className="input"
              value={inputs.iva_soportado_total}
              onChange={(e) => set("iva_soportado_total", Number(e.target.value))}
            />
          </label>
          <label className="label">
            IVA uso exclusivo con derecho (€)
            <input
              type="number"
              step="0.01"
              className="input"
              value={inputs.iva_soportado_uso_exclusivo_con_derecho}
              onChange={(e) => set("iva_soportado_uso_exclusivo_con_derecho", Number(e.target.value))}
            />
          </label>
          <label className="label">
            IVA uso exclusivo sin derecho (€)
            <input
              type="number"
              step="0.01"
              className="input"
              value={inputs.iva_soportado_uso_exclusivo_sin_derecho}
              onChange={(e) => set("iva_soportado_uso_exclusivo_sin_derecho", Number(e.target.value))}
            />
          </label>
          <label className="label">
            IVA uso mixto (€)
            <input
              type="number"
              step="0.01"
              className="input"
              value={inputs.iva_soportado_uso_mixto}
              onChange={(e) => set("iva_soportado_uso_mixto", Number(e.target.value))}
            />
          </label>
        </div>
        <div className="button-row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button className="button" onClick={calcular} disabled={loading}>
            {loading ? "Calculando…" : "Calcular prorrata"}
          </button>
        </div>
        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
      </article>

      {result ? (
        <>
          <article className="card span-6" style={{ borderColor: "var(--accent)" }}>
            <span className="card-eyebrow">Prorrata general</span>
            <div className="metric accent">{result.pct_general} %</div>
            <div className="metric-foot">IVA deducible {EUR(result.iva_deducible_general)}</div>
          </article>
          <article className="card span-6">
            <span className="card-eyebrow">Prorrata especial</span>
            <div className="metric">{result.pct_especial != null ? `${result.pct_especial.toFixed(0)} %` : "—"}</div>
            <div className="metric-foot">
              {result.iva_deducible_especial != null
                ? `IVA deducible ${EUR(result.iva_deducible_especial)}`
                : "Sin datos de uso exclusivo/mixto"}
            </div>
          </article>
          <article className="card span-12" style={{ borderColor: result.recomendado === "especial" ? "var(--warn)" : "var(--accent)" }}>
            <span className={`card-eyebrow ${result.recomendado === "especial" ? "warn" : ""}`}>Recomendación</span>
            <p style={{ fontSize: 16, marginTop: 6 }}>
              {result.recomendado === "especial"
                ? "Debes aplicar la prorrata especial (diferencia > 10 puntos)."
                : "Puedes aplicar la prorrata general."}
            </p>
            {result.diferencia_pct != null ? (
              <small className="muted">Diferencia general vs especial: {result.diferencia_pct.toFixed(0)} pp</small>
            ) : null}
            {result.warnings.length > 0 ? (
              <ul style={{ margin: "12px 0 0", paddingLeft: 18, fontSize: 13 }}>
                {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            ) : null}
          </article>
        </>
      ) : null}
    </section>
  );
}
