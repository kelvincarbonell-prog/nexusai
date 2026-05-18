"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { CONCEPTOS_NOMINA } from "@/lib/laboral/conceptos";

type Trabajador = {
  id: string;
  nombre: string;
  activo: boolean;
  salario_bruto_anual?: number;
  irpf_pct?: number;
};

type ConceptoLinea = { concepto: string; importe: number; tipo: "devengo" | "deduccion" };

type NominaResult = {
  devengo_bruto: number;
  base_cotizacion_cc: number;
  base_cotizacion_atyepy: number;
  base_irpf: number;
  ss_trabajador: number;
  irpf_retenido: number;
  total_deducciones: number;
  liquido: number;
  ss_empresa: number;
  conceptos: ConceptoLinea[];
  irpf_pct_aplicado: number;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function PayrollPanel({ empresaId, trabajadores }: { empresaId: string; trabajadores: Trabajador[] }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const trabajadoresActivos = trabajadores.filter((t) => t.activo);
  const now = new Date();
  const defaultPeriodo = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  const [trabajadorId, setTrabajadorId] = useState(trabajadoresActivos[0]?.id ?? "");
  const [periodo, setPeriodo] = useState(defaultPeriodo);
  const [baseExtras, setBaseExtras] = useState(0);
  const [hijos, setHijos] = useState(0);
  const [overrideIrpf, setOverrideIrpf] = useState<number | "">("");
  const [conceptosExtras, setConceptosExtras] = useState<Array<{ codigo: string; importe: number }>>([]);
  const [result, setResult] = useState<NominaResult | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const trabajador = trabajadoresActivos.find((t) => t.id === trabajadorId);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function run(persist: boolean) {
    if (!trabajadorId) {
      setError("Selecciona un trabajador.");
      return;
    }
    if (!trabajador?.salario_bruto_anual) {
      setError("El trabajador no tiene salario bruto anual asignado. Edítalo desde la pestaña Trabajadores.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const tk = await token();
      const res = await fetch("/api/laboral/nominas/calcular", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresaId,
          trabajador_id: trabajadorId,
          periodo,
          base_extras: Number(baseExtras) || 0,
          hijos: Number(hijos) || 0,
          irpf_pct_override: overrideIrpf === "" ? undefined : Number(overrideIrpf),
          conceptos_extras: conceptosExtras.filter((c) => c.codigo && c.importe > 0),
          persist,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error al calcular");
      setResult(json.result);
      if (persist && json.saved?.id) {
        setSavedId(json.saved.id);
        setSuccess("Nómina guardada. Puedes descargar el recibo PDF.");
      } else {
        setSavedId(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPDF() {
    if (!savedId) return;
    try {
      const tk = await token();
      const res = await fetch(`/api/laboral/nominas/${savedId}/pdf`, { headers: { Authorization: `Bearer ${tk}` } });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Error al generar PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nomina_${periodo}_${trabajador?.nombre?.replace(/\s+/g, "_") ?? "recibo"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div className="grid" style={{ gap: 14 }}>
      <article className="card span-12">
        <div className="topbar" style={{ border: 0, padding: 0, margin: 0, alignItems: "flex-end" }}>
          <div>
            <span className="card-eyebrow">Calcular nómina</span>
            <h3 style={{ marginTop: 6, fontSize: 22, fontWeight: 700 }}>Recibo de salarios mensual</h3>
            <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
              Cotización SS 2026 (4,70 % CC + 1,55 % desempleo + 0,10 % formación + 0,13 % MEI) y tabla IRPF estatal con minoración personal.
            </p>
          </div>
        </div>

        <div className="form" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", marginTop: 14 }}>
          <label className="label">
            Trabajador
            <select className="input" value={trabajadorId} onChange={(e) => setTrabajadorId(e.target.value)}>
              {trabajadoresActivos.length === 0 ? <option value="">Sin trabajadores activos</option> : null}
              {trabajadoresActivos.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </label>
          <label className="label">
            Periodo
            <input className="input" type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
          </label>
          <label className="label">
            Pluses / variables (€)
            <input className="input" type="number" min={0} value={baseExtras} onChange={(e) => setBaseExtras(Number(e.target.value))} />
          </label>
          <label className="label">
            Hijos a cargo
            <input className="input" type="number" min={0} max={10} value={hijos} onChange={(e) => setHijos(Number(e.target.value))} />
          </label>
          <label className="label span-form" style={{ maxWidth: 300 }}>
            IRPF % (opcional, override)
            <input
              className="input"
              type="number"
              step={0.1}
              min={0}
              max={60}
              placeholder={trabajador?.irpf_pct ? String(trabajador.irpf_pct) : "automático"}
              value={overrideIrpf}
              onChange={(e) => setOverrideIrpf(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </label>
        </div>

        <fieldset style={{ marginTop: 14, border: "1px solid var(--line, #e5e7eb)", borderRadius: 10, padding: 12 }}>
          <legend style={{ padding: "0 6px", fontSize: 12, opacity: 0.7 }}>Conceptos extra del mes (catálogo A3NOM)</legend>
          {conceptosExtras.length === 0 ? (
            <p className="muted" style={{ fontSize: 12, margin: "0 0 8px" }}>
              Sin conceptos extra. Añade dietas, plus de nocturnidad, comisiones, anticipos, etc.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 6, marginBottom: 8 }}>
              {conceptosExtras.map((ce, i) => {
                const cat = CONCEPTOS_NOMINA.find((c) => c.codigo === ce.codigo);
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 140px auto", gap: 8, alignItems: "center" }}>
                    <select
                      className="input compact"
                      value={ce.codigo}
                      onChange={(e) => {
                        const next = [...conceptosExtras];
                        next[i] = { ...next[i], codigo: e.target.value };
                        setConceptosExtras(next);
                      }}
                    >
                      <option value="">— Selecciona —</option>
                      <optgroup label="Devengos">
                        {CONCEPTOS_NOMINA.filter((c) => c.tipo === "devengo").map((c) => (
                          <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Deducciones">
                        {CONCEPTOS_NOMINA.filter((c) => c.tipo === "deduccion").map((c) => (
                          <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>
                        ))}
                      </optgroup>
                    </select>
                    <input
                      className="input compact"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Importe €"
                      value={ce.importe || ""}
                      onChange={(e) => {
                        const next = [...conceptosExtras];
                        next[i] = { ...next[i], importe: Number(e.target.value) || 0 };
                        setConceptosExtras(next);
                      }}
                    />
                    <button
                      type="button"
                      className="button ghost compact"
                      onClick={() => setConceptosExtras(conceptosExtras.filter((_, j) => j !== i))}
                      title="Quitar"
                      style={{ color: "var(--bad)" }}
                    >
                      <X size={13} />
                    </button>
                    {cat?.exencion_anual ? (
                      <small className="muted" style={{ gridColumn: "1 / -1", fontSize: 10 }}>
                        Exención anual hasta {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(cat.exencion_anual)} (≈ {EUR(cat.exencion_anual / 12)} / mes). El exceso cotiza y tributa.
                      </small>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          <button
            type="button"
            className="button secondary compact"
            onClick={() => setConceptosExtras([...conceptosExtras, { codigo: "", importe: 0 }])}
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <Plus size={12} /> Añadir concepto
          </button>
        </fieldset>

        <div className="button-row" style={{ marginTop: 14 }}>
          <button className="button secondary" onClick={() => run(false)} disabled={busy || !trabajadorId}>
            {busy ? "Calculando…" : "↻ Previsualizar"}
          </button>
          <button className="button" onClick={() => run(true)} disabled={busy || !trabajadorId}>
            Calcular y guardar
          </button>
          <button className="button secondary" onClick={downloadPDF} disabled={!savedId}>
            ↓ Recibo PDF
          </button>
        </div>

        {error ? <p role="alert" style={{ color: "var(--bad)", marginTop: 10 }}>{error}</p> : null}
        {success ? <p role="status" style={{ color: "var(--good)", marginTop: 10 }}>{success}</p> : null}
      </article>

      {result ? (
        <>
          <article className="card span-4">
            <span className="card-eyebrow">Devengo bruto</span>
            <div className="metric">{EUR(result.devengo_bruto)}</div>
            <div className="metric-foot plain">Base IRPF · {EUR(result.base_irpf)}</div>
          </article>
          <article className="card span-4">
            <span className="card-eyebrow">Deducciones</span>
            <div className="metric">{EUR(result.total_deducciones)}</div>
            <div className="metric-foot warn">SS {EUR(result.ss_trabajador)} · IRPF {result.irpf_pct_aplicado.toFixed(2)} %</div>
          </article>
          <article className="card span-4" style={{ borderColor: "var(--accent)" }}>
            <span className="card-eyebrow">Líquido a percibir</span>
            <div className="metric accent">{EUR(result.liquido)}</div>
            <div className="metric-foot accent">SS empresa · {EUR(result.ss_empresa)}</div>
          </article>

          <article className="card span-12">
            <span className="card-eyebrow">Detalle de conceptos</span>
            <table className="table" style={{ marginTop: 8 }}>
              <thead>
                <tr><th>Concepto</th><th className="num">Devengo</th><th className="num">Deducción</th></tr>
              </thead>
              <tbody>
                {result.conceptos.map((c, i) => (
                  <tr key={i}>
                    <td>{c.concepto}</td>
                    <td className="num">{c.tipo === "devengo" ? EUR(c.importe) : "—"}</td>
                    <td className="num">{c.tipo === "deduccion" ? EUR(Math.abs(c.importe)) : "—"}</td>
                  </tr>
                ))}
                <tr style={{ background: "var(--accent-soft)" }}>
                  <td><strong>Líquido</strong></td>
                  <td className="num">—</td>
                  <td className="num" style={{ fontWeight: 700 }}>{EUR(result.liquido)}</td>
                </tr>
              </tbody>
            </table>
          </article>
        </>
      ) : null}
    </div>
  );
}
