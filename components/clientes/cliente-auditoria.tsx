"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Evento = {
  kind: string;
  when: string;
  title: string;
  meta?: string;
};

const KIND_LABELS: Record<string, { label: string; pill: string }> = {
  aeat: { label: "AEAT", pill: "accent" },
  factura_emit: { label: "Factura emitida", pill: "good" },
  factura_reci: { label: "Factura recibida", pill: "plain" },
  gasto: { label: "Gasto", pill: "warn" },
  nomina: { label: "Nómina", pill: "accent" },
  agent: { label: "Agente IA", pill: "dark" },
};

export function ClienteAuditoria({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [events, setEvents] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const tk = sess.session?.access_token ?? "";
        const res = await fetch(`/api/portal/auditoria?empresa_id=${empresaId}`, {
          headers: { Authorization: `Bearer ${tk}` },
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "Error");
        setEvents(json.events ?? []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [empresaId, supabase]);

  return (
    <section className="grid">
      <article className="card span-12">
        <span className="card-eyebrow">Auditoría · timeline de actividad</span>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Histórico unificado: declaraciones AEAT, facturas, gastos, nóminas y ejecuciones de agentes IA.
        </p>

        {loading ? <p className="muted">Cargando…</p> : null}
        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}

        {events.length === 0 && !loading ? (
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>Sin actividad registrada todavía.</p>
        ) : (
          <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
            {events.map((e, i) => {
              const k = KIND_LABELS[e.kind] ?? { label: e.kind, pill: "plain" };
              return (
                <li
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 110px 1fr auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "color-mix(in srgb, var(--accent) 4%, transparent)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <time style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>
                    {new Date(e.when).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                  </time>
                  <span className={`pill ${k.pill}`} style={{ fontSize: 11 }}>{k.label}</span>
                  <span style={{ fontSize: 13 }}>{e.title}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>{e.meta ?? ""}</span>
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </section>
  );
}
