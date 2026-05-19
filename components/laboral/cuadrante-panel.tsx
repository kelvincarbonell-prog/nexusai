"use client";

import { useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { CalendarRange, Plus, Trash2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Trabajador = { id: string; nombre: string; activo: boolean };
type Turno = {
  id: string;
  trabajador_id: string;
  fecha: string;            // YYYY-MM-DD
  hora_inicio: string;      // HH:MM
  hora_fin: string;
  descanso_min: number;
  ubicacion?: string | null;
  notas?: string | null;
};

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function lunesDe(fechaISO: string): Date {
  const d = new Date(fechaISO + "T00:00:00");
  const dow = (d.getUTCDay() + 6) % 7; // lunes=0
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}
function isoDe(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function CuadrantePanel({ empresaId, trabajadores }: { empresaId: string; trabajadores: Trabajador[] }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const { confirm } = useConfirm();
  const [refDate, setRefDate] = useState<string>(() => isoDe(new Date()));
  const monday = useMemo(() => lunesDe(refDate), [refDate]);
  const semana = useMemo(
    () => Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(monday);
      d.setUTCDate(d.getUTCDate() + i);
      return isoDe(d);
    }),
    [monday],
  );

  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<{ trabajador_id: string; fecha: string } | null>(null);
  const [draft, setDraft] = useState({ hora_inicio: "09:00", hora_fin: "17:00", descanso_min: 60, ubicacion: "", notas: "" });
  const [busy, setBusy] = useState(false);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    setLoading(true); setError(null);
    try {
      const tk = await token();
      const res = await fetch(`/api/laboral/turnos?empresa_id=${empresaId}&from=${semana[0]}&to=${semana[6]}`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Error");
      setTurnos(j.items ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (empresaId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, semana[0]]);

  async function guardar() {
    if (!editando) return;
    setBusy(true); setError(null);
    try {
      const tk = await token();
      const res = await fetch("/api/laboral/turnos", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresaId,
          trabajador_id: editando.trabajador_id,
          fecha: editando.fecha,
          hora_inicio: draft.hora_inicio,
          hora_fin: draft.hora_fin,
          descanso_min: draft.descanso_min,
          ubicacion: draft.ubicacion || undefined,
          notas: draft.notas || undefined,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Error");
      setEditando(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setBusy(false); }
  }

  async function borrar(id: string) {
    if (!(await confirm({ title: "¿Eliminar este turno?", tone: "danger", confirmLabel: "Confirmar" }))) return;
    setBusy(true);
    try {
      const tk = await token();
      await fetch(`/api/laboral/turnos?id=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${tk}` } });
      await load();
    } finally { setBusy(false); }
  }

  const turnosPorCelda = new Map<string, Turno[]>();
  for (const t of turnos) {
    const k = `${t.trabajador_id}|${t.fecha}`;
    const arr = turnosPorCelda.get(k) ?? [];
    arr.push(t);
    turnosPorCelda.set(k, arr);
  }

  function navSemana(delta: number) {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + delta * 7);
    setRefDate(isoDe(d));
  }

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <CalendarRange size={18} />
        <h3 style={{ margin: 0 }}>Cuadrante de turnos</h3>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => navSemana(-1)} className="button compact ghost" aria-label="Semana anterior">
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: 12, opacity: 0.7, minWidth: 180, textAlign: "center" }}>
            Semana del {new Date(semana[0] + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
            {" – "}
            {new Date(semana[6] + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
          </span>
          <button onClick={() => navSemana(1)} className="button compact ghost" aria-label="Semana siguiente">
            <ChevronRight size={14} />
          </button>
          <button onClick={() => setRefDate(isoDe(new Date()))} className="button compact ghost">Hoy</button>
        </div>
      </header>

      <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
        Pulsa una celda vacía para crear turno. Pulsa un turno existente para editarlo o borrarlo.
      </p>

      {loading && <span style={{ fontSize: 12, opacity: 0.6 }}><Loader2 size={12} className="animate-spin" style={{ verticalAlign: "middle" }} /> Cargando…</span>}
      {error && <div style={{ padding: 8, borderRadius: 8, background: "#ef444412", color: "#ef4444", fontSize: 12 }}>{error}</div>}

      <div style={{ overflow: "auto", border: "1px solid color-mix(in srgb, currentColor 12%, transparent)", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 720 }}>
          <thead>
            <tr style={{ background: "color-mix(in srgb, currentColor 5%, transparent)" }}>
              <th style={th}>Trabajador</th>
              {semana.map((d, i) => (
                <th key={d} style={th}>
                  <div>{DIAS[i]}</div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>{new Date(d + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trabajadores.filter((t) => t.activo).map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid color-mix(in srgb, currentColor 10%, transparent)" }}>
                <td style={{ ...td, fontWeight: 600 }}>{t.nombre}</td>
                {semana.map((d) => {
                  const items = turnosPorCelda.get(`${t.id}|${d}`) ?? [];
                  return (
                    <td key={d} style={tdCell}>
                      {items.map((it) => (
                        <button
                          key={it.id}
                          onClick={() => {
                            setEditando({ trabajador_id: t.id, fecha: d });
                            setDraft({
                              hora_inicio: it.hora_inicio.slice(0, 5),
                              hora_fin: it.hora_fin.slice(0, 5),
                              descanso_min: it.descanso_min,
                              ubicacion: it.ubicacion ?? "",
                              notas: it.notas ?? "",
                            });
                          }}
                          style={chip}
                          title={it.notas ?? ""}
                        >
                          {it.hora_inicio.slice(0, 5)}–{it.hora_fin.slice(0, 5)}
                          <Trash2
                            size={10}
                            onClick={(e) => { e.stopPropagation(); borrar(it.id); }}
                            style={{ marginLeft: 4, opacity: 0.55 }}
                          />
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setEditando({ trabajador_id: t.id, fecha: d });
                          setDraft({ hora_inicio: "09:00", hora_fin: "17:00", descanso_min: 60, ubicacion: "", notas: "" });
                        }}
                        style={addBtn}
                        aria-label="Añadir turno"
                      >
                        <Plus size={12} />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {trabajadores.filter((t) => t.activo).length === 0 && (
              <tr><td colSpan={8} style={{ padding: 16, textAlign: "center", opacity: 0.6 }}>Sin trabajadores activos.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editando && (
        <div role="dialog" aria-modal="true" onClick={() => setEditando(null)} style={overlay}>
          <div onClick={(e) => e.stopPropagation()} style={dialog}>
            <h3 style={{ margin: 0, fontSize: 15 }}>Turno · {trabajadores.find((t) => t.id === editando.trabajador_id)?.nombre} · {new Date(editando.fecha + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "long" })}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Hora inicio"><input type="time" value={draft.hora_inicio} onChange={(e) => setDraft({ ...draft, hora_inicio: e.target.value })} style={input} /></Field>
              <Field label="Hora fin"><input type="time" value={draft.hora_fin} onChange={(e) => setDraft({ ...draft, hora_fin: e.target.value })} style={input} /></Field>
              <Field label="Descanso (min)"><input type="number" min={0} max={480} value={draft.descanso_min} onChange={(e) => setDraft({ ...draft, descanso_min: Number(e.target.value) })} style={input} /></Field>
              <Field label="Ubicación"><input value={draft.ubicacion} onChange={(e) => setDraft({ ...draft, ubicacion: e.target.value })} style={input} placeholder="Oficina, tienda…" /></Field>
              <Field label="Notas" full><textarea rows={2} value={draft.notas} onChange={(e) => setDraft({ ...draft, notas: e.target.value })} style={input} /></Field>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setEditando(null)} className="button ghost compact">Cancelar</button>
              <button onClick={guardar} disabled={busy} className="button">
                {busy ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4, fontSize: 12, gridColumn: full ? "span 2" : undefined }}>
      <span style={{ opacity: 0.75 }}>{label}</span>
      {children}
    </label>
  );
}

const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, fontSize: 11, opacity: 0.7, textAlign: "left" };
const td: React.CSSProperties = { padding: "10px 12px", whiteSpace: "nowrap" };
const tdCell: React.CSSProperties = { padding: 6, verticalAlign: "top", minWidth: 90 };
const chip: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 2,
  padding: "4px 8px", marginRight: 4, marginBottom: 4,
  borderRadius: 6, border: "1px solid color-mix(in srgb, var(--accent, #6366f1) 35%, transparent)",
  background: "color-mix(in srgb, var(--accent, #6366f1) 12%, transparent)",
  color: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer",
};
const addBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 22, height: 22, borderRadius: 6,
  border: "1px dashed color-mix(in srgb, currentColor 25%, transparent)",
  background: "transparent", color: "inherit", cursor: "pointer", opacity: 0.6,
};
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", padding: 16, zIndex: 1000 };
const dialog: React.CSSProperties = { width: "min(520px, 100%)", background: "var(--panel, #fff)", borderRadius: 14, border: "1px solid var(--line, #e5e7eb)", padding: 18, display: "grid", gap: 12 };
const input: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid color-mix(in srgb, currentColor 16%, transparent)", background: "color-mix(in srgb, currentColor 4%, transparent)", color: "inherit", fontSize: 13, width: "100%", boxSizing: "border-box" };
