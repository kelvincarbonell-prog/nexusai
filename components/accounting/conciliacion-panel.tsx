"use client";

import { useEffect, useMemo, useState } from "react";
import { Landmark, Upload, Check, AlertCircle, Sparkles } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Movimiento = {
  id: string;
  fecha_operacion: string;
  importe: number;
  concepto_comun: string | null;
  concepto_propio: string | null;
  referencia1: string | null;
  saldo_acumulado: number | null;
  reconciled: boolean;
  factura_id: string | null;
  gasto_id: string | null;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function ConciliacionPanel({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [items, setItems] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "subiendo" | "ok">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "conciliados" | "pendientes">("todos");

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    setLoading(true);
    try {
      const tk = await token();
      const res = await fetch(`/api/accounting/movimientos?empresa_id=${empresaId}&estado=${filtro}`, { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (json.ok) setItems(json.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, filtro]);

  async function subirN43(file: File) {
    setError(null);
    setMessage(null);
    setBusy(true);
    setPhase("subiendo");
    try {
      const buffer = await file.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        text = new TextDecoder("windows-1252").decode(buffer);
      }
      const tk = await token();
      const res = await fetch("/api/accounting/n43", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId, contenido: text, preview: false }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setPhase("ok");
      setMessage(`Importados ${json.movimientos_importados} movimientos de ${json.cuentas} cuenta(s). Saldo final ${json.saldo_final != null ? EUR(json.saldo_final) : "—"}.`);
      await load();
      setTimeout(() => setPhase("idle"), 4000);
    } catch (e: unknown) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const stats = useMemo(() => {
    const total = items.length;
    const ok = items.filter((m) => m.reconciled).length;
    const ingresos = items.filter((m) => m.importe > 0).reduce((s, m) => s + m.importe, 0);
    const pagos = items.filter((m) => m.importe < 0).reduce((s, m) => s + Math.abs(m.importe), 0);
    return { total, ok, pending: total - ok, ingresos, pagos };
  }, [items]);

  return (
    <article className="card span-12" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 12, background: "color-mix(in srgb, var(--accent) 14%, transparent)", display: "grid", placeItems: "center" }}>
            <Landmark size={22} strokeWidth={1.8} color="var(--accent)" />
          </div>
          <div>
            <span className="card-eyebrow">Conciliación bancaria</span>
            <h2 style={{ fontSize: 18, margin: "4px 0 0" }}>Movimientos bancarios · Norma 43 (.Q43 / .N43)</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4, maxWidth: 600 }}>
              Sube el fichero AEB43 de tu banco (Santander, BBVA, La Caixa, Sabadell, ING, etc.) y casa cada
              movimiento con tus facturas o gastos en un clic.
            </p>
          </div>
        </div>
        <label className="button" style={{ cursor: busy ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 8, position: "relative", overflow: "hidden" }}>
          {phase === "subiendo" ? (
            <><Sparkles size={14} className="cb-spin" /> Subiendo…</>
          ) : phase === "ok" ? (
            <><Check size={14} strokeWidth={2.4} /> Importado</>
          ) : (
            <><Upload size={14} /> Subir Norma 43</>
          )}
          <input
            type="file"
            accept=".q43,.n43,.txt,.dat,.aeb"
            onChange={(e) => e.target.files?.[0] && subirN43(e.target.files[0])}
            disabled={busy}
            style={{ display: "none" }}
          />
        </label>
      </div>

      {message ? <p role="status" style={{ color: "var(--good)", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}><Check size={14} /> {message}</p> : null}
      {error ? <p role="alert" style={{ color: "var(--bad)", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}><AlertCircle size={14} /> {error}</p> : null}

      {items.length > 0 ? (
        <>
          <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <article className="card span-3" style={{ padding: 12 }}>
              <span className="card-eyebrow">Movimientos</span>
              <strong style={{ fontSize: 22, display: "block", marginTop: 2 }}>{stats.total}</strong>
            </article>
            <article className="card span-3" style={{ padding: 12 }}>
              <span className="card-eyebrow">Conciliados</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <strong style={{ fontSize: 22, color: "var(--good)" }}>{stats.ok}</strong>
                <span className="muted" style={{ fontSize: 12 }}>/ {stats.total}</span>
              </div>
              <div style={{ height: 3, borderRadius: 2, background: "color-mix(in srgb, var(--line) 50%, transparent)", overflow: "hidden", marginTop: 6 }}>
                <div style={{ width: `${stats.total > 0 ? (stats.ok / stats.total) * 100 : 0}%`, height: "100%", background: "var(--good)", transition: "width 0.6s" }} />
              </div>
            </article>
            <article className="card span-3" style={{ padding: 12 }}>
              <span className="card-eyebrow">Ingresos</span>
              <strong style={{ fontSize: 18, display: "block", marginTop: 2, color: "var(--good)" }}>{EUR(stats.ingresos)}</strong>
            </article>
            <article className="card span-3" style={{ padding: 12 }}>
              <span className="card-eyebrow">Pagos</span>
              <strong style={{ fontSize: 18, display: "block", marginTop: 2, color: "var(--bad)" }}>{EUR(stats.pagos)}</strong>
            </article>
          </div>

          <div role="tablist" style={{ display: "flex", gap: 4 }}>
            <button className={`button compact ${filtro === "todos" ? "" : "ghost"}`} onClick={() => setFiltro("todos")}>Todos · {stats.total}</button>
            <button className={`button compact ${filtro === "pendientes" ? "" : "ghost"}`} onClick={() => setFiltro("pendientes")}>Pendientes · {stats.pending}</button>
            <button className={`button compact ${filtro === "conciliados" ? "" : "ghost"}`} onClick={() => setFiltro("conciliados")}>Conciliados · {stats.ok}</button>
          </div>

          <table className="table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th>Referencia</th>
                <th className="num">Importe</th>
                <th className="num">Saldo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 100).map((m) => (
                <tr key={m.id}>
                  <td style={{ fontFamily: "var(--mono)" }}>{m.fecha_operacion}</td>
                  <td>{m.concepto_comun ?? "—"} {m.concepto_propio ? <small className="muted" style={{ display: "block", fontSize: 10 }}>{m.concepto_propio.slice(0, 80)}</small> : null}</td>
                  <td style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>{m.referencia1 ?? ""}</td>
                  <td className="num" style={{ fontWeight: 600, color: m.importe >= 0 ? "var(--good)" : "var(--bad)" }}>{EUR(m.importe)}</td>
                  <td className="num" style={{ fontFamily: "var(--mono)" }}>{m.saldo_acumulado != null ? EUR(Number(m.saldo_acumulado)) : "—"}</td>
                  <td>
                    {m.reconciled ? (
                      <span className="pill good" style={{ fontSize: 10 }}>Conciliado</span>
                    ) : (
                      <span className="pill warn" style={{ fontSize: 10 }}>Pendiente</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length > 100 ? <small className="muted">Mostrando 100 de {items.length} movimientos.</small> : null}
        </>
      ) : !loading ? (
        <div style={{ textAlign: "center", padding: "20px 0", color: "var(--muted)" }}>
          <p style={{ fontSize: 13 }}>Aún no hay movimientos. Sube un fichero N43 de tu banco para empezar.</p>
        </div>
      ) : null}

      <style jsx global>{`
        @keyframes cb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .cb-spin { animation: cb-spin 1.2s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .cb-spin { animation: none; } }
      `}</style>
    </article>
  );
}
