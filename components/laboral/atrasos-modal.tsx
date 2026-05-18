"use client";

import { useState } from "react";
import { Receipt, TriangleAlert } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Trabajador = { id: string; nombre: string };

type Linea = { periodo: string; bruto_pagado: number; bruto_nuevo: number; diferencia: number };
type Result = { lineas: Linea[]; total_diferencia: number; warnings: string[] };

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

const hoy = new Date();
const isoMes = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
const seisMesesAtras = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 5, 1));

/**
 * Modal de atrasos retroactivos. Útil cuando se firma un convenio o se sube
 * el sueldo con efectos desde un mes anterior y hay que abonar la
 * diferencia de meses ya cerrados.
 */
export function AtrasosModal({ empresaId, trabajador, onClose }: { empresaId: string; trabajador: Trabajador; onClose: () => void }) {
  const [desde, setDesde] = useState(isoMes(seisMesesAtras));
  const [hasta, setHasta] = useState(isoMes(new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1))));
  const [bruto, setBruto] = useState<number | "">("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function calcular() {
    if (!bruto || Number(bruto) <= 0) {
      setError("Indica el nuevo bruto mensual.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const supabase = createBrowserSupabase();
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/laboral/atrasos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          empresa_id: empresaId,
          trabajador_id: trabajador.id,
          desde,
          hasta,
          nuevo_bruto_mensual: Number(bruto),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setResult(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 999, display: "grid", placeItems: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ maxWidth: 720, width: "100%", display: "grid", gap: 16 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <span className="card-eyebrow"><Receipt size={12} style={{ verticalAlign: "middle" }} /> Atrasos retroactivos</span>
            <h2 style={{ fontSize: 20, margin: "4px 0 0" }}>{trabajador.nombre}</h2>
            <p className="muted" style={{ fontSize: 12, margin: "2px 0 0" }}>
              Compara las nóminas ya cerradas con el nuevo bruto y calcula la diferencia a abonar.
            </p>
          </div>
          <button className="button ghost compact" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="form three-cols">
          <label className="label">
            Desde (mes)
            <input type="month" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="label">
            Hasta (mes)
            <input type="month" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <label className="label">
            Nuevo bruto mensual (€)
            <input
              type="number"
              min={0}
              step="0.01"
              className="input"
              value={bruto}
              onChange={(e) => setBruto(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="1.800,00"
            />
          </label>
        </div>

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}

        {result ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="metric accent">{EUR(result.total_diferencia)}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Total a abonar como atraso · {result.lineas.length} mes{result.lineas.length === 1 ? "" : "es"}.
            </div>

            {result.warnings.length > 0 ? (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4 }}>
                {result.warnings.map((w, i) => (
                  <li key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--warn, #f59e0b)" }}>
                    <TriangleAlert size={12} /> {w}
                  </li>
                ))}
              </ul>
            ) : null}

            {result.lineas.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Periodo</th>
                    <th className="num">Bruto pagado</th>
                    <th className="num">Bruto nuevo</th>
                    <th className="num">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {result.lineas.map((l) => (
                    <tr key={l.periodo}>
                      <td style={{ fontFamily: "var(--mono, monospace)" }}>{l.periodo}</td>
                      <td className="num">{EUR(l.bruto_pagado)}</td>
                      <td className="num">{EUR(l.bruto_nuevo)}</td>
                      <td className="num" style={{ color: l.diferencia >= 0 ? "var(--good)" : "var(--bad)", fontWeight: 600 }}>
                        {EUR(l.diferencia)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            <p className="muted" style={{ fontSize: 11, margin: 0 }}>
              Cuando lo pidas, podrás añadir este importe como concepto especial en la próxima nómina del trabajador.
            </p>
          </div>
        ) : null}

        <div className="button-row" style={{ justifyContent: "flex-end" }}>
          <button className="button" onClick={calcular} disabled={loading}>
            {loading ? "Calculando…" : "Calcular atrasos"}
          </button>
        </div>
      </div>
    </div>
  );
}
