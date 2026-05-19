"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X, ShieldAlert, Loader2, AlertOctagon, ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type CarteraItem = {
  empresa_id: string;
  nombre: string | null;
  nif: string | null;
  score: number;
  nivel: "bajo" | "medio" | "alto" | "muy_alto";
  red_flags_count: number;
  top_flag: string | null;
};

type Totales = { empresas: number; muy_alto: number; alto: number; medio: number; bajo: number };

type RedFlag = { codigo: string; titulo: string; detalle: string; peso: number };
type Detalle = { score: number; nivel: string; red_flags: RedFlag[]; recomendaciones: string[] };

const NIVEL_COLOR: Record<CarteraItem["nivel"], string> = {
  muy_alto: "#dc2626",
  alto: "#f59e0b",
  medio: "#0ea5e9",
  bajo: "#10b981",
};

const NIVEL_LABEL: Record<CarteraItem["nivel"], string> = {
  muy_alto: "Muy alto",
  alto: "Alto",
  medio: "Medio",
  bajo: "Bajo",
};

export function RiesgoAeatModal({ onClose }: { onClose: () => void }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [items, setItems] = useState<CarteraItem[]>([]);
  const [totales, setTotales] = useState<Totales | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<Record<string, Detalle | "loading">>({});

  async function token() {
    const { data: sess } = await supabase.auth.getSession();
    return sess.session?.access_token ?? "";
  }

  useEffect(() => {
    (async () => {
      try {
        const tk = await token();
        const res = await fetch("/api/agents/riesgo-inspeccion/cartera", { headers: { Authorization: `Bearer ${tk}` } });
        const j = await res.json();
        if (!j.ok) throw new Error(j.error ?? "Error");
        setItems(j.items ?? []);
        setTotales(j.totales ?? null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function expandirEmpresa(empresaId: string) {
    if (expanded === empresaId) {
      setExpanded(null);
      return;
    }
    setExpanded(empresaId);
    if (detalles[empresaId] && detalles[empresaId] !== "loading") return;
    setDetalles((d) => ({ ...d, [empresaId]: "loading" }));
    try {
      const tk = await token();
      const res = await fetch(`/api/agents/riesgo-inspeccion?empresa_id=${empresaId}`, { headers: { Authorization: `Bearer ${tk}` } });
      const j = await res.json();
      if (j.ok) setDetalles((d) => ({ ...d, [empresaId]: { score: j.score, nivel: j.nivel, red_flags: j.red_flags ?? [], recomendaciones: j.recomendaciones ?? [] } }));
    } catch {
      // ignora
    }
  }

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
              <ShieldAlert size={12} /> Riesgo AEAT por cliente
            </span>
            <h2 style={{ fontSize: 18, margin: "4px 0 2px" }}>Probabilidad de inspección</h2>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Score 0-100 calculado con 8 red flags típicos (variación facturación, 347/349 sin presentar, márgenes anómalos, modelos atrasados, paraísos fiscales…).
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar"
            style={{
              border: "1px solid var(--line, #d1d5db)", background: "#ffffff", cursor: "pointer",
              width: 32, height: 32, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "#374151",
            }}><X size={16} /></button>
        </header>

        {totales && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
            <Mini titulo="Muy alto" valor={String(totales.muy_alto)} color={NIVEL_COLOR.muy_alto} />
            <Mini titulo="Alto" valor={String(totales.alto)} color={NIVEL_COLOR.alto} />
            <Mini titulo="Medio" valor={String(totales.medio)} color={NIVEL_COLOR.medio} />
            <Mini titulo="Bajo" valor={String(totales.bajo)} color={NIVEL_COLOR.bajo} />
          </div>
        )}

        {error && <p role="alert" style={{ color: "var(--bad)" }}>{error}</p>}

        <div style={{ flex: 1, overflow: "auto", border: "1px solid var(--line, #e5e7eb)", borderRadius: 10 }}>
          {loading ? (
            <div style={{ padding: 24, display: "inline-flex", alignItems: "center", gap: 8, opacity: 0.7 }}>
              <Loader2 size={14} className="animate-spin" /> Analizando 8 red flags por empresa…
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center" }}>
              <p className="muted">Sin empresas en cartera.</p>
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {items.map((it, i) => {
                const isOpen = expanded === it.empresa_id;
                const detalle = detalles[it.empresa_id];
                return (
                  <li key={it.empresa_id} style={{ borderBottom: i < items.length - 1 ? "1px solid var(--line, #e5e7eb)" : "none" }}>
                    <button
                      type="button"
                      onClick={() => expandirEmpresa(it.empresa_id)}
                      style={{
                        width: "100%",
                        background: "transparent",
                        border: 0,
                        padding: 14,
                        display: "grid",
                        gridTemplateColumns: "auto 1fr auto auto",
                        gap: 12,
                        alignItems: "center",
                        cursor: "pointer",
                        textAlign: "left",
                        color: "var(--ink)",
                        fontFamily: "inherit",
                      }}
                    >
                      <ScoreBadge score={it.score} nivel={it.nivel} />
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: 14, display: "block" }}>{it.nombre ?? "—"}</strong>
                        <span className="muted" style={{ fontSize: 11, fontFamily: "var(--mono, monospace)" }}>{it.nif ?? "—"}</span>
                        {it.top_flag && (
                          <div style={{ fontSize: 12, marginTop: 4, color: NIVEL_COLOR[it.nivel], display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <AlertOctagon size={11} /> {it.top_flag}
                          </div>
                        )}
                      </div>
                      <span className="pill" style={{
                        background: `color-mix(in srgb, ${NIVEL_COLOR[it.nivel]} 14%, transparent)`,
                        color: NIVEL_COLOR[it.nivel], fontSize: 11, fontWeight: 600,
                      }}>{NIVEL_LABEL[it.nivel]}</span>
                      {isOpen ? <ChevronDown size={16} style={{ opacity: 0.6 }} /> : <ChevronRight size={16} style={{ opacity: 0.6 }} />}
                    </button>

                    {isOpen && (
                      <div style={{ padding: "0 14px 14px", display: "grid", gap: 10 }}>
                        {detalle === "loading" || !detalle ? (
                          <p className="muted" style={{ fontSize: 12 }}><Loader2 size={12} className="animate-spin" style={{ verticalAlign: "middle", marginRight: 4 }} /> Cargando detalle…</p>
                        ) : (
                          <>
                            {detalle.red_flags.length > 0 ? (
                              <div style={{ display: "grid", gap: 6 }}>
                                <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 }}>Red flags activos</div>
                                {detalle.red_flags.map((f) => (
                                  <div key={f.codigo} style={{ padding: 10, borderRadius: 8, background: "color-mix(in srgb, #ef4444 5%, transparent)", border: "1px solid color-mix(in srgb, #ef4444 22%, transparent)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                      <strong style={{ fontSize: 13 }}>{f.titulo}</strong>
                                      <span style={{ fontSize: 11, fontWeight: 600, color: "#ef4444" }}>+{f.peso} pts</span>
                                    </div>
                                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>{f.detalle}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p style={{ fontSize: 12, color: "var(--good)" }}>Sin red flags activos en esta empresa.</p>
                            )}

                            {detalle.recomendaciones.length > 0 && (
                              <div style={{ display: "grid", gap: 4 }}>
                                <div className="muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 600 }}>Recomendaciones</div>
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--ink)", lineHeight: 1.5 }}>
                                  {detalle.recomendaciones.map((r, i) => <li key={i}>{r}</li>)}
                                </ul>
                              </div>
                            )}

                            <Link
                              href={`/clientes/${it.empresa_id}`}
                              className="button compact"
                              style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              Abrir ficha del cliente <ArrowRight size={11} />
                            </Link>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
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
      background: `color-mix(in srgb, ${color} 6%, transparent)`,
      display: "grid", gap: 4, textAlign: "center",
    }}>
      <div style={{ color, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{titulo}</div>
      <strong style={{ fontSize: 22 }}>{valor}</strong>
    </div>
  );
}

function ScoreBadge({ score, nivel }: { score: number; nivel: CarteraItem["nivel"] }) {
  const color = NIVEL_COLOR[nivel];
  return (
    <div style={{
      width: 50, height: 50, borderRadius: "50%",
      background: `conic-gradient(${color} ${score * 3.6}deg, color-mix(in srgb, currentColor 12%, transparent) 0)`,
      display: "grid", placeItems: "center",
      flexShrink: 0,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        background: "var(--card, #fff)",
        display: "grid", placeItems: "center",
        fontSize: 13, fontWeight: 700, color,
      }}>{score}</div>
    </div>
  );
}
