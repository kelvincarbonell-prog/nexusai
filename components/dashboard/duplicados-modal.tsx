"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X, ScanSearch, AlertOctagon, Loader2, FileText, Receipt, ArrowRight, Filter } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type GrupoItem = {
  id: string;
  descripcion: string;
  fecha: string;
  total: number;
  numero?: string | null;
};

type Grupo = {
  empresa_id: string;
  empresa_nombre: string | null;
  tipo: "factura" | "gasto";
  parte: string;
  total: number;
  confianza: number;
  razones: string[];
  items: GrupoItem[];
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

type Filtro = "todos" | "gasto" | "factura";

export function DuplicadosModal({ onClose }: { onClose: () => void }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [meses, setMeses] = useState(6);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [error, setError] = useState<string | null>(null);

  async function scan(months: number) {
    setLoading(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch(`/api/agents/escaneo-duplicados?meses=${months}&tipo=ambos`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Error");
      setGrupos(j.grupos ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    scan(meses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meses]);

  const visibles = grupos.filter((g) => filtro === "todos" || g.tipo === filtro);

  // Suma del importe potencialmente duplicado (1ª aparición se mantiene, el resto sería el riesgo)
  const importeRiesgo = visibles.reduce((s, g) => s + g.total * (g.items.length - 1), 0);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1000, display: "grid", placeItems: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: "min(960px, 100%)", maxHeight: "90vh", display: "flex", flexDirection: "column", gap: 14, padding: 18 }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <span className="card-eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ScanSearch size={12} /> Detector de duplicados
            </span>
            <h2 style={{ fontSize: 18, margin: "4px 0 2px" }}>Escaneo de cartera</h2>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Agrupa por proveedor + importe + ventana de 15 días. Cada grupo es un posible duplicado contable.
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" title="Cerrar"
            style={{
              border: "1px solid var(--line, #d1d5db)", background: "var(--panel, #fff)", cursor: "pointer",
              width: 32, height: 32, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "var(--ink, #111)",
            }}><X size={16} /></button>
        </header>

        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <Filter size={12} style={{ opacity: 0.5 }} />
          {(["todos", "gasto", "factura"] as const).map((f) => (
            <button key={f} type="button" className={`button compact ${filtro === f ? "" : "ghost"}`} onClick={() => setFiltro(f)}>
              {f === "todos" ? "Todos" : f === "gasto" ? "Gastos" : "Facturas"}
            </button>
          ))}
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="muted" style={{ fontSize: 12 }}>Periodo:</span>
            {[3, 6, 12].map((m) => (
              <button key={m} type="button" className={`button compact ${meses === m ? "" : "ghost"}`} onClick={() => setMeses(m)}>
                {m}m
              </button>
            ))}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <Mini titulo="Grupos sospechosos" valor={String(visibles.length)} tono={visibles.length > 0 ? "warn" : "ok"} />
          <Mini titulo="Total elementos" valor={String(visibles.reduce((s, g) => s + g.items.length, 0))} />
          <Mini titulo="Importe en riesgo" valor={EUR(importeRiesgo)} tono={importeRiesgo > 0 ? "bad" : "ok"} />
        </div>

        {error && <p role="alert" style={{ color: "var(--bad)" }}>{error}</p>}

        <div style={{ flex: 1, overflow: "auto", border: "1px solid var(--line, #e5e7eb)", borderRadius: 10 }}>
          {loading ? (
            <div style={{ padding: 24, display: "inline-flex", alignItems: "center", gap: 8, opacity: 0.7 }}>
              <Loader2 size={14} className="animate-spin" /> Analizando los últimos {meses} meses de toda tu cartera…
            </div>
          ) : visibles.length === 0 ? (
            <div style={{ padding: 24, display: "grid", gap: 6, placeItems: "center", textAlign: "center" }}>
              <strong style={{ color: "var(--good)" }}>Sin duplicados sospechosos.</strong>
              <small className="muted">No hemos encontrado grupos con mismo proveedor + importe + fecha cercana en los últimos {meses} meses.</small>
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid" }}>
              {visibles.map((g, i) => (
                <li key={i} style={{ padding: 14, borderBottom: i < visibles.length - 1 ? "1px solid var(--line, #e5e7eb)" : "none", display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                    {g.tipo === "factura" ? <FileText size={14} /> : <Receipt size={14} />}
                    <strong style={{ fontSize: 14 }}>{g.parte}</strong>
                    <span className="muted" style={{ fontSize: 12 }}>· {g.empresa_nombre ?? "—"}</span>
                    <span style={{
                      marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                      background: g.confianza >= 85 ? "color-mix(in srgb, #ef4444 14%, transparent)" : "color-mix(in srgb, #f59e0b 14%, transparent)",
                      color: g.confianza >= 85 ? "#ef4444" : "#f59e0b",
                    }}>
                      <AlertOctagon size={10} /> {g.confianza}% probable
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {g.razones.join(" · ")} — {g.items.length} elementos · {EUR(g.total)} cada uno
                  </div>
                  <table className="table" style={{ fontSize: 12, marginTop: 4 }}>
                    <thead>
                      <tr><th>Fecha</th><th>Descripción</th><th className="num">Importe</th><th></th></tr>
                    </thead>
                    <tbody>
                      {g.items.map((it) => (
                        <tr key={it.id}>
                          <td style={{ fontFamily: "var(--mono, monospace)" }}>{it.fecha}</td>
                          <td>{it.descripcion}</td>
                          <td className="num">{EUR(it.total)}</td>
                          <td style={{ textAlign: "right" }}>
                            <Link
                              href={`/clientes/${g.empresa_id}?tab=${g.tipo === "factura" ? "ingresos" : "gastos"}&id=${it.id}`}
                              className="button compact ghost"
                              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              Revisar <ArrowRight size={10} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </li>
              ))}
            </ul>
          )}
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
      <strong style={{ fontSize: 22 }}>{valor}</strong>
    </div>
  );
}
