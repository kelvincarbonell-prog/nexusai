"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X, CalendarClock, Loader2, AlertOctagon, CheckCircle2, ArrowRight, Filter } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Item = {
  modelo: string;
  label: string;
  periodo: string;
  ejercicio: number;
  fecha_limite: string;
  dias_restantes: number;
  esta_presentada: boolean;
  empresa_id: string;
  empresa_nombre: string | null;
};

type Totales = { total: number; pendientes: number; presentadas: number; urgentes: number; vencidas: number };

type Filtro = "todas" | "pendientes" | "urgentes" | "vencidas" | "presentadas";

const EUR0 = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(n);

function urgenciaColor(o: Item): { color: string; label: string; bg: string } {
  if (o.esta_presentada) return { color: "#10b981", label: "Presentada", bg: "color-mix(in srgb, #10b981 12%, transparent)" };
  if (o.dias_restantes < 0) return { color: "#dc2626", label: `Vencida hace ${Math.abs(o.dias_restantes)}d`, bg: "color-mix(in srgb, #dc2626 12%, transparent)" };
  if (o.dias_restantes <= 3) return { color: "#dc2626", label: `${o.dias_restantes}d`, bg: "color-mix(in srgb, #dc2626 12%, transparent)" };
  if (o.dias_restantes <= 7) return { color: "#f59e0b", label: `${o.dias_restantes}d`, bg: "color-mix(in srgb, #f59e0b 12%, transparent)" };
  return { color: "#0ea5e9", label: `${o.dias_restantes}d`, bg: "color-mix(in srgb, #0ea5e9 10%, transparent)" };
}

export function CalendarioAeatModal({ onClose }: { onClose: () => void }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [items, setItems] = useState<Item[]>([]);
  const [totales, setTotales] = useState<Totales | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dias, setDias] = useState(60);
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [modeloFiltro, setModeloFiltro] = useState<string>("todos");

  async function load() {
    setLoading(true); setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch(`/api/aeat/calendario-cartera?dias=${dias}`, { headers: { Authorization: `Bearer ${tk}` } });
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
  }, [dias]);

  const modelosUnicos = useMemo(() => Array.from(new Set(items.map((i) => i.modelo))).sort(), [items]);

  const visibles = items.filter((it) => {
    if (modeloFiltro !== "todos" && it.modelo !== modeloFiltro) return false;
    if (filtro === "todas") return true;
    if (filtro === "pendientes") return !it.esta_presentada;
    if (filtro === "presentadas") return it.esta_presentada;
    if (filtro === "urgentes") return !it.esta_presentada && it.dias_restantes >= 0 && it.dias_restantes <= 7;
    if (filtro === "vencidas") return !it.esta_presentada && it.dias_restantes < 0;
    return true;
  });

  // Agrupado por fecha
  const grupos = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of visibles) {
      if (!m.has(it.fecha_limite)) m.set(it.fecha_limite, []);
      m.get(it.fecha_limite)!.push(it);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibles]);

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
              <CalendarClock size={12} /> Calendario AEAT unificado
            </span>
            <h2 style={{ fontSize: 18, margin: "4px 0 2px" }}>Próximas obligaciones de toda tu cartera</h2>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              303, 130, 111, 115, 390, 200, 347, 349… consolidado por fecha. Pendientes a la izquierda, ya presentadas a la derecha.
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
          <Filter size={12} style={{ opacity: 0.5 }} />
          {(["pendientes", "urgentes", "vencidas", "presentadas", "todas"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFiltro(f)} className={`button compact ${filtro === f ? "" : "ghost"}`}>
              {f === "pendientes" ? "Pendientes" : f === "urgentes" ? "Urgentes (7d)" : f === "vencidas" ? "Vencidas" : f === "presentadas" ? "Presentadas" : "Todas"}
            </button>
          ))}
          <span style={{ marginLeft: 16, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>Modelo:</span>
            <select className="input compact" value={modeloFiltro} onChange={(e) => setModeloFiltro(e.target.value)} style={{ fontSize: 12, padding: "4px 8px" }}>
              <option value="todos">Todos</option>
              {modelosUnicos.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </span>
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>Horizonte:</span>
            {[30, 60, 90].map((d) => (
              <button key={d} type="button" onClick={() => setDias(d)} className={`button compact ${dias === d ? "" : "ghost"}`}>{d}d</button>
            ))}
          </span>
        </div>

        {totales && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
            <Mini titulo="Total" valor={EUR0(totales.total)} color="#6366f1" />
            <Mini titulo="Pendientes" valor={EUR0(totales.pendientes)} color="#0ea5e9" />
            <Mini titulo="Urgentes (≤7d)" valor={EUR0(totales.urgentes)} color={totales.urgentes > 0 ? "#f59e0b" : "#10b981"} />
            <Mini titulo="Vencidas" valor={EUR0(totales.vencidas)} color={totales.vencidas > 0 ? "#dc2626" : "#10b981"} />
          </div>
        )}

        {error && <p role="alert" style={{ color: "var(--bad)" }}>{error}</p>}

        <div style={{ flex: 1, overflow: "auto", border: "1px solid var(--line, #e5e7eb)", borderRadius: 10 }}>
          {loading ? (
            <div style={{ padding: 24, display: "inline-flex", alignItems: "center", gap: 8, opacity: 0.7 }}>
              <Loader2 size={14} className="animate-spin" /> Calculando obligaciones para toda la cartera…
            </div>
          ) : grupos.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", display: "grid", gap: 8, placeItems: "center" }}>
              <CheckCircle2 size={28} color="#10b981" />
              <strong style={{ color: "#10b981" }}>Sin obligaciones en este filtro.</strong>
              <small className="muted">El calendario está limpio en el horizonte seleccionado.</small>
            </div>
          ) : (
            <div style={{ display: "grid" }}>
              {grupos.map(([fecha, items]) => {
                const fdate = new Date(fecha + "T00:00:00");
                const fmt = fdate.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
                const diasHoy = Math.ceil((fdate.getTime() - Date.now()) / 86_400_000);
                return (
                  <div key={fecha} style={{ borderBottom: "1px solid var(--line, #e5e7eb)" }}>
                    <div style={{ padding: "10px 14px", background: "color-mix(in srgb, currentColor 4%, transparent)", display: "flex", alignItems: "center", gap: 8 }}>
                      <CalendarClock size={13} color="var(--muted)" />
                      <strong style={{ fontSize: 13, textTransform: "capitalize" }}>{fmt}</strong>
                      <span className="muted" style={{ fontSize: 11 }}>
                        {diasHoy < 0 ? `${Math.abs(diasHoy)} día${Math.abs(diasHoy) === 1 ? "" : "s"} vencida` : diasHoy === 0 ? "hoy" : `en ${diasHoy} día${diasHoy === 1 ? "" : "s"}`}
                      </span>
                      <span className="muted" style={{ marginLeft: "auto", fontSize: 11 }}>{items.length} obligación{items.length === 1 ? "" : "es"}</span>
                    </div>
                    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                      {items.map((it, i) => {
                        const u = urgenciaColor(it);
                        return (
                          <li
                            key={`${it.empresa_id}-${it.modelo}-${it.periodo}-${i}`}
                            style={{
                              padding: "10px 14px",
                              display: "grid",
                              gridTemplateColumns: "80px 1fr auto auto",
                              gap: 12,
                              alignItems: "center",
                              borderTop: i === 0 ? "none" : "1px solid color-mix(in srgb, currentColor 6%, transparent)",
                              opacity: it.esta_presentada ? 0.7 : 1,
                            }}
                          >
                            <span style={{ fontFamily: "var(--mono, monospace)", fontWeight: 700, fontSize: 13, color: it.esta_presentada ? "var(--muted)" : "var(--ink)" }}>{it.modelo}</span>
                            <div style={{ minWidth: 0 }}>
                              <strong style={{ fontSize: 13, display: "block" }}>{it.empresa_nombre ?? "—"}</strong>
                              <span className="muted" style={{ fontSize: 11 }}>{it.label} · {it.periodo} {it.ejercicio}</span>
                            </div>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: u.bg, color: u.color, fontSize: 11, fontWeight: 600 }}>
                              {it.esta_presentada ? <CheckCircle2 size={11} /> : <AlertOctagon size={11} />} {u.label}
                            </span>
                            <Link
                              href={`/aeat?empresa=${it.empresa_id}&modelo=${it.modelo}&ejercicio=${it.ejercicio}&periodo=${it.periodo}`}
                              className="button compact ghost"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}
                            >
                              Abrir <ArrowRight size={11} />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
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
      display: "grid", gap: 4, textAlign: "center",
    }}>
      <div style={{ color, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{titulo}</div>
      <strong style={{ fontSize: 22 }}>{valor}</strong>
    </div>
  );
}
