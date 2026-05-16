"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Trabajador = { id: string; nombre: string; dni?: string };

const CAUSAS = [
  { key: "despido_improcedente", label: "Despido improcedente" },
  { key: "despido_objetivo", label: "Despido objetivo" },
  { key: "fin_contrato", label: "Fin de contrato" },
  { key: "dimision", label: "Dimisión" },
  { key: "mutuo_acuerdo", label: "Mutuo acuerdo" },
  { key: "jubilacion", label: "Jubilación" },
];

type Result = {
  salario_dia: number;
  dias_vacaciones_pendientes: number;
  importe_vacaciones: number;
  importe_pagas_extras_prorrateadas: number;
  importe_dias_trabajados_mes: number;
  indemnizacion: number;
  bruto: number;
  irpf: number;
  neto: number;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function FiniquitoModal({ empresaId, trabajador, onClose }: { empresaId: string; trabajador: Trabajador; onClose: () => void }) {
  const [fechaBaja, setFechaBaja] = useState(new Date().toISOString().slice(0, 10));
  const [causa, setCausa] = useState<string>("despido_improcedente");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function token() {
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function calcular() {
    setLoading(true);
    setError(null);
    try {
      const tk = await token();
      const res = await fetch("/api/laboral/finiquito", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId, trabajador_id: trabajador.id, fecha_baja: fechaBaja, causa }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setResult(json.result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function descargarPdf() {
    setDownloading(true);
    setError(null);
    try {
      const tk = await token();
      const res = await fetch("/api/laboral/finiquito/pdf", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ trabajador_id: trabajador.id, fecha_baja: fechaBaja, causa }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finiquito-${trabajador.dni ?? trabajador.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 999,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ maxWidth: 640, width: "100%", display: "grid", gap: 16 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <span className="card-eyebrow">Finiquito</span>
            <h2 style={{ fontSize: 20, margin: "4px 0 0" }}>{trabajador.nombre}</h2>
          </div>
          <button className="button ghost compact" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="form two-cols">
          <label className="label">
            Fecha de baja
            <input type="date" className="input" value={fechaBaja} onChange={(e) => setFechaBaja(e.target.value)} />
          </label>
          <label className="label">
            Causa
            <select className="input" value={causa} onChange={(e) => setCausa(e.target.value)}>
              {CAUSAS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </label>
        </div>

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}

        {result ? (
          <div style={{ display: "grid", gap: 8 }}>
            <div className="metric accent">{EUR(result.neto)}</div>
            <div className="muted" style={{ fontSize: 12 }}>Bruto {EUR(result.bruto)} · IRPF {EUR(result.irpf)}</div>
            <table className="table" style={{ marginTop: 8 }}>
              <tbody>
                <tr><td>Salario / día</td><td className="num">{EUR(result.salario_dia)}</td></tr>
                <tr><td>Vacaciones pendientes</td><td className="num">{result.dias_vacaciones_pendientes} días · {EUR(result.importe_vacaciones)}</td></tr>
                <tr><td>Pagas extras prorrateadas</td><td className="num">{EUR(result.importe_pagas_extras_prorrateadas)}</td></tr>
                <tr><td>Días trabajados del mes</td><td className="num">{EUR(result.importe_dias_trabajados_mes)}</td></tr>
                <tr><td>Indemnización</td><td className="num">{EUR(result.indemnizacion)}</td></tr>
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="button-row" style={{ justifyContent: "flex-end" }}>
          <button className="button secondary" onClick={calcular} disabled={loading}>
            {loading ? "Calculando…" : "Calcular"}
          </button>
          <button className="button" onClick={descargarPdf} disabled={downloading}>
            {downloading ? "Generando PDF…" : "Descargar PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
