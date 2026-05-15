"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Empresa = { id: string; nombre: string; nif?: string };
type Casillas = Record<string, number>;
type Resumen = { num_emitidas: number; num_recibidas: number; num_gastos: number };

const T_LABEL: Record<string, string> = {
  "1T": "1.er trimestre · ene–mar",
  "2T": "2.º trimestre · abr–jun",
  "3T": "3.er trimestre · jul–sep",
  "4T": "4.º trimestre · oct–dic",
};

const SECTIONS: { eyebrow: string; rows: { code: string; label: string; accent?: boolean }[] }[] = [
  {
    eyebrow: "IVA devengado · régimen general",
    rows: [
      { code: "c01", label: "Base · tipo 4 %" },
      { code: "c03", label: "Cuota · tipo 4 %" },
      { code: "c04", label: "Base · tipo 10 %" },
      { code: "c06", label: "Cuota · tipo 10 %" },
      { code: "c07", label: "Base · tipo 21 %" },
      { code: "c09", label: "Cuota · tipo 21 %" },
      { code: "c27", label: "Total cuota devengada", accent: true },
    ],
  },
  {
    eyebrow: "IVA deducible",
    rows: [
      { code: "c28", label: "Base · operaciones interiores corrientes" },
      { code: "c29", label: "Cuota · operaciones interiores corrientes" },
      { code: "c30", label: "Base · bienes de inversión" },
      { code: "c31", label: "Cuota · bienes de inversión" },
      { code: "c36", label: "Base · adquisiciones intracomunitarias" },
      { code: "c37", label: "Cuota · adquisiciones intracomunitarias" },
      { code: "c45", label: "Total a deducir", accent: true },
    ],
  },
  {
    eyebrow: "Resultado",
    rows: [
      { code: "c46", label: "Diferencia (27 − 45)", accent: true },
      { code: "c69", label: "Cuotas a compensar de periodos anteriores" },
      { code: "c71", label: "Resultado · a ingresar / devolver", accent: true },
    ],
  },
];

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function Casillas303({ empresas }: { empresas: Empresa[] }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const now = new Date();
  const defaultYear = now.getUTCFullYear();
  const defaultPeriodo = (`${Math.ceil((now.getUTCMonth() + 1) / 3)}T`) as "1T" | "2T" | "3T" | "4T";

  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [ejercicio, setEjercicio] = useState(defaultYear);
  const [periodo, setPeriodo] = useState(defaultPeriodo);
  const [casillas, setCasillas] = useState<Casillas>({});
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [declaracion, setDeclaracion] = useState<{ id: string; status: string; ref_aeat?: string | null; updated_at: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const empresa = useMemo(() => empresas.find((e) => e.id === empresaId), [empresas, empresaId]);

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
      const res = await fetch(`/api/aeat/303?empresa_id=${empresaId}&ejercicio=${ejercicio}&periodo=${periodo}`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error al calcular");
      setCasillas(json.casillas);
      setResumen(json.resumen);
      setWarnings(json.warnings ?? []);
      setDeclaracion(json.declaracion ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, ejercicio, periodo]);

  async function save(status: "borrador" | "revisado" | "presentado") {
    if (!empresaId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const tk = await token();
      const res = await fetch("/api/aeat/303", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId, ejercicio, periodo, status }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error al guardar");
      setSuccess(
        status === "presentado"
          ? "Declaración marcada como presentada."
          : status === "revisado"
            ? "Marcada como revisada."
            : "Borrador guardado.",
      );
      setDeclaracion(json.declaracion);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function downloadFichero() {
    if (!declaracion) {
      setError("Guarda el borrador primero (botón 'Guardar borrador').");
      return;
    }
    try {
      const tk = await token();
      const res = await fetch(
        `/api/aeat/303/fichero?empresa_id=${empresaId}&ejercicio=${ejercicio}&periodo=${periodo}`,
        { headers: { Authorization: `Bearer ${tk}` } },
      );
      if (!res.ok) {
        const txt = await res.text();
        try {
          const j = JSON.parse(txt);
          throw new Error(j.error ?? "Error");
        } catch {
          throw new Error(txt || "Error");
        }
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `303_${ejercicio}${periodo}_${empresa?.nif ?? "empresa"}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  const c27 = casillas.c27 ?? 0;
  const c45 = casillas.c45 ?? 0;
  const c71 = casillas.c71 ?? 0;
  const isPositive = c71 >= 0;
  const status = declaracion?.status ?? "no_iniciado";

  return (
    <section className="grid">
      <header className="card span-12" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span className="card-eyebrow">Modelo 303 · IVA</span>
            <h2 className="title" style={{ fontSize: 32, marginTop: 6 }}>
              {empresa?.nombre ?? "Selecciona empresa"} <em>{periodo} {ejercicio}</em>
            </h2>
            <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>
              {T_LABEL[periodo]} · Cálculo en vivo a partir de tus facturas y gastos.
            </p>
          </div>
          <div style={{ display: "grid", gap: 8, alignContent: "start" }}>
            <span className={`pill ${status === "presentado" ? "good" : status === "revisado" ? "accent" : "warn"}`}>
              {status === "no_iniciado" ? "no iniciado" : status}
            </span>
            {declaracion ? (
              <small className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                Última edición {new Date(declaracion.updated_at).toLocaleString("es-ES")}
              </small>
            ) : null}
          </div>
        </div>

        <div className="form three-cols">
          <label className="label">
            Empresa
            <select className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </label>
          <label className="label">
            Ejercicio
            <select className="input" value={ejercicio} onChange={(e) => setEjercicio(Number(e.target.value))}>
              {[defaultYear, defaultYear - 1, defaultYear - 2].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <label className="label">
            Periodo
            <select className="input" value={periodo} onChange={(e) => setPeriodo(e.target.value as typeof periodo)}>
              <option value="1T">1T · ene–mar</option>
              <option value="2T">2T · abr–jun</option>
              <option value="3T">3T · jul–sep</option>
              <option value="4T">4T · oct–dic</option>
            </select>
          </label>
        </div>

        {resumen ? (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>
            <span>● {resumen.num_emitidas} facturas emitidas</span>
            <span>● {resumen.num_recibidas} facturas recibidas</span>
            <span>● {resumen.num_gastos} gastos</span>
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <div className="copilot-card" style={{ background: "rgba(251, 191, 36, 0.08)", borderColor: "var(--warn)" }}>
            <span className="card-eyebrow warn">Revisa antes de presentar</span>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        ) : null}

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
        {success ? <p role="status" style={{ color: "var(--good)" }}>{success}</p> : null}
      </header>

      {/* Tarjetas resultado */}
      <article className="card span-4">
        <span className="card-eyebrow">Cuota devengada</span>
        <div className="metric">{EUR(c27)}</div>
        <div className="metric-foot plain">Lo que has cobrado de IVA a tus clientes.</div>
      </article>
      <article className="card span-4">
        <span className="card-eyebrow">A deducir</span>
        <div className="metric">{EUR(c45)}</div>
        <div className="metric-foot plain">IVA soportado en compras y gastos.</div>
      </article>
      <article className="card span-4" style={{ borderColor: "var(--accent)" }}>
        <span className="card-eyebrow">Resultado · casilla 71</span>
        <div className="metric accent">{EUR(Math.abs(c71))}</div>
        <div className={`metric-foot ${isPositive ? "warn" : "accent"}`}>
          {isPositive ? "A ingresar a Hacienda" : "A compensar / devolver"}
        </div>
      </article>

      {/* Detalle por sección */}
      {SECTIONS.map((section) => (
        <article key={section.eyebrow} className="card span-12">
          <span className="card-eyebrow">{section.eyebrow}</span>
          <table className="table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ width: 90 }}>Casilla</th>
                <th>Concepto</th>
                <th className="num">Importe</th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row) => {
                const value = casillas[row.code] ?? 0;
                return (
                  <tr key={row.code} style={row.accent ? { background: "var(--accent-soft)" } : undefined}>
                    <td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>{row.code.slice(1).padStart(2, "0")}</td>
                    <td>{row.label}</td>
                    <td className="num" style={row.accent ? { fontWeight: 700 } : undefined}>{EUR(value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </article>
      ))}

      {/* Acciones */}
      <div className="card span-12" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <div className="muted" style={{ fontSize: 13, maxWidth: 520 }}>
          Cuando estés conforme, guarda el borrador. Luego descarga el fichero AEAT para subirlo a sede.agenciatributaria.gob.es,
          o márcalo como presentado tras confirmar el envío.
        </div>
        <div className="button-row">
          <button className="button secondary" onClick={load} disabled={loading || saving}>
            {loading ? "Recalculando…" : "↻ Recalcular"}
          </button>
          <button className="button secondary" onClick={() => save("borrador")} disabled={saving || !empresaId}>
            {saving ? "Guardando…" : "Guardar borrador"}
          </button>
          <button className="button secondary" onClick={downloadFichero} disabled={!declaracion}>
            ↓ Fichero AEAT
          </button>
          <button className="button" onClick={() => save("presentado")} disabled={saving || !declaracion}>
            Marcar como presentado ✓
          </button>
        </div>
      </div>
    </section>
  );
}
