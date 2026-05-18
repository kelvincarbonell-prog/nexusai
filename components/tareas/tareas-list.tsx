"use client";

import { useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Tarea = {
  id: string;
  empresa_id: string | null;
  titulo: string;
  descripcion: string | null;
  prioridad: "baja" | "media" | "alta" | "urgente";
  estado: "pendiente" | "en_curso" | "completada" | "cancelada";
  fecha_limite: string | null;
};

const PRIO_COLOR: Record<string, string> = {
  baja: "var(--muted)",
  media: "var(--accent)",
  alta: "var(--warn)",
  urgente: "var(--bad)",
};

export function TareasList() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const { confirm } = useConfirm();
  const [items, setItems] = useState<Tarea[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [draft, setDraft] = useState({ titulo: "", descripcion: "", prioridad: "media" as Tarea["prioridad"], fecha_limite: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todas" | "pendientes" | "completadas">("pendientes");

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    const tk = await token();
    const res = await fetch("/api/tareas", { headers: { Authorization: `Bearer ${tk}` } });
    const json = await res.json();
    if (json.ok) setItems(json.items ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function crear() {
    if (!draft.titulo) {
      setError("Indica el título.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tk = await token();
      const res = await fetch("/api/tareas", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          fecha_limite: draft.fecha_limite || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setShowNew(false);
      setDraft({ titulo: "", descripcion: "", prioridad: "media", fecha_limite: "" });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEstado(id: string, estado: Tarea["estado"]) {
    const tk = await token();
    await fetch("/api/tareas", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, estado }),
    });
    load();
  }

  async function borrar(id: string) {
    if (!(await confirm({ title: "¿Borrar esta tarea?", tone: "danger", confirmLabel: "Borrar" }))) return;
    const tk = await token();
    await fetch(`/api/tareas?id=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${tk}` } });
    load();
  }

  const filtered = items.filter((t) => {
    if (filter === "pendientes") return t.estado !== "completada" && t.estado !== "cancelada";
    if (filter === "completadas") return t.estado === "completada";
    return true;
  });

  const pendientes = items.filter((t) => t.estado !== "completada" && t.estado !== "cancelada").length;
  const urgentes = items.filter((t) => t.prioridad === "urgente" && t.estado !== "completada").length;
  const vencidas = items.filter((t) => t.fecha_limite && t.fecha_limite < new Date().toISOString().slice(0, 10) && t.estado !== "completada").length;

  return (
    <section className="grid">
      <div className="card span-12" style={{ display: "grid", gap: 12 }}>
        <div className="topbar" style={{ border: 0, padding: 0, margin: 0, alignItems: "flex-end" }}>
          <div>
            <span className="card-eyebrow">Tareas</span>
            <h2 className="title" style={{ fontSize: 24, marginTop: 4 }}>
              {pendientes} pendiente{pendientes !== 1 ? "s" : ""}
            </h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {urgentes > 0 ? <span style={{ color: "var(--bad)" }}>● {urgentes} urgente{urgentes !== 1 ? "s" : ""}</span> : null}
              {urgentes > 0 && vencidas > 0 ? " · " : null}
              {vencidas > 0 ? <span style={{ color: "var(--warn)" }}>⏰ {vencidas} vencida{vencidas !== 1 ? "s" : ""}</span> : null}
              {urgentes === 0 && vencidas === 0 ? "Sin urgencias" : null}
            </p>
          </div>
          <div className="button-row">
            <button className={`button ${filter === "pendientes" ? "" : "secondary"} compact`} onClick={() => setFilter("pendientes")}>Pendientes</button>
            <button className={`button ${filter === "todas" ? "" : "secondary"} compact`} onClick={() => setFilter("todas")}>Todas</button>
            <button className={`button ${filter === "completadas" ? "" : "secondary"} compact`} onClick={() => setFilter("completadas")}>Hechas</button>
            <button className="button" onClick={() => setShowNew(!showNew)}>+ Nueva</button>
          </div>
        </div>

        {showNew ? (
          <div className="setting-box" style={{ padding: 14, borderRadius: 8, display: "grid", gap: 10 }}>
            <input className="input" value={draft.titulo} onChange={(e) => setDraft({ ...draft, titulo: e.target.value })} placeholder="Título de la tarea" autoFocus />
            <textarea className="input textarea" value={draft.descripcion} onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })} placeholder="Detalles…" />
            <div className="form two-cols">
              <label className="label">
                Prioridad
                <select className="input" value={draft.prioridad} onChange={(e) => setDraft({ ...draft, prioridad: e.target.value as Tarea["prioridad"] })}>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </label>
              <label className="label">
                Fecha límite
                <input className="input" type="date" value={draft.fecha_limite} onChange={(e) => setDraft({ ...draft, fecha_limite: e.target.value })} />
              </label>
            </div>
            {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
            <div className="button-row" style={{ justifyContent: "flex-end" }}>
              <button className="button secondary" onClick={() => setShowNew(false)}>Cancelar</button>
              <button className="button" onClick={crear} disabled={busy}>{busy ? "Creando…" : "Crear tarea"}</button>
            </div>
          </div>
        ) : null}

        <table className="table">
          <thead>
            <tr><th></th><th>Tarea</th><th>Prioridad</th><th>Vence</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 32 }}>Sin tareas {filter !== "todas" ? `${filter}` : ""}.</td></tr>
            ) : filtered.map((t) => {
              const done = t.estado === "completada";
              const vencida = t.fecha_limite && t.fecha_limite < new Date().toISOString().slice(0, 10) && !done;
              return (
                <tr key={t.id} style={done ? { opacity: 0.5 } : undefined}>
                  <td style={{ width: 32 }}>
                    <input type="checkbox" checked={done} onChange={() => toggleEstado(t.id, done ? "pendiente" : "completada")} />
                  </td>
                  <td>
                    <strong style={done ? { textDecoration: "line-through" } : undefined}>{t.titulo}</strong>
                    {t.descripcion ? <small className="muted" style={{ display: "block", fontFamily: "var(--mono)", fontSize: 11 }}>{t.descripcion.slice(0, 80)}{t.descripcion.length > 80 ? "…" : ""}</small> : null}
                  </td>
                  <td>
                    <span className="pill" style={{ color: PRIO_COLOR[t.prioridad] }}>● {t.prioridad}</span>
                  </td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12, color: vencida ? "var(--bad)" : "var(--muted)" }}>
                    {t.fecha_limite ? new Date(t.fecha_limite + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "—"}
                  </td>
                  <td>
                    <button className="button ghost compact" onClick={() => borrar(t.id)} title="Borrar">×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
