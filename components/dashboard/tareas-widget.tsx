"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Tarea = {
  id: string;
  titulo: string;
  prioridad: "baja" | "media" | "alta" | "urgente";
  estado: string;
  fecha_limite: string | null;
};

const PRIO_COLOR: Record<string, string> = {
  baja: "var(--muted)",
  media: "var(--accent)",
  alta: "var(--warn)",
  urgente: "var(--bad)",
};

export function TareasWidget() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [tareas, setTareas] = useState<Tarea[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const tk = session.session?.access_token;
        if (!tk) return;
        const res = await fetch("/api/tareas", { headers: { Authorization: `Bearer ${tk}` } });
        const json = await res.json();
        if (json.ok) {
          const pend = (json.items ?? []).filter((t: Tarea) => t.estado !== "completada" && t.estado !== "cancelada");
          setTareas(pend.slice(0, 5));
        }
      } catch {
        // silencio
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function completar(id: string) {
    const { data: session } = await supabase.auth.getSession();
    const tk = session.session?.access_token;
    if (!tk) return;
    await fetch("/api/tareas", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, estado: "completada" }),
    });
    setTareas((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <article className="card span-5">
      <div className="topbar" style={{ border: 0, padding: 0, margin: 0 }}>
        <span className="card-eyebrow">Tareas pendientes</span>
        <Link href="/tareas" className="button ghost compact">ver todas →</Link>
      </div>
      {tareas.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Sin tareas pendientes. Buen ritmo 🎉</p>
      ) : (
        <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
          {tareas.map((t) => {
            const vencida = t.fecha_limite && t.fecha_limite < new Date().toISOString().slice(0, 10);
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 6, background: "var(--panel-soft)" }}>
                <input type="checkbox" onChange={() => completar(t.id)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 13 }}>{t.titulo}</strong>
                  {t.fecha_limite ? (
                    <small style={{ display: "block", fontFamily: "var(--mono)", fontSize: 11, color: vencida ? "var(--bad)" : "var(--muted)" }}>
                      {vencida ? "⏰ vencida" : "vence"} {new Date(t.fecha_limite + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                    </small>
                  ) : null}
                </div>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRIO_COLOR[t.prioridad] }} />
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
