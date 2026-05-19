"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X, FileCheck2, Loader2, AlertTriangle, CheckCircle2, ArrowRight, Filter } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Item = {
  empresa_id: string;
  nombre: string | null;
  nif: string | null;
  account_type: string | null;
  n_facturas: number;
  n_gastos: number;
  resultado: number; // + ingresar, - compensar
  warnings_count: number;
  status: "pendiente" | "borrador" | "revisado" | "presentado" | "error";
  presentado_en: string | null;
};

type Totales = {
  a_ingresar: number;
  a_compensar: number;
  empresas: number;
  pendientes: number;
  borradores: number;
  presentados: number;
  con_warnings: number;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

type FiltroEstado = "todos" | "pendiente" | "borrador" | "presentado";

function trimestreActual(): { ejercicio: number; periodo: string } {
  const d = new Date();
  const t = Math.ceil((d.getUTCMonth() + 1) / 3);
  return { ejercicio: d.getUTCFullYear(), periodo: `${t}T` };
}

export function Borrador303Modal({ onClose }: { onClose: () => void }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const inicial = trimestreActual();
  const [ejercicio, setEjercicio] = useState(inicial.ejercicio);
  const [periodo, setPeriodo] = useState(inicial.periodo);
  const [items, setItems] = useState<Item[]>([]);
  const [totales, setTotales] = useState<Totales | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");

  async function load() {
    setLoading(true); setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch(`/api/aeat/303/cartera-resumen?ejercicio=${ejercicio}&periodo=${periodo}`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
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
  }, [ejercicio, periodo]);

  const visibles = items.filter((i) => filtro === "todos" || i.status === filtro);

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
              <FileCheck2 size={12} /> Borrador 303 del trimestre
            </span>
            <h2 style={{ fontSize: 18, margin: "4px 0 2px" }}>Vista cartera — {periodo} · {ejercicio}</h2>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Cálculo automático del modelo 303 para cada empresa: bases + cuotas repercutidas y soportadas, resultado a ingresar/compensar.
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar"
            style={{
              border: "1px solid var(--line, #d1d5db)", background: "var(--card, #fff)", cursor: "pointer",
              width: 32, height: 32, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "var(--ink, #111)",
            }}><X size={16} /></button>
        </header>

        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <Filter size={12} style={{ opacity: 0.5 }} />
          {(["todos", "pendiente", "borrador", "presentado"] as const).map((f) => (
            <button key={f} type="button" className={`button compact ${filtro === f ? "" : "ghost"}`} onClick={() => setFiltro(f)}>
              {f === "todos" ? "Todos" : f === "pendiente" ? "Pendientes" : f === "borrador" ? "Borradores" : "Presentados"}
            </button>
          ))}
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <select className="input compact" value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={{ fontSize: 12, padding: "4px 8px" }}>
              <option value="1T">1T</option><option value="2T">2T</option><option value="3T">3T</option><option value="4T">4T</option>
            </select>
            <select className="input compact" value={ejercicio} onChange={(e) => setEjercicio(Number(e.target.value))} style={{ fontSize: 12, padding: "4px 8px" }}>
              {[ejercicio + 1, ejercicio, ejercicio - 1, ejercicio - 2].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </span>
        </div>

        {totales && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <Mini titulo="Total a ingresar" valor={EUR(totales.a_ingresar)} tono="bad" />
            <Mini titulo="Total a compensar" valor={EUR(totales.a_compensar)} tono="ok" />
            <Mini titulo="Empresas analizadas" valor={String(totales.empresas)} />
            <Mini titulo="Pendientes / borradores / presentados" valor={`${totales.pendientes} / ${totales.borradores} / ${totales.presentados}`} />
          </div>
        )}

        {error && <p role="alert" style={{ color: "var(--bad)" }}>{error}</p>}

        <div style={{ flex: 1, overflow: "auto", border: "1px solid var(--line, #e5e7eb)", borderRadius: 10 }}>
          {loading ? (
            <div style={{ padding: 24, display: "inline-flex", alignItems: "center", gap: 8, opacity: 0.7 }}>
              <Loader2 size={14} className="animate-spin" /> Calculando 303 para {totales?.empresas ?? "todas las"} empresas del despacho…
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
                  <th>NIF</th>
                  <th className="num">Facturas / Gastos</th>
                  <th className="num">Resultado</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((it) => (
                  <tr key={it.empresa_id}>
                    <td>
                      <strong>{it.nombre ?? "—"}</strong>
                      {it.warnings_count > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 6, fontSize: 11, color: "#f59e0b" }}>
                          <AlertTriangle size={11} /> {it.warnings_count}
                        </span>
                      )}
                    </td>
                    <td style={{ fontFamily: "var(--mono, monospace)", fontSize: 12 }}>{it.nif ?? "—"}</td>
                    <td className="num" style={{ fontSize: 12 }}>{it.n_facturas} / {it.n_gastos}</td>
                    <td className="num" style={{
                      fontWeight: 600,
                      color: it.resultado > 0 ? "#ef4444" : it.resultado < 0 ? "#10b981" : "var(--muted)",
                    }}>
                      {it.resultado === 0 ? "—" : EUR(it.resultado)}
                    </td>
                    <td>
                      <EstadoPill estado={it.status} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <Link
                        href={`/aeat?empresa=${it.empresa_id}&modelo=303&ejercicio=${ejercicio}&periodo=${periodo}`}
                        className="button compact"
                        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        Abrir <ArrowRight size={11} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="muted" style={{ fontSize: 11, margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <CheckCircle2 size={12} /> Los importes salen de las facturas y gastos cargados. Al pulsar «Abrir» revisas casillas y firmas.
        </div>
      </div>
    </div>
  );
}

function Mini({ titulo, valor, tono }: { titulo: string; valor: string; tono?: "ok" | "warn" | "bad" }) {
  const color = tono === "bad" ? "#ef4444" : tono === "warn" ? "#f59e0b" : tono === "ok" ? "#10b981" : "currentColor";
  return (
    <div style={{
      padding: 12, borderRadius: 10,
      border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      background: `color-mix(in srgb, ${color} 4%, transparent)`,
      display: "grid", gap: 4,
    }}>
      <div style={{ color, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{titulo}</div>
      <strong style={{ fontSize: 18 }}>{valor}</strong>
    </div>
  );
}

function EstadoPill({ estado }: { estado: Item["status"] }) {
  const map: Record<Item["status"], { label: string; color: string; bg: string }> = {
    pendiente: { label: "Pendiente", color: "#f59e0b", bg: "#f59e0b14" },
    borrador: { label: "Borrador", color: "#6366f1", bg: "#6366f114" },
    revisado: { label: "Revisado", color: "#0ea5e9", bg: "#0ea5e914" },
    presentado: { label: "Presentado", color: "#10b981", bg: "#10b98114" },
    error: { label: "Error", color: "#ef4444", bg: "#ef444414" },
  };
  const { label, color, bg } = map[estado];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 999, background: bg, color, fontSize: 11, fontWeight: 600 }}>
      {label}
    </span>
  );
}
