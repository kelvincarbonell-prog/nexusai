"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { CATALOGO_SOLICITUDES, getSolicitudByKey } from "@/lib/solicitudes/catalogo";

type Solicitud = {
  id: string;
  tipo: string;
  descripcion: string | null;
  estado: "pendiente" | "en_proceso" | "resuelta" | "rechazada";
  metadata: Record<string, unknown>;
  created_at: string;
};

type SubTab = "todas" | "pendiente" | "en_proceso" | "completada";
type Grupo = "laboral" | "fiscal" | "general";

export function ClienteSolicitudes({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [items, setItems] = useState<Solicitud[]>([]);
  const [tab, setTab] = useState<SubTab>("todas");
  const [showForm, setShowForm] = useState(false);
  const [grupoActivo, setGrupoActivo] = useState<Grupo>("laboral");
  const [draft, setDraft] = useState({ tipo: "general", descripcion: "", prioridad: "normal" as "normal" | "alta" | "urgente" });

  function seleccionarTipo(key: string) {
    const cat = getSolicitudByKey(key);
    setDraft((d) => ({
      ...d,
      tipo: key,
      prioridad: cat?.prioridad_default ?? "normal",
    }));
  }

  const grupos: Grupo[] = ["laboral", "fiscal", "general"];
  const tiposGrupo = CATALOGO_SOLICITUDES.filter((s) => s.grupo === grupoActivo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    try {
      const tk = await token();
      const res = await fetch(`/api/portal/solicitudes?empresa_id=${empresaId}`, { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (json.ok) setItems(json.items ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function enviar() {
    if (!draft.descripcion.trim()) {
      setError("Describe tu solicitud.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tk = await token();
      const res = await fetch("/api/portal/solicitudes", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId, ...draft }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setSuccess("Solicitud enviada al asesor.");
      setDraft({ tipo: "general", descripcion: "", prioridad: "normal" });
      setShowForm(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    if (tab === "todas") return items;
    if (tab === "completada") return items.filter((s) => s.estado === "resuelta" || s.estado === "rechazada");
    return items.filter((s) => s.estado === tab);
  }, [items, tab]);

  const counts = {
    todas: items.length,
    pendiente: items.filter((s) => s.estado === "pendiente").length,
    en_proceso: items.filter((s) => s.estado === "en_proceso").length,
    completada: items.filter((s) => s.estado === "resuelta" || s.estado === "rechazada").length,
  };

  return (
    <section className="grid">
      <article className="card span-12">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <span className="card-eyebrow">Solicitudes al asesor</span>
            <h2 style={{ fontSize: 18, margin: "4px 0 0" }}>Envíale lo que necesites resolver</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Altas/bajas SS, partes IT, vacaciones, presupuestos, consultas. Tu asesor recibe la notificación.
            </p>
          </div>
          <button className="button" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancelar" : "+ Nueva solicitud"}
          </button>
        </div>

        {showForm ? (
          <div style={{ marginTop: 16, padding: 16, background: "color-mix(in srgb, var(--accent) 5%, transparent)", borderRadius: 10, display: "grid", gap: 12 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {grupos.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrupoActivo(g)}
                  className={`button compact ${grupoActivo === g ? "" : "ghost"}`}
                  style={{ textTransform: "capitalize" }}
                >
                  {g}
                </button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
              {tiposGrupo.map((cat) => {
                const active = draft.tipo === cat.key;
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => seleccionarTipo(cat.key)}
                    style={{
                      textAlign: "left",
                      padding: 10,
                      borderRadius: 10,
                      border: `1px solid ${active ? "var(--accent)" : "var(--border, #e5e7eb)"}`,
                      background: active ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "var(--card, #fff)",
                      cursor: "pointer",
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    <strong style={{ fontSize: 13 }}>{cat.label}</strong>
                    <span style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.35 }}>{cat.descripcion}</span>
                    {cat.requiere_documento ? (
                      <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600 }}>requiere adjuntar documento</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 12, alignItems: "end" }}>
              <label className="label">
                Detalles
                <textarea
                  className="input textarea"
                  value={draft.descripcion}
                  onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })}
                  placeholder="Describe con detalle qué necesitas, fechas, nombres, importes…"
                  style={{ minHeight: 90 }}
                />
              </label>
              <label className="label">
                Prioridad
                <select className="input" value={draft.prioridad} onChange={(e) => setDraft({ ...draft, prioridad: e.target.value as typeof draft.prioridad })}>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="button ghost compact" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="button" onClick={enviar} disabled={busy}>
                {busy ? "Enviando…" : "Enviar al gestor"}
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
        {success ? <p role="status" style={{ color: "var(--good)" }}>{success}</p> : null}

        <div role="tablist" aria-label="Estado solicitudes" style={{ display: "flex", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
          {(["todas", "pendiente", "en_proceso", "completada"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`button compact ${tab === t ? "" : "ghost"}`}
              onClick={() => setTab(t)}
            >
              {t === "todas" ? "Todas" : t === "en_proceso" ? "En proceso" : t === "pendiente" ? "Pendientes" : "Completadas"} · {counts[t]}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
            {items.length === 0 ? "Sin solicitudes todavía." : "Sin resultados en este estado."}
          </p>
        ) : (
          <table className="table" style={{ marginTop: 12 }}>
            <thead><tr><th>Tipo</th><th>Descripción</th><th>Prioridad</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>
              {filtered.map((s) => {
                const prio = (s.metadata?.prioridad as string | undefined) ?? "normal";
                return (
                  <tr key={s.id}>
                    <td><strong>{getSolicitudByKey(s.tipo)?.label ?? s.tipo}</strong></td>
                    <td style={{ fontSize: 13, maxWidth: 380 }}>{s.descripcion ?? "—"}</td>
                    <td>
                      <span className={`pill ${prio === "urgente" ? "bad" : prio === "alta" ? "warn" : "plain"}`} style={{ fontSize: 11 }}>
                        {prio}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${s.estado === "resuelta" ? "good" : s.estado === "rechazada" ? "bad" : s.estado === "en_proceso" ? "accent" : "warn"}`}>
                        {s.estado}
                      </span>
                    </td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                      {new Date(s.created_at).toLocaleDateString("es-ES")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </article>
    </section>
  );
}
