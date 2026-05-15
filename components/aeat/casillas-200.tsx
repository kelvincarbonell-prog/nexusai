"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Empresa = { id: string; nombre: string; nif?: string };

type Inputs200 = {
  resultado_contable?: number;
  ajuste_aumento_permanente?: number;
  ajuste_disminucion_permanente?: number;
  ajuste_aumento_temporal?: number;
  ajuste_disminucion_temporal?: number;
  compensacion_bin?: number;
  bin_disponible?: number;
  tipo_gravamen?: "general" | "nueva_creacion" | "pyme" | "otro";
  tipo_gravamen_custom?: number;
  deduccion_id_i?: number;
  deduccion_doble_imposicion?: number;
  deduccion_donativos?: number;
  deduccion_otras?: number;
  retenciones_soportadas?: number;
  pagos_fraccionados?: number;
  cifra_negocios?: number;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function Casillas200({ empresas }: { empresas: Empresa[] }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const defaultYear = new Date().getUTCFullYear() - 1; // IS se presenta del año anterior
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [ejercicio, setEjercicio] = useState(defaultYear);
  const [inputs, setInputs] = useState<Inputs200>({ tipo_gravamen: "general" });
  const [casillas, setCasillas] = useState<Record<string, number>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [resumen, setResumen] = useState<Record<string, unknown> | null>(null);
  const [declaracion, setDeclaracion] = useState<{ status: string; updated_at: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      const res = await fetch(`/api/aeat/200?empresa_id=${empresaId}&ejercicio=${ejercicio}`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setCasillas(json.casillas);
      setWarnings(json.warnings ?? []);
      setResumen(json.resumen);
      setDeclaracion(json.declaracion);
      const ia = (json.resumen?.inputs_aplicados ?? {}) as Inputs200;
      setInputs((prev) => ({ ...prev, ...ia, tipo_gravamen: prev.tipo_gravamen ?? "general" }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, ejercicio]);

  async function recalcular(status: "borrador" | "revisado" | "presentado") {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const tk = await token();
      const res = await fetch("/api/aeat/200", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresaId,
          ejercicio,
          periodo: "ANUAL",
          status,
          inputs_200: inputs,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setSuccess(status === "presentado" ? "Marcado como presentado." : `Guardado (${status}).`);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  function num(key: keyof Inputs200) {
    return (inputs[key] as number | undefined) ?? "";
  }

  const update = (key: keyof Inputs200, value: number | string | undefined) => {
    setInputs((prev) => ({ ...prev, [key]: value === "" || value == null ? undefined : Number(value) }));
  };

  const resultado = casillas.c599 ?? 0;

  return (
    <section className="grid">
      <header className="card span-12" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span className="card-eyebrow">Modelo 200 · Impuesto sobre Sociedades</span>
            <h2 className="title" style={{ fontSize: 28, marginTop: 6 }}>
              Ejercicio <em>{ejercicio}</em>
            </h2>
            <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
              Cálculo del IS anual. El resultado contable, retenciones, pagos fraccionados (M202) y cifra de negocios
              se autocompletan de tu contabilidad; ajustes, BIN y deducciones son manuales.
            </p>
          </div>
          <span className={`pill ${declaracion?.status === "presentado" ? "good" : declaracion?.status === "revisado" ? "accent" : "warn"}`}>
            {declaracion?.status ?? "no iniciado"}
          </span>
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
              {[defaultYear, defaultYear - 1, defaultYear - 2, defaultYear - 3].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label className="label">
            Régimen fiscal
            <select className="input" value={inputs.tipo_gravamen ?? "general"} onChange={(e) => update("tipo_gravamen", e.target.value)}>
              <option value="general">General (25 %)</option>
              <option value="pyme">Pyme · cifra &lt; 1 M (23 %)</option>
              <option value="nueva_creacion">Nueva creación (15 %)</option>
              <option value="otro">Otro tipo</option>
            </select>
          </label>
          {inputs.tipo_gravamen === "otro" ? (
            <label className="label">
              Tipo personalizado (%)
              <input className="input" type="number" min={0} max={50} step={0.5} value={num("tipo_gravamen_custom")} onChange={(e) => update("tipo_gravamen_custom", e.target.value)} />
            </label>
          ) : null}
        </div>

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

      <article className="card span-12" style={{ display: "grid", gap: 10 }}>
        <span className="card-eyebrow">1 · Resultado contable y ajustes</span>
        <p className="muted" style={{ fontSize: 13 }}>
          El resultado contable se lee del P&G del ejercicio (cuentas grupo 6 y 7). Los ajustes corrigen las diferencias entre contabilidad y la base imponible fiscal.
        </p>
        <div className="form" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <label className="label">
            Resultado contable (auto)
            <input className="input" type="number" step={0.01} value={num("resultado_contable")} onChange={(e) => update("resultado_contable", e.target.value)} placeholder="Auto desde diario" />
          </label>
          <label className="label">
            Ajustes <strong style={{ color: "var(--bad)" }}>+</strong> permanentes
            <input className="input" type="number" min={0} step={0.01} value={num("ajuste_aumento_permanente")} onChange={(e) => update("ajuste_aumento_permanente", e.target.value)} placeholder="0,00" />
          </label>
          <label className="label">
            Ajustes <strong style={{ color: "var(--good)" }}>−</strong> permanentes
            <input className="input" type="number" min={0} step={0.01} value={num("ajuste_disminucion_permanente")} onChange={(e) => update("ajuste_disminucion_permanente", e.target.value)} placeholder="0,00" />
          </label>
          <label className="label">
            Ajustes <strong style={{ color: "var(--bad)" }}>+</strong> temporales
            <input className="input" type="number" min={0} step={0.01} value={num("ajuste_aumento_temporal")} onChange={(e) => update("ajuste_aumento_temporal", e.target.value)} placeholder="0,00" />
          </label>
          <label className="label">
            Ajustes <strong style={{ color: "var(--good)" }}>−</strong> temporales
            <input className="input" type="number" min={0} step={0.01} value={num("ajuste_disminucion_temporal")} onChange={(e) => update("ajuste_disminucion_temporal", e.target.value)} placeholder="0,00" />
          </label>
        </div>
      </article>

      <article className="card span-6">
        <span className="card-eyebrow">2 · Compensación BIN</span>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Bases imponibles negativas de ejercicios anteriores que aplicas este año. Límite del 70 % de la BI con mínimo absorbible de 1 M €.
        </p>
        <div className="form" style={{ marginTop: 8 }}>
          <label className="label">
            BIN disponible
            <input className="input" type="number" min={0} step={0.01} value={num("bin_disponible")} onChange={(e) => update("bin_disponible", e.target.value)} placeholder="Acumulado años anteriores" />
          </label>
          <label className="label">
            BIN a compensar este año
            <input className="input" type="number" min={0} step={0.01} value={num("compensacion_bin")} onChange={(e) => update("compensacion_bin", e.target.value)} placeholder="Si quieres limitar manualmente" />
          </label>
        </div>
      </article>

      <article className="card span-6">
        <span className="card-eyebrow">3 · Deducciones</span>
        <div className="form two-cols" style={{ marginTop: 8 }}>
          <label className="label">
            I+D+i
            <input className="input" type="number" min={0} step={0.01} value={num("deduccion_id_i")} onChange={(e) => update("deduccion_id_i", e.target.value)} />
          </label>
          <label className="label">
            Doble imposición
            <input className="input" type="number" min={0} step={0.01} value={num("deduccion_doble_imposicion")} onChange={(e) => update("deduccion_doble_imposicion", e.target.value)} />
          </label>
          <label className="label">
            Donativos
            <input className="input" type="number" min={0} step={0.01} value={num("deduccion_donativos")} onChange={(e) => update("deduccion_donativos", e.target.value)} />
          </label>
          <label className="label">
            Otras deducciones
            <input className="input" type="number" min={0} step={0.01} value={num("deduccion_otras")} onChange={(e) => update("deduccion_otras", e.target.value)} />
          </label>
        </div>
      </article>

      <article className="card span-12">
        <span className="card-eyebrow">4 · Retenciones y pagos a cuenta (auto)</span>
        <div className="form three-cols" style={{ marginTop: 8 }}>
          <label className="label">
            Retenciones soportadas
            <input className="input" type="number" min={0} step={0.01} value={num("retenciones_soportadas")} onChange={(e) => update("retenciones_soportadas", e.target.value)} placeholder="Auto desde facturas" />
          </label>
          <label className="label">
            Pagos fraccionados (M202)
            <input className="input" type="number" min={0} step={0.01} value={num("pagos_fraccionados")} onChange={(e) => update("pagos_fraccionados", e.target.value)} placeholder="Auto desde M202 presentados" />
          </label>
          <label className="label">
            Cifra de negocios anual
            <input className="input" type="number" min={0} step={0.01} value={num("cifra_negocios")} onChange={(e) => update("cifra_negocios", e.target.value)} placeholder="Auto desde facturas emitidas" />
          </label>
        </div>
      </article>

      {/* Resumen de casillas */}
      <article className="card span-12">
        <span className="card-eyebrow">Casillas calculadas</span>
        <table className="table" style={{ marginTop: 8 }}>
          <thead><tr><th style={{ width: 90 }}>Casilla</th><th>Concepto</th><th className="num">Valor</th></tr></thead>
          <tbody>
            <tr><td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>500</td><td>Resultado contable</td><td className="num">{EUR(casillas.c500 ?? 0)}</td></tr>
            <tr><td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>545</td><td>Base imponible antes de BIN</td><td className="num">{EUR(casillas.c545 ?? 0)}</td></tr>
            <tr><td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>547</td><td>BIN aplicada</td><td className="num">{EUR(casillas.c547 ?? 0)}</td></tr>
            <tr style={{ background: "var(--accent-soft)" }}><td style={{ fontFamily: "var(--mono)" }}>552</td><td><strong>Base imponible</strong></td><td className="num" style={{ fontWeight: 700 }}>{EUR(casillas.c552 ?? 0)}</td></tr>
            <tr><td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>558</td><td>Tipo de gravamen</td><td className="num">{(casillas.c558 ?? 0).toFixed(2)} %</td></tr>
            <tr><td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>562</td><td>Cuota íntegra</td><td className="num">{EUR(casillas.c562 ?? 0)}</td></tr>
            <tr><td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>565</td><td>Deducciones totales</td><td className="num">{EUR(casillas.c565 ?? 0)}</td></tr>
            <tr style={{ background: "var(--accent-soft)" }}><td style={{ fontFamily: "var(--mono)" }}>592</td><td><strong>Cuota líquida</strong></td><td className="num" style={{ fontWeight: 700 }}>{EUR(casillas.c592 ?? 0)}</td></tr>
            <tr><td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>595</td><td>Retenciones soportadas</td><td className="num">{EUR(casillas.c595 ?? 0)}</td></tr>
            <tr><td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>596</td><td>Pagos fraccionados (M202)</td><td className="num">{EUR(casillas.c596 ?? 0)}</td></tr>
            <tr style={{ background: "linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, black) 100%)", color: "white" }}>
              <td style={{ fontFamily: "var(--mono)", color: "rgba(255,255,255,0.7)" }}>599</td>
              <td><strong>{resultado >= 0 ? "A INGRESAR" : "A DEVOLVER"}</strong></td>
              <td className="num" style={{ fontWeight: 700, fontSize: 18 }}>{EUR(Math.abs(resultado))}</td>
            </tr>
          </tbody>
        </table>
      </article>

      <article className="card span-12" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div className="muted" style={{ fontSize: 13, maxWidth: 520 }}>
          Recuerda: el 200 se presenta en julio del año siguiente al ejercicio. Guarda primero como borrador para revisar.
        </div>
        <div className="button-row">
          <button className="button secondary" onClick={() => recalcular("borrador")} disabled={loading || !empresaId}>↻ Recalcular y guardar borrador</button>
          <button className="button" onClick={() => recalcular("presentado")} disabled={loading || !empresaId}>Marcar presentado ✓</button>
        </div>
      </article>
    </section>
  );
}
