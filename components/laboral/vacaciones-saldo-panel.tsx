"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sun, Calendar, AlertTriangle } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Item = {
  trabajador_id: string;
  nombre: string;
  base_anual: number;
  generados: number;
  disfrutados: number;
  pendientes: number;
  saldo: number;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES").format(n);

export function VacacionesSaldoPanel({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [anyo, setAnyo] = useState(new Date().getUTCFullYear());
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const tk = sess.session?.access_token ?? "";
        const res = await fetch(`/api/laboral/vacaciones/saldo?empresa_id=${empresaId}&anyo=${anyo}`, {
          headers: { Authorization: `Bearer ${tk}` },
        });
        const j = await res.json();
        if (!j.ok) throw new Error(j.error ?? "Error");
        if (alive) setItems(j.items ?? []);
      } catch (e: unknown) {
        if (alive) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [empresaId, anyo, supabase]);

  const stats = items.reduce(
    (acc, x) => ({
      base: acc.base + x.base_anual,
      disfrutados: acc.disfrutados + x.disfrutados,
      pendientes: acc.pendientes + x.pendientes,
      saldo: acc.saldo + x.saldo,
    }),
    { base: 0, disfrutados: 0, pendientes: 0, saldo: 0 },
  );

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Sun size={18} />
        <h3 style={{ margin: 0 }}>Vacaciones · saldo {anyo}</h3>
        <div style={{ marginLeft: "auto" }}>
          <select value={anyo} onChange={(e) => setAnyo(Number(e.target.value))} style={selectStyle}>
            {[0, -1, -2].map((d) => {
              const y = new Date().getUTCFullYear() + d;
              return <option key={y} value={y}>{y}</option>;
            })}
          </select>
        </div>
      </header>

      <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
        Días generados según convenio (con prorrateo si el alta/baja fue a mitad de año), descontando
        disfrutados (aprobados) y pendientes (solicitudes en curso).
      </p>

      {loading ? (
        <span style={{ fontSize: 13, opacity: 0.7, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={14} className="animate-spin" /> Calculando…
        </span>
      ) : error ? (
        <div style={{ padding: 10, borderRadius: 8, background: "#ef444412", border: "1px solid #ef444455", color: "#ef4444", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={14} />{error}
        </div>
      ) : items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, opacity: 0.65 }}>Sin trabajadores activos.</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
            <Mini titulo="Total generados" valor={`${EUR(stats.base)} días`} />
            <Mini titulo="Disfrutados" valor={`${EUR(stats.disfrutados)} días`} />
            <Mini titulo="Pendientes" valor={`${EUR(stats.pendientes)} días`} tono={stats.pendientes > 0 ? "warn" : undefined} />
            <Mini titulo="Saldo restante" valor={`${EUR(stats.saldo)} días`} tono="ok" />
          </div>

          <div style={{ overflow: "auto", border: "1px solid color-mix(in srgb, currentColor 12%, transparent)", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "color-mix(in srgb, currentColor 5%, transparent)", textAlign: "left" }}>
                  <th style={th}>Trabajador</th>
                  <th style={thNum}>Base</th>
                  <th style={thNum}>Generados</th>
                  <th style={thNum}>Disfrutados</th>
                  <th style={thNum}>Pendientes</th>
                  <th style={thNum}>Saldo</th>
                  <th style={{ ...th, minWidth: 140 }}>Progreso</th>
                </tr>
              </thead>
              <tbody>
                {items.map((x) => {
                  const consumido = x.disfrutados + x.pendientes;
                  const pct = x.generados > 0 ? Math.min(100, Math.round((consumido / x.generados) * 100)) : 0;
                  const alerta = x.saldo < 0;
                  return (
                    <tr key={x.trabajador_id} style={{ borderTop: "1px solid color-mix(in srgb, currentColor 10%, transparent)" }}>
                      <td style={td}><strong>{x.nombre}</strong></td>
                      <td style={tdNum}>{x.base_anual}</td>
                      <td style={tdNum}>{x.generados}</td>
                      <td style={tdNum}>{x.disfrutados}</td>
                      <td style={tdNum}>{x.pendientes > 0 ? <span style={{ color: "#f59e0b" }}>{x.pendientes}</span> : "0"}</td>
                      <td style={{ ...tdNum, fontWeight: 700, color: alerta ? "#ef4444" : x.saldo === 0 ? "#6b7280" : "#10b981" }}>
                        {x.saldo}
                      </td>
                      <td style={td}>
                        <div style={{ display: "grid", gap: 4 }}>
                          <div style={{ height: 6, borderRadius: 3, background: "color-mix(in srgb, currentColor 10%, transparent)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${pct}%`, background: alerta ? "#ef4444" : pct > 80 ? "#f59e0b" : "var(--accent, #6366f1)", transition: "width 0.3s" }} />
                          </div>
                          <span style={{ fontSize: 10, opacity: 0.6 }}>{pct}% consumido</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, opacity: 0.6 }}>
            <Calendar size={11} />
            Las solicitudes pendientes pasan a "disfrutadas" cuando las apruebas en la pestaña Ausencias.
          </div>
        </>
      )}
    </section>
  );
}

function Mini({ titulo, valor, tono }: { titulo: string; valor: string; tono?: "ok" | "warn" }) {
  const border = tono === "ok" ? "#10b98155" : tono === "warn" ? "#f59e0b55" : "color-mix(in srgb, currentColor 14%, transparent)";
  const bg = tono === "ok" ? "#10b98108" : tono === "warn" ? "#f59e0b08" : "color-mix(in srgb, currentColor 4%, transparent)";
  return (
    <div style={{ padding: 12, borderRadius: 10, border: `1px solid ${border}`, background: bg, display: "grid", gap: 2 }}>
      <span style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.4 }}>{titulo}</span>
      <strong style={{ fontSize: 17 }}>{valor}</strong>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "6px 10px", borderRadius: 8, border: "1px solid color-mix(in srgb, currentColor 16%, transparent)",
  background: "color-mix(in srgb, currentColor 4%, transparent)", color: "inherit", fontSize: 13,
};
const th: React.CSSProperties = { padding: "10px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, opacity: 0.7 };
const thNum: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "10px 12px" };
const tdNum: React.CSSProperties = { ...td, textAlign: "right", fontFamily: "var(--mono, monospace)" };
