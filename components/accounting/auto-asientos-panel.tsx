"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, Zap, Check, AlertCircle, RefreshCw } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Entry = {
  id: string;
  entry_number: number | null;
  entry_date: string;
  description: string;
  source_type: string;
  source_id: string | null;
  status: string;
};

type Stats = {
  facturas_emit: number;
  facturas_emit_asentadas: number;
  facturas_reci: number;
  facturas_reci_asentadas: number;
  gastos: number;
  gastos_asentados: number;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

const SOURCE_LABELS: Record<string, string> = {
  factura_emitida: "Factura emitida",
  factura_recibida: "Factura recibida",
  gasto: "Gasto",
  manual: "Manual",
};

export function AutoAsientosPanel({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "regenerando" | "ok">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    setLoading(true);
    try {
      const year = new Date().getUTCFullYear();
      // Cargar últimos asientos automáticos
      const { data: e } = await supabase
        .from("journal_entries")
        .select("id,entry_number,entry_date,description,source_type,source_id,status")
        .eq("empresa_id", empresaId)
        .in("source_type", ["factura_emitida", "factura_recibida", "gasto"])
        .gte("entry_date", `${year}-01-01`)
        .order("entry_date", { ascending: false })
        .limit(20);
      setEntries(e ?? []);

      // Cargar stats: facturas/gastos vs asentados
      const [emit, reci, gas, journals] = await Promise.all([
        supabase.from("facturas").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("tipo", "emitida").gte("fecha_emision", `${year}-01-01`),
        supabase.from("facturas").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).eq("tipo", "recibida").gte("fecha_emision", `${year}-01-01`),
        supabase.from("gastos").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId).gte("fecha", `${year}-01-01`),
        supabase.from("journal_entries").select("source_type", { count: "exact" }).eq("empresa_id", empresaId).in("source_type", ["factura_emitida", "factura_recibida", "gasto"]).gte("entry_date", `${year}-01-01`),
      ]);
      const counts: Record<string, number> = {};
      for (const j of journals.data ?? []) counts[j.source_type] = (counts[j.source_type] ?? 0) + 1;
      setStats({
        facturas_emit: emit.count ?? 0,
        facturas_emit_asentadas: counts.factura_emitida ?? 0,
        facturas_reci: reci.count ?? 0,
        facturas_reci_asentadas: counts.factura_recibida ?? 0,
        gastos: gas.count ?? 0,
        gastos_asentados: counts.gasto ?? 0,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function regenerarTodos() {
    if (!confirm("Va a recorrer todas las facturas y gastos del ejercicio actual que no tengan asiento y generarlos automáticamente. ¿Continuar?")) return;
    setBusy(true);
    setPhase("regenerando");
    setError(null);
    setMessage(null);
    try {
      const tk = await token();
      const res = await fetch("/api/accounting/journal-from-source", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setPhase("ok");
      setMessage(`Generados ${json.asientos_creados ?? 0} asientos nuevos.`);
      await load();
      setTimeout(() => setPhase("idle"), 3500);
    } catch (e: unknown) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const pending = stats
    ? stats.facturas_emit - stats.facturas_emit_asentadas + (stats.facturas_reci - stats.facturas_reci_asentadas) + (stats.gastos - stats.gastos_asentados)
    : 0;

  return (
    <article className="card span-12" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "color-mix(in srgb, var(--accent) 14%, transparent)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Zap size={22} strokeWidth={1.8} color="var(--accent)" />
          </div>
          <div>
            <span className="card-eyebrow">Asientos contables automáticos</span>
            <h2 style={{ fontSize: 18, margin: "4px 0 0" }}>Cada factura y gasto genera su asiento</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4, maxWidth: 600 }}>
              Cuando emites una factura: <code style={{ fontFamily: "var(--mono)", fontSize: 11 }}>430 ─ 705 ─ 477</code>.
              Cuando subes un gasto: <code style={{ fontFamily: "var(--mono)", fontSize: 11 }}>6XX ─ 472 ─ 410</code>.
              La cuenta 6XX la elige una IA según el proveedor.
            </p>
          </div>
        </div>
        <button
          className="button"
          onClick={regenerarTodos}
          disabled={busy || pending === 0}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, position: "relative", overflow: "hidden", minWidth: 200, justifyContent: "center" }}
        >
          {phase === "regenerando" ? (
            <>
              <Sparkles size={14} strokeWidth={1.8} className="aa-spin" />
              Generando…
              <span className="aa-shimmer" aria-hidden="true" />
            </>
          ) : phase === "ok" ? (
            <><Check size={14} strokeWidth={2.4} /> {message ?? "Listo"}</>
          ) : (
            <><RefreshCw size={14} strokeWidth={1.8} /> Generar pendientes {pending > 0 ? `(${pending})` : ""}</>
          )}
        </button>
      </div>

      {error ? (
        <p role="alert" style={{ color: "var(--bad)", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <AlertCircle size={14} /> {error}
        </p>
      ) : null}

      {/* Stats */}
      {stats ? (
        <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <article className="card span-4" style={{ padding: 12 }}>
            <span className="card-eyebrow">Facturas emitidas</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
              <strong style={{ fontSize: 22 }}>{stats.facturas_emit_asentadas}</strong>
              <span className="muted" style={{ fontSize: 13 }}>/ {stats.facturas_emit}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: "color-mix(in srgb, var(--line) 50%, transparent)", overflow: "hidden", marginTop: 8 }}>
              <div style={{ width: `${stats.facturas_emit > 0 ? (stats.facturas_emit_asentadas / stats.facturas_emit) * 100 : 100}%`, height: "100%", background: "var(--good)", transition: "width 0.6s" }} />
            </div>
            <small className="muted" style={{ fontSize: 11, marginTop: 4, display: "block" }}>asentadas en diario</small>
          </article>
          <article className="card span-4" style={{ padding: 12 }}>
            <span className="card-eyebrow">Facturas recibidas</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
              <strong style={{ fontSize: 22 }}>{stats.facturas_reci_asentadas}</strong>
              <span className="muted" style={{ fontSize: 13 }}>/ {stats.facturas_reci}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: "color-mix(in srgb, var(--line) 50%, transparent)", overflow: "hidden", marginTop: 8 }}>
              <div style={{ width: `${stats.facturas_reci > 0 ? (stats.facturas_reci_asentadas / stats.facturas_reci) * 100 : 100}%`, height: "100%", background: "var(--accent)", transition: "width 0.6s" }} />
            </div>
            <small className="muted" style={{ fontSize: 11, marginTop: 4, display: "block" }}>con asiento</small>
          </article>
          <article className="card span-4" style={{ padding: 12 }}>
            <span className="card-eyebrow">Gastos</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
              <strong style={{ fontSize: 22 }}>{stats.gastos_asentados}</strong>
              <span className="muted" style={{ fontSize: 13 }}>/ {stats.gastos}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: "color-mix(in srgb, var(--line) 50%, transparent)", overflow: "hidden", marginTop: 8 }}>
              <div style={{ width: `${stats.gastos > 0 ? (stats.gastos_asentados / stats.gastos) * 100 : 100}%`, height: "100%", background: "var(--warn)", transition: "width 0.6s" }} />
            </div>
            <small className="muted" style={{ fontSize: 11, marginTop: 4, display: "block" }}>asentados</small>
          </article>
        </div>
      ) : null}

      {/* Últimos asientos */}
      <div>
        <span className="card-eyebrow">Últimos asientos automáticos</span>
        {loading ? <p className="muted">Cargando…</p> : entries.length === 0 ? (
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            Aún no se ha generado ningún asiento automático. Pulsa el botón superior para procesar lo pendiente,
            o crea una factura y verás aparecer el asiento aquí inmediatamente.
          </p>
        ) : (
          <table className="table" style={{ marginTop: 8 }}>
            <thead><tr><th>Nº</th><th>Fecha</th><th>Origen</th><th>Descripción</th><th>Estado</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{e.entry_number ?? "—"}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{e.entry_date}</td>
                  <td><span className="pill plain" style={{ fontSize: 11 }}>{SOURCE_LABELS[e.source_type] ?? e.source_type}</span></td>
                  <td style={{ fontSize: 13, maxWidth: 380 }}>{e.description}</td>
                  <td><span className={`pill ${e.status === "posted" ? "good" : "warn"}`} style={{ fontSize: 11 }}>{e.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style jsx global>{`
        @keyframes aa-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .aa-spin { animation: aa-spin 1.2s linear infinite; }
        @keyframes aa-shimmer-anim { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .aa-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%);
          animation: aa-shimmer-anim 1.4s linear infinite;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .aa-spin, .aa-shimmer { animation: none; }
        }
      `}</style>
    </article>
  );
}
