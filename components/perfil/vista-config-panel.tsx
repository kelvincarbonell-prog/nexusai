"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Layers, Check, Loader2, Pencil, ChevronDown } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { MODULOS_ASESOR, MODULOS_CLIENTE, mergeWithDefaults, type Alcance, type ModuloDef } from "@/lib/vista-config/catalogo";

type Especialidad = "generalista" | "laboral" | "fiscal";

/**
 * Edita la config de módulos + sub-pestañas visibles para una vista.
 *
 * - alcance="cliente": una sola config (no requiere especialidad)
 * - alcance="asesor" + especialidad: config específica para esa especialidad.
 *
 * Cada módulo se puede activar/desactivar globalmente. El icono de lápiz
 * abre las sub-pestañas (si el módulo tiene), que se pueden activar
 * individualmente. Clave de sub-pestaña: "<modulo>.<sub>".
 */
export function VistaConfigPanel({ alcance, especialidad }: { alcance: Alcance; especialidad?: Especialidad }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [config, setConfig] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const modulos: ModuloDef[] = alcance === "asesor" ? MODULOS_ASESOR : MODULOS_CLIENTE;
  const espQS = alcance === "asesor" ? `&especialidad=${especialidad ?? "generalista"}` : "";

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    setLoading(true); setError(null); setSuccess(null);
    try {
      const tk = await token();
      const res = await fetch(`/api/gestoria/vista-config?alcance=${alcance}${espQS}`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const j = await res.json();
      if (j.ok) setConfig(mergeWithDefaults(alcance, j.modulos));
      else throw new Error(j.error ?? "Error");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alcance, especialidad]);

  function toggle(key: string) {
    setConfig({ ...config, [key]: !config[key] });
    setSuccess(null);
  }

  async function guardar() {
    setSaving(true); setError(null); setSuccess(null);
    try {
      const tk = await token();
      const body: Record<string, unknown> = { alcance, modulos: config };
      if (alcance === "asesor") body.especialidad = especialidad ?? "generalista";
      const res = await fetch("/api/gestoria/vista-config", {
        method: "PUT",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Error");
      setSuccess("Configuración guardada.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  const activos = modulos.filter((m) => config[m.key] !== false).length;

  return (
    <article className="card" style={{ display: "grid", gap: 14 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Layers size={18} />
        <div>
          <span className="card-eyebrow">
            {alcance === "asesor" ? `Vista asesor · ${especialidad ?? "generalista"}` : "Vista cliente"}
          </span>
          <h3 style={{ fontSize: 16, margin: "4px 0 0" }}>
            {activos} de {modulos.length} módulos activos
          </h3>
        </div>
      </header>

      {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
      {success ? (
        <p role="status" style={{ color: "var(--good)", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Check size={14} /> {success}
        </p>
      ) : null}

      {loading ? (
        <p className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={14} className="animate-spin" /> Cargando…
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {modulos.map((m) => {
            const on = config[m.key] !== false;
            const hasSubs = (m.subModulos?.length ?? 0) > 0;
            const isExp = Boolean(expanded[m.key]);
            const subActivos = hasSubs
              ? (m.subModulos ?? []).filter((s) => config[`${m.key}.${s.key}`] !== false).length
              : 0;
            return (
              <div
                key={m.key}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${on ? "color-mix(in srgb, var(--accent) 30%, transparent)" : "var(--line, #e5e7eb)"}`,
                  background: on ? "color-mix(in srgb, var(--accent) 5%, transparent)" : "color-mix(in srgb, currentColor 3%, transparent)",
                  overflow: "hidden",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12 }}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(m.key)}
                    aria-label={`Activar módulo ${m.label}`}
                    style={{ flexShrink: 0 }}
                  />
                  <div style={{ flex: 1, display: "grid", gap: 2, minWidth: 0 }}>
                    <strong style={{ fontSize: 13 }}>
                      {m.label}
                      {hasSubs && (
                        <span className="muted" style={{ fontWeight: 400, fontSize: 11, marginLeft: 6 }}>
                          · {subActivos}/{m.subModulos!.length} sub-pestañas
                        </span>
                      )}
                    </strong>
                    <span className="muted" style={{ fontSize: 11, lineHeight: 1.4 }}>{m.descripcion}</span>
                  </div>

                  {hasSubs && (
                    <button
                      type="button"
                      onClick={() => setExpanded({ ...expanded, [m.key]: !isExp })}
                      title={isExp ? "Cerrar sub-pestañas" : "Editar sub-pestañas"}
                      aria-label={isExp ? "Cerrar sub-pestañas" : "Editar sub-pestañas"}
                      style={{
                        background: "var(--panel, #fff)",
                        border: "1px solid var(--line, #e5e7eb)",
                        borderRadius: 8,
                        width: 30, height: 30,
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer",
                        color: isExp ? "var(--accent)" : "var(--ink)",
                        transition: "transform 0.15s",
                      }}
                    >
                      {isExp ? <ChevronDown size={14} /> : <Pencil size={14} />}
                    </button>
                  )}
                </div>

                {hasSubs && isExp && (
                  <div
                    style={{
                      padding: "4px 12px 12px",
                      borderTop: "1px solid var(--line, #e5e7eb)",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                      gap: 6,
                      background: "color-mix(in srgb, currentColor 2%, transparent)",
                    }}
                  >
                    <p className="muted" style={{ gridColumn: "1 / -1", fontSize: 11, margin: "8px 0 2px" }}>
                      Sub-pestañas visibles cuando el módulo está activo:
                    </p>
                    {(m.subModulos ?? []).map((s) => {
                      const skey = `${m.key}.${s.key}`;
                      const sub_on = config[skey] !== false;
                      return (
                        <label
                          key={skey}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 10px",
                            borderRadius: 8,
                            background: sub_on ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
                            cursor: on ? "pointer" : "not-allowed",
                            opacity: on ? 1 : 0.45,
                            fontSize: 12,
                          }}
                        >
                          <input
                            type="checkbox"
                            disabled={!on}
                            checked={sub_on}
                            onChange={() => toggle(skey)}
                          />
                          {s.label}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          className="button"
          onClick={guardar}
          disabled={saving || loading}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </article>
  );
}
