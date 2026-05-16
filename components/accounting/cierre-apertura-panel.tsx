"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Linea = { code: string; description: string; debit: number; credit: number };
type Preview = {
  resultado_ejercicio: number;
  ejercicio: number;
  regularizacion: Linea[];
  cierre: Linea[];
  apertura: Linea[];
  n_cuentas: number;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function CierreAperturaPanel({ empresaId, defaultEjercicio }: { empresaId: string; defaultEjercicio: number }) {
  const [ejercicio, setEjercicio] = useState(defaultEjercicio);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function token() {
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function generar(preview_only: boolean) {
    setLoading(!preview_only ? false : true);
    setPosting(!preview_only);
    setError(null);
    setSuccess(null);
    try {
      const tk = await token();
      const res = await fetch("/api/accounting/year-close", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId, ejercicio, preview: preview_only }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      if (preview_only) {
        setPreview(json as Preview);
      } else {
        setSuccess("Asientos de regularización, cierre y apertura registrados en el diario.");
        setPreview(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
      setPosting(false);
    }
  }

  return (
    <article className="card span-12">
      <div className="topbar" style={{ border: 0, padding: 0, margin: 0 }}>
        <div>
          <span className="card-eyebrow">Cierre y apertura</span>
          <h2 style={{ fontSize: 18, margin: "4px 0 0" }}>Regularización, cierre y apertura automáticos</h2>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            Calcula el resultado (grupos 6 y 7 contra la 129), genera el asiento de cierre y la apertura del siguiente
            ejercicio. Previsualiza antes de contabilizar.
          </p>
        </div>
        <div className="button-row">
          <input
            type="number"
            className="input compact"
            style={{ width: 100 }}
            value={ejercicio}
            onChange={(e) => setEjercicio(Number(e.target.value))}
            min={2020}
            max={2099}
          />
          <button className="button secondary" onClick={() => generar(true)} disabled={loading || posting}>
            {loading ? "Calculando…" : "Previsualizar"}
          </button>
          <button
            className="button"
            onClick={() => {
              if (!preview) return;
              if (!confirm(`Se contabilizarán ${preview.regularizacion.length + preview.cierre.length + preview.apertura.length} apuntes. ¿Continuar?`)) return;
              generar(false);
            }}
            disabled={!preview || posting}
          >
            {posting ? "Registrando…" : "Contabilizar"}
          </button>
        </div>
      </div>

      {error ? <p role="alert" style={{ color: "var(--bad)", marginTop: 12 }}>{error}</p> : null}
      {success ? <p role="status" style={{ color: "var(--good)", marginTop: 12 }}>{success}</p> : null}

      {preview ? (
        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <div className="grid">
            <article className="card span-6" style={{ borderColor: "var(--accent)" }}>
              <span className="card-eyebrow">Resultado del ejercicio {preview.ejercicio}</span>
              <div className="metric accent">{EUR(preview.resultado_ejercicio)}</div>
              <div className={`metric-foot ${preview.resultado_ejercicio >= 0 ? "good" : "bad"}`}>
                {preview.resultado_ejercicio >= 0 ? "Beneficio" : "Pérdida"} · {preview.n_cuentas} cuentas
              </div>
            </article>
            <article className="card span-6">
              <span className="card-eyebrow">Resumen</span>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                <li>{preview.regularizacion.length} líneas de regularización (6/7 vs. 129)</li>
                <li>{preview.cierre.length} líneas de asiento de cierre</li>
                <li>{preview.apertura.length} líneas de asiento de apertura</li>
              </ul>
            </article>
          </div>

          {[
            { title: "Regularización · 31/12", lineas: preview.regularizacion },
            { title: "Cierre · 31/12", lineas: preview.cierre },
            { title: `Apertura · 01/01/${preview.ejercicio + 1}`, lineas: preview.apertura },
          ].map((sec) => (
            <details key={sec.title}>
              <summary className="card-eyebrow" style={{ cursor: "pointer", marginBottom: 8 }}>
                {sec.title} · {sec.lineas.length} líneas
              </summary>
              <table className="table">
                <thead><tr><th>Cuenta</th><th>Concepto</th><th className="num">Debe</th><th className="num">Haber</th></tr></thead>
                <tbody>
                  {sec.lineas.slice(0, 50).map((l, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: "var(--mono)" }}>{l.code}</td>
                      <td>{l.description}</td>
                      <td className="num">{l.debit > 0 ? EUR(l.debit) : ""}</td>
                      <td className="num">{l.credit > 0 ? EUR(l.credit) : ""}</td>
                    </tr>
                  ))}
                  {sec.lineas.length > 50 ? (
                    <tr><td colSpan={4} className="muted">… y {sec.lineas.length - 50} líneas más</td></tr>
                  ) : null}
                </tbody>
              </table>
            </details>
          ))}
        </div>
      ) : null}
    </article>
  );
}
