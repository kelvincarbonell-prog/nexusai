"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Empresa = { id: string; nombre: string; nif?: string };

type Inputs202 = {
  modalidad: "A" | "B";
  periodo: "1P" | "2P" | "3P";
  cuota_is_ejercicio_anterior?: number;
  base_imponible_acumulada?: number;
  retenciones_acumuladas?: number;
  pagos_fraccionados_anteriores?: number;
  cifra_negocios?: number;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

const PAGO_TO_TRIM: Record<"1P" | "2P" | "3P", "1T" | "2T" | "4T"> = { "1P": "1T", "2P": "2T", "3P": "4T" };

export function Casillas202({ empresas }: { empresas: Empresa[] }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const defaultYear = new Date().getUTCFullYear();
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [ejercicio, setEjercicio] = useState(defaultYear);
  const [inputs, setInputs] = useState<Inputs202>({ modalidad: "A", periodo: "1P" });
  const [casillas, setCasillas] = useState<Record<string, number>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [declaracion, setDeclaracion] = useState<{ status: string; updated_at: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const empresa = useMemo(() => empresas.find((e) => e.id === empresaId), [empresas, empresaId]);
  const periodoTrim = PAGO_TO_TRIM[inputs.periodo];

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const tk = await token();
      const res = await fetch(`/api/aeat/202?empresa_id=${empresaId}&ejercicio=${ejercicio}&periodo=${periodoTrim}`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setCasillas(json.casillas);
      setWarnings(json.warnings ?? []);
      setDeclaracion(json.declaracion);
      const ia = (json.resumen?.inputs_aplicados ?? {}) as Partial<Inputs202>;
      setInputs((prev) => ({
        ...prev,
        ...ia,
        modalidad: prev.modalidad,
        periodo: prev.periodo,
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, ejercicio, inputs.modalidad, inputs.periodo]);

  async function guardar(status: "borrador" | "revisado" | "presentado") {
    if (!empresaId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const tk = await token();
      const res = await fetch(`/api/aeat/202`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresaId,
          ejercicio,
          periodo: periodoTrim,
          status,
          inputs_202: inputs,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setCasillas((json.declaracion?.casillas as Record<string, number>) ?? casillas);
      setDeclaracion(json.declaracion);
      setSuccess(status === "presentado" ? "Marcado como presentado." : `Guardado (${status}).`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  function setField<K extends keyof Inputs202>(k: K, v: Inputs202[K]) {
    setInputs((prev) => ({ ...prev, [k]: v }));
  }

  const numField = (v: number | undefined) => (v === undefined || Number.isNaN(v) ? "" : v);

  return (
    <section className="grid">
      <header className="card span-12" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span className="card-eyebrow">Modelo 202 · Pago fraccionado IS</span>
            <h2 className="title" style={{ fontSize: 28, marginTop: 6 }}>
              {empresa?.nombre ?? "Selecciona empresa"} <em>{inputs.periodo} {ejercicio}</em>
            </h2>
            <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>
              Pago a cuenta del Impuesto sobre Sociedades. 1P (1-20 abril), 2P (1-20 octubre), 3P (1-20 diciembre).
              Modalidad A (art. 40.2 LIS): 18 % sobre cuota del año anterior. Modalidad B (art. 40.3): sobre BI
              acumulada (obligatoria si cifra de negocios ≥ 6 M €).
            </p>
          </div>
          <div style={{ display: "grid", gap: 6, alignContent: "start" }}>
            <span className={`pill ${declaracion?.status === "presentado" ? "good" : declaracion?.status === "revisado" ? "accent" : "warn"}`}>
              {declaracion?.status ?? "no iniciado"}
            </span>
          </div>
        </div>

        <div className="form three-cols">
          <label className="label">
            Empresa
            <select className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </label>
          <label className="label">
            Ejercicio
            <select className="input" value={ejercicio} onChange={(e) => setEjercicio(Number(e.target.value))}>
              {[defaultYear, defaultYear - 1, defaultYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="label">
            Periodo
            <select className="input" value={inputs.periodo} onChange={(e) => setField("periodo", e.target.value as "1P" | "2P" | "3P")}>
              <option value="1P">1P · abril (datos a marzo)</option>
              <option value="2P">2P · octubre (datos a septiembre)</option>
              <option value="3P">3P · diciembre (datos a noviembre)</option>
            </select>
          </label>
          <label className="label">
            Modalidad
            <select className="input" value={inputs.modalidad} onChange={(e) => setField("modalidad", e.target.value as "A" | "B")}>
              <option value="A">A · cuota anterior × 18 %</option>
              <option value="B">B · BI acumulada × tipo</option>
            </select>
          </label>
          <label className="label">
            Cifra de negocios ejercicio anterior
            <input
              type="number"
              step="0.01"
              className="input"
              value={numField(inputs.cifra_negocios)}
              onChange={(e) => setField("cifra_negocios", e.target.value === "" ? undefined : Number(e.target.value))}
              placeholder="0,00"
            />
          </label>
        </div>

        {inputs.modalidad === "A" ? (
          <div className="form two-cols">
            <label className="label">
              Cuota IS del ejercicio anterior (casilla 599 del 200)
              <input
                type="number"
                step="0.01"
                className="input"
                value={numField(inputs.cuota_is_ejercicio_anterior)}
                onChange={(e) => setField("cuota_is_ejercicio_anterior", e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="Se autorrellena con el 200 del año anterior"
              />
            </label>
          </div>
        ) : (
          <div className="form three-cols">
            <label className="label">
              BI acumulada (resultado contable hasta fin periodo)
              <input
                type="number"
                step="0.01"
                className="input"
                value={numField(inputs.base_imponible_acumulada)}
                onChange={(e) => setField("base_imponible_acumulada", e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="Auto desde libro diario"
              />
            </label>
            <label className="label">
              Retenciones acumuladas
              <input
                type="number"
                step="0.01"
                className="input"
                value={numField(inputs.retenciones_acumuladas)}
                onChange={(e) => setField("retenciones_acumuladas", e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="0,00"
              />
            </label>
            <label className="label">
              Pagos fraccionados previos (1P/2P)
              <input
                type="number"
                step="0.01"
                className="input"
                value={numField(inputs.pagos_fraccionados_anteriores)}
                onChange={(e) => setField("pagos_fraccionados_anteriores", e.target.value === "" ? undefined : Number(e.target.value))}
                placeholder="Auto desde 202 previos"
              />
            </label>
          </div>
        )}

        {warnings.length > 0 ? (
          <div className="copilot-card" style={{ background: "rgba(251, 191, 36, 0.08)", borderColor: "var(--warn)" }}>
            <span className="card-eyebrow warn">Revisa antes de presentar</span>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        ) : null}

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
        {success ? <p role="status" style={{ color: "var(--good)" }}>{success}</p> : null}
        {loading ? <p className="muted">Calculando…</p> : null}
      </header>

      <article className="card span-12" style={{ borderColor: "var(--accent)" }}>
        <span className="card-eyebrow">Resultado a ingresar</span>
        <div className="metric accent">{EUR(Math.abs(casillas.c14 ?? 0))}</div>
        <div className={`metric-foot ${(casillas.c14 ?? 0) >= 0 ? "warn" : "accent"}`}>
          {(casillas.c14 ?? 0) >= 0 ? "A ingresar a Hacienda" : "Sin importe (modalidad sin cuota)"}
        </div>
      </article>

      <article className="card span-12">
        <span className="card-eyebrow">Casillas modelo 202</span>
        <table className="table" style={{ marginTop: 8 }}>
          <thead><tr><th style={{ width: 90 }}>Casilla</th><th>Concepto</th><th className="num">Valor</th></tr></thead>
          <tbody>
            <tr><td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>01</td><td>Base de cálculo</td><td className="num">{EUR(casillas.c01 ?? 0)}</td></tr>
            <tr><td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>03</td><td>Porcentaje aplicable</td><td className="num">{(casillas.c03 ?? 0).toFixed(0)} %</td></tr>
            <tr><td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>04</td><td>Cuota del cálculo</td><td className="num">{EUR(casillas.c04 ?? 0)}</td></tr>
            {inputs.modalidad === "B" ? (
              <>
                <tr><td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>10</td><td>Retenciones acumuladas</td><td className="num">{EUR(casillas.c10 ?? 0)}</td></tr>
                <tr><td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>12</td><td>Pagos fraccionados anteriores</td><td className="num">{EUR(casillas.c12 ?? 0)}</td></tr>
              </>
            ) : null}
            <tr style={{ background: "var(--accent-soft)" }}>
              <td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>14</td>
              <td><strong>A ingresar</strong></td>
              <td className="num" style={{ fontWeight: 700 }}>{EUR(casillas.c14 ?? 0)}</td>
            </tr>
          </tbody>
        </table>
      </article>

      <div className="card span-12" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div className="muted" style={{ fontSize: 13, maxWidth: 520 }}>
          Si no hay datos contables completos, introduce manualmente la BI acumulada. Guarda como presentado
          cuando lo envíes a AEAT.
        </div>
        <div className="button-row">
          <button className="button secondary" onClick={load} disabled={loading || saving}>↻ Recalcular</button>
          <button className="button secondary" onClick={() => guardar("borrador")} disabled={saving || !empresaId}>Guardar borrador</button>
          <button className="button" onClick={() => guardar("presentado")} disabled={saving || !declaracion}>Marcar presentado ✓</button>
        </div>
      </div>
    </section>
  );
}
