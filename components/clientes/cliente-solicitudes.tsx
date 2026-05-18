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

type Trabajador = { id: string; nombre: string; apellidos?: string | null; dni?: string | null; activo: boolean; fecha_alta?: string | null };
type FacturaLite = { id: string; numero?: string | null; serie?: string | null; contacto_nombre?: string | null; fecha_emision?: string | null; total?: number | null };

export function ClienteSolicitudes({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [items, setItems] = useState<Solicitud[]>([]);
  const [tab, setTab] = useState<SubTab>("todas");
  const [showForm, setShowForm] = useState(false);
  const [grupoActivo, setGrupoActivo] = useState<Grupo>("laboral");
  const [draft, setDraft] = useState<{ tipo: string; descripcion: string; prioridad: "normal" | "alta" | "urgente"; campos: Record<string, string> }>({ tipo: "general", descripcion: "", prioridad: "normal", campos: {} });

  // Listas para selectores contextuales
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [facturas, setFacturas] = useState<FacturaLite[]>([]);

  async function cargarLista(kind: "trabajadores" | "facturas") {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch(`/api/portal/listas?empresa_id=${empresaId}&kind=${kind}`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const j = await res.json();
      if (kind === "trabajadores" && j.ok) setTrabajadores(j.items as Trabajador[]);
      if (kind === "facturas" && j.ok) setFacturas(j.items as FacturaLite[]);
    } catch {
      // catálogo opcional
    }
  }

  function seleccionarTipo(key: string) {
    const cat = getSolicitudByKey(key);
    const prefill: Record<string, string> = {};
    // Sugerencias inteligentes basadas en cat.sugerir
    if (cat?.sugerir?.includes("periodo_actual")) {
      const m = new Date().getUTCMonth() + 1;
      const trim = `${Math.ceil(m / 3)}T`;
      const yyyymm = new Date().toISOString().slice(0, 7);
      const yyyy = String(new Date().getUTCFullYear() - 1); // ejercicio típicamente pasado
      for (const c of cat.campos ?? []) {
        if (c.tipo === "periodo_trim") prefill[c.label] = trim;
        else if (c.tipo === "periodo_mes") prefill[c.label] = yyyymm;
        else if (c.tipo === "anyo") prefill[c.label] = yyyy;
      }
    }
    setDraft((d) => ({
      ...d,
      tipo: key,
      prioridad: cat?.prioridad_default ?? "normal",
      campos: prefill,
    }));
    // Carga listas si la solicitud lo necesita
    const necesitaTrabajadores = (cat?.campos ?? []).some((c) => c.tipo === "trabajador");
    const necesitaFacturas = (cat?.campos ?? []).some((c) => c.tipo === "factura");
    if (necesitaTrabajadores && trabajadores.length === 0) cargarLista("trabajadores");
    if (necesitaFacturas && facturas.length === 0) cargarLista("facturas");
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
    const cat = getSolicitudByKey(draft.tipo);
    // Valida required de los campos contextuales
    const camposReq = (cat?.campos ?? []).filter((c) => c.required);
    for (const c of camposReq) {
      if (!draft.campos[c.label] || draft.campos[c.label].trim() === "") {
        setError(`Falta: ${c.label}`);
        return;
      }
    }
    // Si no hay campos definidos para este tipo, requerimos descripción
    if ((cat?.campos ?? []).length === 0 && !draft.descripcion.trim()) {
      setError("Describe tu solicitud.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tk = await token();
      // Combina campos en descripción legible para que el gestor lo lea fácil
      const lineas = Object.entries(draft.campos)
        .filter(([, v]) => v && v.trim())
        .map(([k, v]) => `• ${k}: ${etiquetaValor(cat, k, v, trabajadores, facturas)}`);
      const descripcionFinal = [
        ...(draft.descripcion.trim() ? [draft.descripcion.trim()] : []),
        ...lineas,
      ].join("\n");
      const res = await fetch("/api/portal/solicitudes", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresaId,
          tipo: draft.tipo,
          descripcion: descripcionFinal,
          prioridad: draft.prioridad,
          campos: draft.campos,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setSuccess("Solicitud enviada al asesor.");
      setDraft({ tipo: "general", descripcion: "", prioridad: "normal", campos: {} });
      setShowForm(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  function etiquetaValor(
    cat: ReturnType<typeof getSolicitudByKey>,
    label: string,
    valor: string,
    trabs: Trabajador[],
    facts: FacturaLite[],
  ): string {
    const campo = (cat?.campos ?? []).find((c) => c.label === label);
    if (!campo) return valor;
    if (campo.tipo === "trabajador") {
      const t = trabs.find((x) => x.id === valor);
      return t ? `${t.apellidos ? `${t.apellidos}, ` : ""}${t.nombre} (${t.dni ?? "sin DNI"})` : valor;
    }
    if (campo.tipo === "factura") {
      const f = facts.find((x) => x.id === valor);
      return f ? `${f.serie ?? ""}${f.numero ?? ""} · ${f.contacto_nombre ?? "—"} · ${f.total ?? 0}€` : valor;
    }
    if (campo.tipo === "select") {
      const op = campo.opciones.find((o) => o.value === valor);
      return op?.label ?? valor;
    }
    return valor;
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
                      padding: 12,
                      borderRadius: 10,
                      border: `1px solid ${active ? "var(--accent)" : "color-mix(in srgb, currentColor 18%, transparent)"}`,
                      background: active
                        ? "color-mix(in srgb, var(--accent) 14%, transparent)"
                        : "color-mix(in srgb, currentColor 5%, transparent)",
                      color: "inherit",
                      cursor: "pointer",
                      display: "grid",
                      gap: 4,
                      boxShadow: active ? "0 2px 10px -4px color-mix(in srgb, var(--accent) 50%, transparent)" : "none",
                      transition: "border-color 0.15s, background 0.15s, transform 0.08s",
                    }}
                  >
                    <strong style={{ fontSize: 13, color: "inherit" }}>{cat.label}</strong>
                    <span style={{ fontSize: 11, opacity: 0.78, lineHeight: 1.4, color: "inherit" }}>{cat.descripcion}</span>
                    {cat.requiere_documento ? (
                      <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600 }}>requiere adjuntar documento</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Campos contextuales según tipo de solicitud */}
            {(() => {
              const cat = getSolicitudByKey(draft.tipo);
              const campos = cat?.campos ?? [];
              if (campos.length === 0) return null;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                  {campos.map((c) => {
                    const v = draft.campos[c.label] ?? "";
                    const setV = (val: string) => setDraft({ ...draft, campos: { ...draft.campos, [c.label]: val } });
                    return (
                      <label key={c.label} className="label" style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>
                          {c.label}
                          {c.required ? <span style={{ color: "var(--bad, #ef4444)" }}> *</span> : null}
                        </span>
                        {c.tipo === "trabajador" && (
                          <select className="input" value={v} onChange={(e) => setV(e.target.value)}>
                            <option value="">— Selecciona —</option>
                            {trabajadores.filter((t) => t.activo).map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.apellidos ? `${t.apellidos}, ${t.nombre}` : t.nombre} {t.dni ? `· ${t.dni}` : ""}
                              </option>
                            ))}
                            {trabajadores.filter((t) => !t.activo).length > 0 && (
                              <optgroup label="No activos">
                                {trabajadores.filter((t) => !t.activo).map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.apellidos ? `${t.apellidos}, ${t.nombre}` : t.nombre} (baja)
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        )}
                        {c.tipo === "factura" && (
                          <select className="input" value={v} onChange={(e) => setV(e.target.value)}>
                            <option value="">— Selecciona —</option>
                            {facturas.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.serie ?? ""}{f.numero ?? f.id.slice(0, 6)} · {f.contacto_nombre ?? "—"} · {f.fecha_emision} · {(f.total ?? 0).toLocaleString("es-ES")}€
                              </option>
                            ))}
                          </select>
                        )}
                        {c.tipo === "select" && (
                          <select className="input" value={v} onChange={(e) => setV(e.target.value)}>
                            <option value="">— Selecciona —</option>
                            {c.opciones.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        )}
                        {c.tipo === "periodo_trim" && (
                          <select className="input" value={v} onChange={(e) => setV(e.target.value)}>
                            <option value="">— Selecciona —</option>
                            <option value="1T">1T (ene-mar)</option>
                            <option value="2T">2T (abr-jun)</option>
                            <option value="3T">3T (jul-sep)</option>
                            <option value="4T">4T (oct-dic)</option>
                          </select>
                        )}
                        {c.tipo === "periodo_mes" && (
                          <input type="month" className="input" value={v} onChange={(e) => setV(e.target.value)} />
                        )}
                        {c.tipo === "anyo" && (
                          <select className="input" value={v} onChange={(e) => setV(e.target.value)}>
                            <option value="">— Selecciona —</option>
                            {Array.from({ length: 5 }).map((_, i) => {
                              const y = new Date().getUTCFullYear() - i;
                              return <option key={y} value={String(y)}>{y}</option>;
                            })}
                          </select>
                        )}
                        {c.tipo === "fecha" && (
                          <input type="date" className="input" value={v} onChange={(e) => setV(e.target.value)} />
                        )}
                        {c.tipo === "texto" && (
                          <input type="text" className="input" value={v} placeholder={c.placeholder} maxLength={c.maxLength ?? 200} onChange={(e) => setV(e.target.value)} />
                        )}
                        {c.tipo === "numero" && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <input type="number" className="input" value={v} min={c.min} max={c.max} placeholder={c.placeholder} onChange={(e) => setV(e.target.value)} style={{ flex: 1 }} />
                            {c.suffix ? <span style={{ fontSize: 12, opacity: 0.65 }}>{c.suffix}</span> : null}
                          </div>
                        )}
                        {c.tipo === "documento" && (
                          <div style={{ fontSize: 11, opacity: 0.7, padding: "8px 0" }}>
                            {c.help ?? "Adjunta el documento desde la pestaña Documentos antes de enviar."}
                          </div>
                        )}
                        {"help" in c && c.help ? (
                          <small style={{ fontSize: 11, opacity: 0.6 }}>{c.help}</small>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              );
            })()}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 12, alignItems: "end" }}>
              <label className="label">
                Comentario adicional (opcional)
                <textarea
                  className="input textarea"
                  value={draft.descripcion}
                  onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })}
                  placeholder="Cualquier detalle extra que quieras añadir…"
                  style={{ minHeight: 70 }}
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
