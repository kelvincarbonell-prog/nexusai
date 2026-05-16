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

const SECTIONS_347: Section[] = [
  {
    eyebrow: "Operadores declarables (>3.005,06 € anual)",
    rows: [
      { code: "c01", label: "Clientes (operaciones emitidas)" },
      { code: "c02", label: "Proveedores (operaciones recibidas)" },
      { code: "c05", label: "Total terceros declarados", accent: true },
    ],
  },
  {
    eyebrow: "Importes anuales",
    rows: [
      { code: "c03", label: "Importe total a clientes" },
      { code: "c04", label: "Importe total de proveedores" },
    ],
  },
];

const SECTIONS_349: Section[] = [
  {
    eyebrow: "Operaciones intracomunitarias del trimestre",
    rows: [
      { code: "num_operadores", label: "Nº operadores únicos" },
      { code: "total_entregas", label: "Entregas (E) + triangulares (T)" },
      { code: "total_adquisiciones", label: "Adquisiciones (A)" },
      { code: "total_servicios_prestados", label: "Servicios prestados (S)" },
      { code: "total_servicios_recibidos", label: "Servicios recibidos (I)" },
      { code: "total", label: "Total base imponible", accent: true },
    ],
  },
];

const SECTIONS_180: Section[] = [
  {
    eyebrow: "Resumen anual de alquileres (agrega 4 trimestres del 115)",
    rows: [
      { code: "c01", label: "Nº arrendadores únicos" },
      { code: "c02", label: "Base anual total" },
      { code: "c03", label: "Retenciones anuales (19 %)", accent: true },
    ],
  },
];

const SECTIONS_190: Section[] = [
  {
    eyebrow: "Resumen anual IRPF (agrega 4 trimestres del 111)",
    rows: [
      { code: "c01", label: "Trabajadores (clave A)" },
      { code: "c03", label: "Retenciones trabajadores" },
      { code: "c04", label: "Profesionales (clave G)" },
      { code: "c06", label: "Retenciones profesionales" },
      { code: "total_perceptores", label: "Total perceptores", accent: true },
      { code: "total_retenciones", label: "Total retenciones", accent: true },
    ],
  },
];

const SECTIONS_232: Section[] = [
  {
    eyebrow: "Operaciones vinculadas anuales",
    rows: [
      { code: "total_vinculados", label: "Operadores vinculados declarables" },
      { code: "importe_vinculados", label: "Importe total vinculadas", accent: true },
    ],
  },
  {
    eyebrow: "Paraísos fiscales",
    rows: [
      { code: "total_paraisos", label: "Operadores en paraísos fiscales" },
      { code: "importe_paraisos", label: "Importe total con paraísos", accent: true },
    ],
  },
];

const SECTIONS_123: Section[] = [
  {
    eyebrow: "Retenciones capital mobiliario",
    rows: [
      { code: "c01", label: "Nº perceptores" },
      { code: "c02", label: "Base retenciones" },
      { code: "c03", label: "Retenciones (19 %)", accent: true },
      { code: "c28", label: "Total a ingresar", accent: true },
    ],
  },
];

const SECTIONS_100: Section[] = [
  {
    eyebrow: "Bases imponibles",
    rows: [
      { code: "c0500", label: "Rendimientos trabajo netos" },
      { code: "c0220", label: "Actividades económicas" },
      { code: "c0085", label: "Capital inmobiliario" },
      { code: "c0030", label: "Capital mobiliario" },
      { code: "c0400", label: "Ganancias patrimoniales" },
      { code: "c0510", label: "Base liquidable general", accent: true },
      { code: "c0455", label: "Base imponible ahorro" },
    ],
  },
  {
    eyebrow: "Resultado",
    rows: [
      { code: "c0545", label: "Cuota líquida", accent: true },
      { code: "c0625", label: "Retenciones y pagos a cuenta" },
      { code: "c0670", label: "Resultado · a ingresar / devolver", accent: true },
    ],
  },
];

const SECTIONS_184: Section[] = [
  {
    eyebrow: "Atribución de rentas",
    rows: [
      { code: "total_ingresos", label: "Total ingresos anuales" },
      { code: "total_gastos", label: "Total gastos deducibles" },
      { code: "rendimiento_neto", label: "Rendimiento neto", accent: true },
      { code: "num_comuneros", label: "Nº comuneros / socios" },
      { code: "porcentaje_total", label: "Suma % atribución" },
    ],
  },
];

const SECTIONS_193: Section[] = [
  {
    eyebrow: "Resumen anual capital mobiliario",
    rows: [
      { code: "num_perceptores", label: "Nº perceptores" },
      { code: "total_base", label: "Base anual" },
      { code: "total_retenciones", label: "Retenciones anuales", accent: true },
    ],
  },
];

const SECTIONS_210: Section[] = [
  {
    eyebrow: "Renta de no residente",
    rows: [
      { code: "c01", label: "Ingresos brutos" },
      { code: "c02", label: "Gastos deducibles (UE/EEE)" },
      { code: "c03", label: "Base imponible", accent: true },
      { code: "c04", label: "Tipo gravamen %" },
      { code: "c05", label: "Cuota íntegra" },
      { code: "c06", label: "Retenciones soportadas" },
      { code: "c07", label: "Resultado a ingresar", accent: true },
    ],
  },
];

const SECTIONS_296: Section[] = [
  {
    eyebrow: "Resumen anual no residentes",
    rows: [
      { code: "num_perceptores", label: "Nº perceptores" },
      { code: "total_base", label: "Base total" },
      { code: "total_retenciones", label: "Retenciones totales", accent: true },
    ],
  },
];

const SECTIONS_309: Section[] = [
  {
    eyebrow: "Liquidación IVA no periódica",
    rows: [
      { code: "c01", label: "Base imponible" },
      { code: "c02", label: "Tipo aplicado %" },
      { code: "c03", label: "Cuota IVA", accent: true },
      { code: "c04", label: "Retenciones" },
      { code: "c05", label: "A ingresar", accent: true },
    ],
  },
];

const SECTIONS_720: Section[] = [
  {
    eyebrow: "Bienes en el extranjero",
    rows: [
      { code: "cuentas_num", label: "Nº cuentas extranjeras" },
      { code: "cuentas_valor", label: "Valor cuentas (€)" },
      { code: "valores_num", label: "Nº valores/derechos" },
      { code: "valores_valor", label: "Valor (€)" },
      { code: "inmuebles_num", label: "Nº inmuebles" },
      { code: "inmuebles_valor", label: "Valor inmuebles (€)" },
      { code: "total_bloques_obligados", label: "Bloques obligados (>50.000 €)", accent: true },
    ],
  },
];

const SECTIONS: Record<string, Section[]> = {
  "100": SECTIONS_100,
  "111": SECTIONS_111,
  "115": SECTIONS_115,
  "123": SECTIONS_123,
  "130": SECTIONS_130,
  "180": SECTIONS_180,
  "184": SECTIONS_184,
  "190": SECTIONS_190,
  "193": SECTIONS_193,
  "210": SECTIONS_210,
  "232": SECTIONS_232,
  "296": SECTIONS_296,
  "309": SECTIONS_309,
  "347": SECTIONS_347,
  "349": SECTIONS_349,
  "390": SECTIONS_390,
  "720": SECTIONS_720,
};

const TITLES: Record<string, string> = {
  "100": "Modelo 100 · IRPF anual",
  "111": "Modelo 111 · Retenciones IRPF",
  "115": "Modelo 115 · Retenciones alquileres",
  "123": "Modelo 123 · Capital mobiliario",
  "130": "Modelo 130 · Pago fraccionado autónomos",
  "180": "Modelo 180 · Resumen anual alquileres",
  "184": "Modelo 184 · Atribución de rentas",
  "190": "Modelo 190 · Resumen anual IRPF",
  "193": "Modelo 193 · Resumen capital mobiliario",
  "210": "Modelo 210 · No residentes",
  "232": "Modelo 232 · Operaciones vinculadas",
  "296": "Modelo 296 · Resumen no residentes",
  "309": "Modelo 309 · IVA no periódico",
  "347": "Modelo 347 · Operaciones con terceros",
  "349": "Modelo 349 · Operaciones intracomunitarias",
  "390": "Modelo 390 · Resumen anual IVA",
  "720": "Modelo 720 · Bienes en extranjero",
};

const HINTS: Record<string, string> = {
  "100": "Declaración anual de IRPF (autónomos y particulares). Incluye rendimientos del trabajo, capital y actividades económicas.",
  "111": "Retenciones de IRPF practicadas a trabajadores y profesionales en el trimestre.",
  "115": "Retenciones por arrendamientos de inmuebles urbanos pagados en el trimestre (tipo 19 %).",
  "123": "Retenciones sobre rendimientos del capital mobiliario (dividendos, intereses). Tipo 19 %.",
  "130": "Pago fraccionado de IRPF de autónomos en estimación directa. Cálculo acumulado del ejercicio.",
  "180": "Resumen anual de retenciones de alquileres. Agrega los 4 trimestres del 115.",
  "184": "Declaración informativa de entidades en régimen de atribución (CB, SC, herencias yacentes).",
  "190": "Resumen anual de retenciones IRPF (trabajadores + profesionales). Agrega los 4 trimestres del 111.",
  "193": "Resumen anual de retenciones del capital mobiliario. Agrega los 4 trimestres del 123.",
  "210": "Retenciones sobre rentas obtenidas en España por no residentes (sin establecimiento permanente).",
  "232": "Operaciones vinculadas (>250.000 € general o >100.000 € específico) y operaciones con paraísos fiscales. Presentación: noviembre.",
  "296": "Resumen anual de retenciones a no residentes. Agrega trimestres del 210.",
  "309": "Liquidación IVA puntual para sujetos no obligados al 303. Operación específica.",
  "347": "Declaración informativa anual. Terceros con quien operas >3.005,06 € en el año (excluyendo intracomunitarias y alquileres con retención). Presentación: febrero.",
  "349": "Operaciones con operadores intracomunitarios. Presentación trimestral o mensual según volumen.",
  "390": "Resumen anual informativo de IVA. Agrega automáticamente los 4 trimestres del 303 ya guardados.",
  "720": "Bienes y derechos situados en el extranjero (cuentas, valores, inmuebles). Obligatorio si supera 50.000 € por bloque.",
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function CasillasSimple({ modelo, empresas }: { modelo: "100" | "111" | "115" | "123" | "130" | "180" | "184" | "190" | "193" | "210" | "232" | "296" | "309" | "347" | "349" | "390" | "720"; empresas: Empresa[] }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const now = new Date();
  const defaultYear = now.getUTCFullYear();
  const isAnual = ["100", "180", "184", "190", "193", "232", "296", "347", "390", "720"].includes(modelo);
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
    (modelo === "130" ? casillas.c19
      : modelo === "390" ? casillas.c664
      : modelo === "347" ? casillas.c05
      : modelo === "349" ? casillas.total
      : modelo === "180" ? casillas.c03
      : modelo === "190" ? casillas.total_retenciones
      : modelo === "193" ? casillas.total_retenciones
      : modelo === "232" ? casillas.total_vinculados
      : modelo === "296" ? casillas.total_retenciones
      : modelo === "210" ? casillas.c07
      : modelo === "309" ? casillas.c05
      : modelo === "100" ? casillas.c0670
      : modelo === "184" ? casillas.rendimiento_neto
      : modelo === "720" ? casillas.total_bloques_obligados
      : casillas.c28) ?? 0;
  const isCount = ["347", "232", "720"].includes(modelo);

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
        <div className="metric accent">{isCount ? `${resultado}` : EUR(Math.abs(resultado))}</div>
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
