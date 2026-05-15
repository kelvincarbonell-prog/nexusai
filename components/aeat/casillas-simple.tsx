"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Empresa = { id: string; nombre: string; nif?: string };
type Casillas = Record<string, number>;

type Section = { eyebrow: string; rows: { code: string; label: string; accent?: boolean }[] };

const SECTIONS_111: Section[] = [
  {
    eyebrow: "Trabajadores · clave A",
    rows: [
      { code: "c01", label: "Nº perceptores" },
      { code: "c02", label: "Base retenciones" },
      { code: "c03", label: "Retenciones e ingresos a cuenta", accent: true },
    ],
  },
  {
    eyebrow: "Profesionales · clave G",
    rows: [
      { code: "c04", label: "Nº perceptores" },
      { code: "c05", label: "Base retenciones" },
      { code: "c06", label: "Retenciones e ingresos a cuenta", accent: true },
    ],
  },
  {
    eyebrow: "Resultado",
    rows: [{ code: "c28", label: "Total a ingresar", accent: true }],
  },
];

const SECTIONS_115: Section[] = [
  {
    eyebrow: "Arrendamientos urbanos",
    rows: [
      { code: "c01", label: "Nº arrendadores" },
      { code: "c02", label: "Base retenciones" },
      { code: "c03", label: "Retenciones (19 %)", accent: true },
    ],
  },
  { eyebrow: "Resultado", rows: [{ code: "c28", label: "Total a ingresar", accent: true }] },
];

const SECTIONS_130: Section[] = [
  {
    eyebrow: "Cálculo acumulado del ejercicio",
    rows: [
      { code: "c01", label: "Ingresos computables" },
      { code: "c02", label: "Gastos deducibles" },
      { code: "c03", label: "Rendimiento neto", accent: true },
      { code: "c04", label: "20 % sobre rendimiento neto" },
    ],
  },
  {
    eyebrow: "Minoraciones",
    rows: [
      { code: "c05", label: "Retenciones soportadas" },
      { code: "c06", label: "Pagos fraccionados anteriores" },
      { code: "c07", label: "Compensación pérdidas anteriores" },
      { code: "c12", label: "Diferencia (04 − 05 − 06 − 07)", accent: true },
    ],
  },
  {
    eyebrow: "Resultado",
    rows: [
      { code: "c14", label: "Deducción art. 110.3 (rendimientos bajos)" },
      { code: "c19", label: "Resultado · a ingresar", accent: true },
    ],
  },
];

const SECTIONS_390: Section[] = [
  {
    eyebrow: "IVA devengado anual",
    rows: [
      { code: "c01", label: "Base · tipo 4 %" },
      { code: "c04", label: "Base · tipo 10 %" },
      { code: "c07", label: "Base · tipo 21 %" },
      { code: "c662", label: "Total IVA devengado", accent: true },
    ],
  },
  {
    eyebrow: "IVA deducible anual",
    rows: [
      { code: "c28", label: "Base · operaciones interiores" },
      { code: "c29", label: "Cuota · operaciones interiores" },
      { code: "c663", label: "Total IVA deducible", accent: true },
    ],
  },
  {
    eyebrow: "Volumen anual",
    rows: [
      { code: "c98", label: "Operaciones interiores" },
      { code: "c99", label: "Intracomunitarias / ISP" },
      { code: "c97", label: "Total volumen de operaciones", accent: true },
      { code: "c95", label: "% prorrata aplicado" },
    ],
  },
  {
    eyebrow: "Resultado anual",
    rows: [{ code: "c664", label: "Resultado liquidación anual", accent: true }],
  },
];

const SECTIONS: Record<string, Section[]> = { "111": SECTIONS_111, "115": SECTIONS_115, "130": SECTIONS_130, "390": SECTIONS_390 };

const TITLES: Record<string, string> = {
  "111": "Modelo 111 · Retenciones IRPF",
  "115": "Modelo 115 · Retenciones alquileres",
  "130": "Modelo 130 · Pago fraccionado autónomos",
  "390": "Modelo 390 · Resumen anual IVA",
};

const HINTS: Record<string, string> = {
  "111": "Retenciones de IRPF practicadas a trabajadores y profesionales en el trimestre.",
  "115": "Retenciones por arrendamientos de inmuebles urbanos pagados en el trimestre (tipo 19 %).",
  "130": "Pago fraccionado de IRPF de autónomos en estimación directa. Cálculo acumulado del ejercicio.",
  "390": "Resumen anual informativo de IVA. Agrega automáticamente los 4 trimestres del 303 ya guardados.",
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function CasillasSimple({ modelo, empresas }: { modelo: "111" | "115" | "130" | "390"; empresas: Empresa[] }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const now = new Date();
  const defaultYear = now.getUTCFullYear();
  const isAnual = modelo === "390";
  const defaultPeriodo = (isAnual ? "ANUAL" : `${Math.ceil((now.getUTCMonth() + 1) / 3)}T`) as "1T" | "2T" | "3T" | "4T" | "ANUAL";

  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [ejercicio, setEjercicio] = useState(defaultYear);
  const [periodo, setPeriodo] = useState(defaultPeriodo);
  const [casillas, setCasillas] = useState<Casillas>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [declaracion, setDeclaracion] = useState<{ status: string; updated_at: string } | null>(null);
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
      const res = await fetch(`/api/aeat/${modelo}?empresa_id=${empresaId}&ejercicio=${ejercicio}&periodo=${periodo}`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setCasillas(json.casillas);
      setWarnings(json.warnings ?? []);
      setDeclaracion(json.declaracion);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // si cambias a 390/desde 390, normaliza el periodo
    setPeriodo((current) => {
      if (isAnual && current !== "ANUAL") return "ANUAL";
      if (!isAnual && current === "ANUAL") return defaultPeriodo;
      return current;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelo]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, ejercicio, periodo, modelo]);

  async function save(status: "borrador" | "revisado" | "presentado") {
    if (!empresaId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const tk = await token();
      const res = await fetch(`/api/aeat/${modelo}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId, ejercicio, periodo, status }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setSuccess(status === "presentado" ? "Marcado como presentado." : `Guardado (${status}).`);
      setDeclaracion(json.declaracion);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  const resultado =
    (modelo === "130"
      ? casillas.c19
      : modelo === "390"
        ? casillas.c664
        : casillas.c28) ?? 0;

  return (
    <section className="grid">
      <header className="card span-12" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span className="card-eyebrow">{TITLES[modelo]}</span>
            <h2 className="title" style={{ fontSize: 28, marginTop: 6 }}>
              {empresa?.nombre ?? "Selecciona empresa"} <em>{periodo} {ejercicio}</em>
            </h2>
            <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>{HINTS[modelo]}</p>
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
            <select
              className="input"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value as typeof periodo)}
              disabled={isAnual}
            >
              {isAnual ? (
                <option value="ANUAL">ANUAL · ejercicio completo</option>
              ) : (
                <>
                  <option value="1T">1T · ene–mar</option>
                  <option value="2T">2T · abr–jun</option>
                  <option value="3T">3T · jul–sep</option>
                  <option value="4T">4T · oct–dic</option>
                </>
              )}
            </select>
          </label>
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

      <article className="card span-12" style={{ borderColor: "var(--accent)" }}>
        <span className="card-eyebrow">Resultado</span>
        <div className="metric accent">{EUR(Math.abs(resultado))}</div>
        <div className={`metric-foot ${resultado >= 0 ? "warn" : "accent"}`}>
          {resultado >= 0 ? "A ingresar a Hacienda" : "A compensar"}
        </div>
      </article>

      {SECTIONS[modelo].map((section) => (
        <article key={section.eyebrow} className="card span-12">
          <span className="card-eyebrow">{section.eyebrow}</span>
          <table className="table" style={{ marginTop: 8 }}>
            <thead><tr><th style={{ width: 90 }}>Casilla</th><th>Concepto</th><th className="num">Valor</th></tr></thead>
            <tbody>
              {section.rows.map((row) => {
                const value = casillas[row.code] ?? 0;
                const isCount = row.label.toLowerCase().includes("nº");
                return (
                  <tr key={row.code} style={row.accent ? { background: "var(--accent-soft)" } : undefined}>
                    <td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>{row.code.slice(1).padStart(2, "0")}</td>
                    <td>{row.label}</td>
                    <td className="num" style={row.accent ? { fontWeight: 700 } : undefined}>
                      {isCount ? value.toFixed(0) : EUR(value)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </article>
      ))}

      <div className="card span-12" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div className="muted" style={{ fontSize: 13, maxWidth: 520 }}>
          Guarda el borrador, revisa, y márcalo como presentado tras enviar a AEAT.
        </div>
        <div className="button-row">
          <button className="button secondary" onClick={load} disabled={loading || saving}>↻ Recalcular</button>
          <button className="button secondary" onClick={() => save("borrador")} disabled={saving || !empresaId}>Guardar borrador</button>
          <button className="button" onClick={() => save("presentado")} disabled={saving || !declaracion}>Marcar presentado ✓</button>
        </div>
      </div>
    </section>
  );
}
