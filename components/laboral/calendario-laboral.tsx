"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Resumen = {
  ejercicio: number;
  ccaa: string | null;
  dias_laborables_ano: number;
  festivos: string[];
  por_mes: { mes: number; dias_laborables: number }[];
};

const CCAA = [
  { key: "", label: "Solo nacionales" },
  { key: "madrid", label: "Madrid" },
  { key: "cataluna", label: "Cataluña" },
  { key: "valencia", label: "Comunidad Valenciana" },
  { key: "andalucia", label: "Andalucía" },
  { key: "pais_vasco", label: "País Vasco" },
  { key: "galicia", label: "Galicia" },
];

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DOW = ["L", "M", "X", "J", "V", "S", "D"];

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function firstWeekdayMonStart(year: number, month: number) {
  // month is 1-based; getUTCDay returns 0=Sun..6=Sat; shift to 0=Mon..6=Sun
  const dow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return (dow + 6) % 7;
}

export function CalendarioLaboral() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(currentYear);
  const [ccaa, setCcaa] = useState<string>("");
  const [data, setData] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const url = `/api/laboral/calendario?ejercicio=${year}${ccaa ? `&ccaa=${ccaa}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setData({
        ejercicio: json.ejercicio,
        ccaa: json.ccaa ?? null,
        dias_laborables_ano: json.dias_laborables_ano,
        festivos: json.festivos ?? [],
        por_mes: json.por_mes ?? [],
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, ccaa]);

  const festivosSet = useMemo(() => new Set(data?.festivos ?? []), [data]);

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div className="form three-cols">
        <label className="label">
          Año
          <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className="label">
          Comunidad autónoma
          <select className="input" value={ccaa} onChange={(e) => setCcaa(e.target.value)}>
            {CCAA.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <label className="label">
          Resumen anual
          <div className="input" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700 }}>{data?.dias_laborables_ano ?? "—"}</span>
            <span className="muted" style={{ fontSize: 12 }}>días laborables</span>
          </div>
        </label>
      </div>

      {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
      {loading && !data ? <p className="muted">Calculando calendario…</p> : null}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {MESES.map((nombre, idx) => {
          const month = idx + 1;
          const dim = daysInMonth(year, month);
          const offset = firstWeekdayMonStart(year, month);
          const cells: (number | null)[] = [];
          for (let i = 0; i < offset; i++) cells.push(null);
          for (let d = 1; d <= dim; d++) cells.push(d);
          const diasLab = data?.por_mes.find((m) => m.mes === month)?.dias_laborables ?? 0;
          return (
            <article key={month} className="card" style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <strong style={{ fontSize: 14 }}>{nombre}</strong>
                <span className="pill accent" style={{ fontSize: 11 }}>{diasLab} lab.</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, fontSize: 11 }}>
                {DOW.map((d) => (
                  <div key={d} style={{ textAlign: "center", color: "var(--muted)", padding: 4, fontFamily: "var(--mono)" }}>{d}</div>
                ))}
                {cells.map((d, i) => {
                  if (d === null) return <div key={`b${i}`} />;
                  const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
                  const isWeekend = dow === 0 || dow === 6;
                  const isFestivo = festivosSet.has(iso);
                  return (
                    <div
                      key={iso}
                      title={isFestivo ? "Festivo" : isWeekend ? "Finde" : "Laborable"}
                      style={{
                        textAlign: "center",
                        padding: "4px 0",
                        borderRadius: 4,
                        background: isFestivo
                          ? "color-mix(in srgb, var(--bad) 22%, transparent)"
                          : isWeekend
                          ? "color-mix(in srgb, var(--muted) 14%, transparent)"
                          : "color-mix(in srgb, var(--accent) 9%, transparent)",
                        color: isFestivo ? "var(--bad)" : isWeekend ? "var(--muted)" : "inherit",
                        fontWeight: isFestivo ? 700 : 400,
                      }}
                    >
                      {d}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      {data && data.festivos.length > 0 ? (
        <article className="card">
          <span className="card-eyebrow">Festivos del año {year} {data.ccaa ? `· ${data.ccaa}` : ""}</span>
          <ul style={{ margin: "8px 0 0", paddingLeft: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 6 }}>
            {data.festivos.map((f) => (
              <li key={f} style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{f}</li>
            ))}
          </ul>
        </article>
      ) : null}
    </section>
  );
}
