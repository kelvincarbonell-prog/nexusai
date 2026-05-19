"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { X, Banknote, Loader2, CheckCircle2, AlertTriangle, ArrowRight, UploadCloud, Sparkles } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type EmpresaResultado = {
  empresa_id: string;
  nombre: string | null;
  trabajadores: number;
  generadas: number;
  saltadas: number;
  errores: number;
  total_bruto: number;
  total_liquido: number;
  total_ss_empresa: number;
  total_ss_trab: number;
  total_irpf: number;
  coste_empresa: number;
};

type Totales = {
  empresas: number;
  empresas_con_nominas: number;
  trabajadores: number;
  generadas: number;
  saltadas: number;
  errores: number;
  total_bruto: number;
  total_liquido: number;
  total_ss_empresa: number;
  total_ss_trab: number;
  total_irpf: number;
  coste_total: number;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
const EUR0 = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

function mesActual() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function AutocierreNominasModal({ onClose }: { onClose: () => void }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [periodo, setPeriodo] = useState(mesActual());
  const [sobreescribir, setSobreescribir] = useState(false);
  const [publicar, setPublicar] = useState(false);
  const [phase, setPhase] = useState<"idle" | "ejecutando" | "ok" | "error">("idle");
  const [totales, setTotales] = useState<Totales | null>(null);
  const [porEmpresa, setPorEmpresa] = useState<EmpresaResultado[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [frase, setFrase] = useState(0);

  const FRASES = [
    "Leyendo plantilla de cada cliente…",
    "Aplicando convenio + bases SS 2026…",
    "Calculando retención IRPF dinámica…",
    "Sumando trienios y pagas extras…",
    "Guardando recibos en cada cliente…",
  ];

  async function ejecutar() {
    setPhase("ejecutando");
    setError(null);
    setTotales(null);
    setPorEmpresa([]);

    const rot = setInterval(() => setFrase((i) => (i + 1) % FRASES.length), 1300);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/laboral/nominas/cartera-cierre", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ periodo, sobreescribir, publicar }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Error");
      setTotales(j.totales);
      setPorEmpresa(j.por_empresa ?? []);
      setPhase("ok");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
      setPhase("error");
    } finally {
      clearInterval(rot);
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
        style={{ width: "min(1040px, 100%)", maxHeight: "90vh", display: "flex", flexDirection: "column", gap: 14, padding: 18 }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div>
            <span className="card-eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Banknote size={12} /> Cierre nóminas del mes
            </span>
            <h2 style={{ fontSize: 18, margin: "4px 0 2px" }}>Cartera completa</h2>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>
              Genera todas las nóminas del mes para tus empresas en un click. Incluye pagas extras, trienios, conceptos, SS y retención IRPF dinámica.
            </p>
          </div>
          <button onClick={onClose} aria-label="Cerrar"
            style={{
              border: "1px solid var(--line, #d1d5db)", background: "#ffffff", cursor: "pointer",
              width: 32, height: 32, borderRadius: 8, display: "inline-flex", alignItems: "center", justifyContent: "center",
              color: "#374151",
            }}><X size={16} /></button>
        </header>

        {phase === "idle" || phase === "error" ? (
          <div style={{ padding: 16, borderRadius: 10, background: "color-mix(in srgb, var(--accent) 5%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)", display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10, alignItems: "end" }}>
              <label className="label">
                Periodo
                <input type="month" className="input" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, paddingBottom: 8 }}>
                <input type="checkbox" checked={sobreescribir} onChange={(e) => setSobreescribir(e.target.checked)} />
                Sobreescribir las existentes
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, paddingBottom: 8 }}>
                <input type="checkbox" checked={publicar} onChange={(e) => setPublicar(e.target.checked)} />
                Publicar al portal cliente
              </label>
              <button
                type="button"
                className="button"
                onClick={ejecutar}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, paddingInline: 16 }}
              >
                <Sparkles size={14} /> Cerrar nóminas
              </button>
            </div>
            {error && <p role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
          </div>
        ) : null}

        {phase === "ejecutando" && (
          <div
            style={{
              display: "grid", placeItems: "center", gap: 14,
              padding: 40,
              borderRadius: 12,
              background: "color-mix(in srgb, var(--accent) 5%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent) 18%, transparent)",
              textAlign: "center",
            }}
          >
            <div style={{ position: "relative", width: 90, height: 90 }}>
              <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "color-mix(in srgb, var(--accent) 22%, transparent)", animation: "anim-pulse 1.6s ease-out infinite" }} />
              <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "color-mix(in srgb, var(--accent) 25%, transparent)", animation: "anim-pulse 1.6s ease-out 0.5s infinite" }} />
              <span aria-hidden style={{ position: "absolute", inset: 16, borderRadius: "50%", background: "var(--accent)", color: "white", display: "grid", placeItems: "center" }}>
                <Sparkles size={30} strokeWidth={1.8} className="agent-spin" />
              </span>
            </div>
            <div>
              <strong style={{ fontSize: 15 }}>Cerrando nóminas para toda tu cartera…</strong>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 6, minHeight: 18 }}>{FRASES[frase]}</div>
            </div>
            <style jsx>{`
              @keyframes anim-pulse {
                0% { transform: scale(0.6); opacity: 0.55; }
                100% { transform: scale(1.4); opacity: 0; }
              }
            `}</style>
          </div>
        )}

        {phase === "ok" && totales && (
          <>
            <div style={{ padding: 14, borderRadius: 10, background: "color-mix(in srgb, var(--good) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--good) 30%, transparent)", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "var(--good)", color: "white",
                display: "grid", placeItems: "center", flexShrink: 0,
                animation: "agent-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}><CheckCircle2 size={18} strokeWidth={2.6} /></span>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 15, display: "block" }}>
                  Cierre completado para {totales.empresas_con_nominas}/{totales.empresas} empresas
                </strong>
                <span className="muted" style={{ fontSize: 12 }}>
                  {totales.generadas} nóminas nuevas · {totales.saltadas} ya existían
                  {totales.errores > 0 ? ` · ${totales.errores} con error` : ""}
                </span>
              </div>
              {publicar && totales.generadas > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, background: "color-mix(in srgb, var(--good) 14%, transparent)", color: "var(--good)", fontSize: 11, fontWeight: 600 }}>
                  <UploadCloud size={11} /> Publicadas al portal
                </span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              <Mini titulo="Total bruto" valor={EUR(totales.total_bruto)} />
              <Mini titulo="Total líquido" valor={EUR(totales.total_liquido)} tono="ok" />
              <Mini titulo="SS empresa" valor={EUR(totales.total_ss_empresa)} />
              <Mini titulo="IRPF retenido (M111)" valor={EUR(totales.total_irpf)} tono="warn" />
              <Mini titulo="Coste total despacho" valor={EUR(totales.coste_total)} tono="bad" />
            </div>

            <div style={{ flex: 1, overflow: "auto", border: "1px solid var(--line, #e5e7eb)", borderRadius: 10 }}>
              <table className="table" style={{ fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th className="num">Trab.</th>
                    <th className="num">Generadas</th>
                    <th className="num">Bruto</th>
                    <th className="num">Líquido</th>
                    <th className="num">SS empresa</th>
                    <th className="num">IRPF</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {porEmpresa.filter((p) => p.trabajadores > 0).map((p) => (
                    <tr key={p.empresa_id}>
                      <td><strong>{p.nombre ?? "—"}</strong></td>
                      <td className="num">{p.trabajadores}</td>
                      <td className="num">
                        {p.generadas > 0 ? <span style={{ color: "var(--good)", fontWeight: 600 }}>{p.generadas}</span> : "—"}
                        {p.saltadas > 0 && <span className="muted" style={{ marginLeft: 4 }}>(+{p.saltadas} ya estaban)</span>}
                        {p.errores > 0 && (
                          <span style={{ marginLeft: 4, color: "var(--bad)", display: "inline-flex", alignItems: "center", gap: 2 }}>
                            <AlertTriangle size={11} /> {p.errores}
                          </span>
                        )}
                      </td>
                      <td className="num">{EUR0(p.total_bruto)}</td>
                      <td className="num">{EUR0(p.total_liquido)}</td>
                      <td className="num">{EUR0(p.total_ss_empresa)}</td>
                      <td className="num">{EUR0(p.total_irpf)}</td>
                      <td style={{ textAlign: "right" }}>
                        <Link
                          href={`/clientes/${p.empresa_id}?tab=laboral`}
                          className="button compact ghost"
                          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          Ver <ArrowRight size={11} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="button secondary compact" onClick={() => setPhase("idle")}>Nuevo cierre</button>
            </div>
          </>
        )}
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
