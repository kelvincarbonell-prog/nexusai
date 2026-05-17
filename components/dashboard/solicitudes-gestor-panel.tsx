"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Inbox, AlertOctagon, CheckCircle2, Clock, ArrowRight, Filter } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { getSolicitudByKey } from "@/lib/solicitudes/catalogo";

type Solicitud = {
  id: string;
  empresa_id: string;
  tipo: string;
  descripcion: string | null;
  estado: "pendiente" | "en_proceso" | "resuelta" | "rechazada";
  metadata: Record<string, unknown> | null;
  created_at: string;
  empresa: { id: string; nombre: string | null; nif: string | null } | null;
};

type Resumen = { pendientes: number; en_proceso: number; resueltas: number; urgentes: number };

type Filtro = "todas" | "pendiente" | "en_proceso" | "resuelta";

export function SolicitudesGestorPanel() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [items, setItems] = useState<Solicitud[]>([]);
  const [resumen, setResumen] = useState<Resumen>({ pendientes: 0, en_proceso: 0, resueltas: 0, urgentes: 0 });
  const [filtro, setFiltroRaw] = useState<Filtro>("pendiente");
  const [, startFiltroTransition] = useTransition();
  function setFiltro(f: Filtro) {
    startFiltroTransition(() => setFiltroRaw(f));
  }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const url = filtro === "todas" ? "/api/asesor/solicitudes" : `/api/asesor/solicitudes?estado=${filtro}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Error");
      setItems(j.items ?? []);
      setResumen(j.resumen ?? { pendientes: 0, en_proceso: 0, resueltas: 0, urgentes: 0 });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  async function cambiarEstado(id: string, estado: Solicitud["estado"]) {
    setBusy(id);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/asesor/solicitudes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ id, estado }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Error");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="card span-12">
      <div className="topbar" style={{ border: 0, padding: 0, margin: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Inbox size={18} />
          <div>
            <span className="card-eyebrow">Solicitudes de clientes</span>
            <strong style={{ fontSize: 18, display: "block" }}>Bandeja</strong>
          </div>
        </div>
        <div className="button-row" style={{ flexWrap: "wrap" }} suppressHydrationWarning>
          {loading ? (
            <span className="pill" style={{ opacity: 0.5 }}>cargando…</span>
          ) : (
            <>
              {resumen.urgentes > 0 && (
                <span className="pill bad">
                  <AlertOctagon size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  {resumen.urgentes} urgentes
                </span>
              )}
              {resumen.pendientes > 0 && <span className="pill warn">pendientes · {resumen.pendientes}</span>}
              {resumen.en_proceso > 0 && <span className="pill accent">en proceso · {resumen.en_proceso}</span>}
              {resumen.resueltas > 0 && <span className="pill good">resueltas · {resumen.resueltas}</span>}
              {resumen.pendientes === 0 && resumen.en_proceso === 0 && resumen.urgentes === 0 && (
                <span className="pill good">bandeja vacía</span>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Filter size={12} style={{ opacity: 0.5 }} />
        {(["pendiente", "en_proceso", "resuelta", "todas"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={`button compact ${filtro === f ? "" : "ghost"}`}
          >
            {f === "pendiente" ? "Pendientes" : f === "en_proceso" ? "En proceso" : f === "resuelta" ? "Resueltas" : "Todas"}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "var(--bad-soft, #ef444412)", color: "var(--bad, #ef4444)", fontSize: 13 }}>
          {error}
        </div>
      )}

      {loading && <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>Cargando…</p>}

      {!loading && items.length === 0 && (
        <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
          Sin solicitudes en este filtro.
        </p>
      )}

      {!loading && items.length > 0 && (
        <ul style={{ listStyle: "none", margin: "12px 0 0", padding: 0, display: "grid", gap: 8 }}>
          {items.map((s) => {
            const cat = getSolicitudByKey(s.tipo);
            const prio = (s.metadata?.prioridad as string | undefined) ?? "normal";
            const isUrg = prio === "urgente";
            return (
              <li
                key={s.id}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: `1px solid ${isUrg ? "#ef444466" : "var(--border, #e5e7eb)"}`,
                  background: isUrg ? "#ef444408" : "var(--card, #fff)",
                  display: "grid",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 14 }}>{cat?.label ?? s.tipo}</strong>
                  {s.empresa && (
                    <Link href={`/clientes/${s.empresa_id}`} style={{ fontSize: 12, opacity: 0.7, textDecoration: "none" }}>
                      · {s.empresa.nombre} <ArrowRight size={10} style={{ verticalAlign: "middle" }} />
                    </Link>
                  )}
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: cat?.grupo === "laboral" ? "#3b82f612" : cat?.grupo === "fiscal" ? "#10b98112" : "#6b728012",
                      color: cat?.grupo === "laboral" ? "#3b82f6" : cat?.grupo === "fiscal" ? "#10b981" : "#6b7280",
                      fontWeight: 600,
                    }}
                  >
                    {cat?.grupo ?? "general"}
                  </span>
                  <span className={`pill ${prio === "urgente" ? "bad" : prio === "alta" ? "warn" : "plain"}`} style={{ fontSize: 10 }}>
                    {prio}
                  </span>
                  <span className={`pill ${s.estado === "resuelta" ? "good" : s.estado === "rechazada" ? "bad" : s.estado === "en_proceso" ? "accent" : "warn"}`} style={{ fontSize: 10 }}>
                    {s.estado}
                  </span>
                </div>
                {s.descripcion && (
                  <p style={{ margin: 0, fontSize: 13, opacity: 0.85, lineHeight: 1.45 }}>{s.descripcion}</p>
                )}
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <small style={{ opacity: 0.6, fontSize: 11, fontFamily: "var(--mono, monospace)" }}>
                    {new Date(s.created_at).toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </small>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    {s.estado === "pendiente" && (
                      <button
                        type="button"
                        className="button compact ghost"
                        disabled={busy === s.id}
                        onClick={() => cambiarEstado(s.id, "en_proceso")}
                      >
                        <Clock size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
                        Empezar
                      </button>
                    )}
                    {(s.estado === "pendiente" || s.estado === "en_proceso") && (
                      <button
                        type="button"
                        className="button compact"
                        disabled={busy === s.id}
                        onClick={() => cambiarEstado(s.id, "resuelta")}
                      >
                        <CheckCircle2 size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
                        Resolver
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}
