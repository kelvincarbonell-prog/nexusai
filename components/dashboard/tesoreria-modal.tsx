"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X, Wallet, Loader2, TrendingDown, TrendingUp, AlertOctagon, ArrowRight, CalendarClock } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Item = {
  empresa_id: string;
  nombre: string | null;
  nif: string | null;
  saldo_actual: number;
  cobros_previstos: number;
  pagos_previstos: number;
  saldo_final: number;
  saldo_minimo: number;
  dia_descubierto: string | null;
  nivel: "ok" | "atencion" | "critico";
};

type Totales = {
  empresas: number;
  en_riesgo: number;
  criticos: number;
  saldo_cartera: number;
  cobros: number;
  pagos: number;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const EURf = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

const NIVEL: Record<Item["nivel"], { color: string; label: string; bg: string }> = {
  critico: { color: "#dc2626", label: "Descubierto", bg: "color-mix(in srgb, #dc2626 12%, transparent)" },
  atencion: { color: "#f59e0b", label: "Atención", bg: "color-mix(in srgb, #f59e0b 12%, transparent)" },
  ok: { color: "#10b981", label: "OK", bg: "color-mix(in srgb, #10b981 12%, transparent)" },
};

export function TesoreriaModal({ onClose }: { onClose: () => void }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [items, setItems] = useState<Item[]>([]);
  const [totales, setTotales] = useState<Totales | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [horizonte, setHorizonte] = useState<30 | 60 | 90>(30);
  const [filtro, setFiltro] = useState<"todos" | "riesgo" | "critico">("todos");

  async function load() {
    setLoading(true); setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch(`/api/accounting/tesoreria/cartera?horizonte=${horizonte}`, { headers: { Authorization: `Bearer ${tk}` } });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Error");
      setItems(j.items ?? []);
      setTotales(j.totales ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horizonte]);

  const visibles = items.filter((i) => {
    if (filtro === "todos") return true;
    if (filtro === "riesgo") return i.nivel !== "ok";
    return i.nivel === "critico";
  });

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "grid", placeItems: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: "min(1040px, 100%)", maxHeight: "90vh", display: "flex", flexDirection: "column", gap: 14, padding: 18 }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <span className="card-eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Wallet size={12} /> Tesorería de la cartera
            </span>
            <h2 style={{ fontSize: 18, margin: "4px 0 2px" }}>Proyección a {horizonte} días</h2>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Saldo actual + cobros previstos (facturas emitidas) − pagos previstos (facturas recibidas + gastos pendientes).
              Marca en rojo los clientes que se quedarán en descubierto.
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar"
            style={{
              border: "1px solid var(--line, #d1d5db)", background: "#ffffff", cursor: "pointer",
              width: 32, height: 32, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "#374151",
            }}><X size={16} /></button>
        </header>

        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: 12 }}>Horizonte:</span>
          {([30, 60, 90] as const).map((h) => (
            <button key={h} type="button" onClick={() => setHorizonte(h)} className={`button compact ${horizonte === h ? "" : "ghost"}`}>{h}d</button>
          ))}
          <span style={{ marginLeft: 16 }} />
          <span className="muted" style={{ fontSize: 12 }}>Filtro:</span>
          {(["todos", "riesgo", "critico"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFiltro(f)} className={`button compact ${filtro === f ? "" : "ghost"}`}>
              {f === "todos" ? "Todos" : f === "riesgo" ? "En riesgo" : "Solo críticos"}
            </button>
          ))}
        </div>

        {totales && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
            <Mini titulo="Saldo cartera" valor={EUR(totales.saldo_cartera)} color="#0ea5e9" />
            <Mini titulo="Cobros previstos" valor={EUR(totales.cobros)} color="#10b981" />
            <Mini titulo="Pagos previstos" valor={EUR(totales.pagos)} color="#f59e0b" />
            <Mini titulo="En riesgo" valor={`${totales.en_riesgo} / ${totales.empresas}`} color={totales.en_riesgo > 0 ? "#dc2626" : "#10b981"} />
          </div>
        )}

        {error && <p role="alert" style={{ color: "var(--bad)" }}>{error}</p>}

        <div style={{ flex: 1, overflow: "auto", border: "1px solid var(--line, #e5e7eb)", borderRadius: 10 }}>
          {loading ? (
            <div style={{ padding: 24, display: "inline-flex", alignItems: "center", gap: 8, opacity: 0.7 }}>
              <Loader2 size={14} className="animate-spin" /> Proyectando tesorería a {horizonte} días para toda la cartera…
            </div>
          ) : visibles.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center" }}>
              <p className="muted">Sin empresas en este filtro.</p>
            </div>
          ) : (
            <table className="table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th className="num">Saldo hoy</th>
                  <th className="num">Cobros</th>
                  <th className="num">Pagos</th>
                  <th className="num">Saldo final</th>
                  <th>Día descubierto</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((it) => {
                  const n = NIVEL[it.nivel];
                  return (
                    <tr key={it.empresa_id}>
                      <td>
                        <strong>{it.nombre ?? "—"}</strong>
                        <span className="muted" style={{ marginLeft: 6, fontSize: 11, fontFamily: "var(--mono, monospace)" }}>{it.nif ?? "—"}</span>
                      </td>
                      <td className="num">{EURf(it.saldo_actual)}</td>
                      <td className="num" style={{ color: "#10b981" }}>
                        <TrendingUp size={11} style={{ verticalAlign: "middle", marginRight: 2 }} />{EURf(it.cobros_previstos)}
                      </td>
                      <td className="num" style={{ color: "#f59e0b" }}>
                        <TrendingDown size={11} style={{ verticalAlign: "middle", marginRight: 2 }} />{EURf(it.pagos_previstos)}
                      </td>
                      <td className="num" style={{ fontWeight: 700, color: it.saldo_final < 0 ? "#dc2626" : "var(--ink)" }}>
                        {EURf(it.saldo_final)}
                      </td>
                      <td>
                        {it.dia_descubierto ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, background: n.bg, color: n.color, fontSize: 11, fontWeight: 600 }}>
                            <AlertOctagon size={10} /> {it.dia_descubierto}
                          </span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 999, background: n.bg, color: n.color, fontSize: 11, fontWeight: 600 }}>
                            {n.label}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link
                          href={`/clientes/${it.empresa_id}?tab=bancos`}
                          className="button compact"
                          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          Ver tesorería <ArrowRight size={11} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="muted" style={{ fontSize: 11, margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <CalendarClock size={12} /> Saldo actual = último movimiento bancario importado. Cobros/pagos = facturas y gastos pendientes con fecha en el horizonte.
        </div>
      </div>
    </div>
  );
}

function Mini({ titulo, valor, color }: { titulo: string; valor: string; color: string }) {
  return (
    <div style={{
      padding: 12, borderRadius: 10,
      border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      background: `color-mix(in srgb, ${color} 4%, transparent)`,
      display: "grid", gap: 4,
    }}>
      <div style={{ color, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{titulo}</div>
      <strong style={{ fontSize: 20 }}>{valor}</strong>
    </div>
  );
}
