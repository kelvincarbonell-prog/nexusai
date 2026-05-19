"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Layers, Check, Loader2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { MODULOS_ASESOR, MODULOS_CLIENTE, mergeWithDefaults, type Alcance, type ModuloDef } from "@/lib/vista-config/catalogo";

type Especialidad = "generalista" | "laboral" | "fiscal";

/**
 * Panel que edita la config de módulos visibles para una vista concreta.
 *
 * - alcance="cliente": una sola config (no requiere especialidad)
 * - alcance="asesor" + especialidad: config específica para asesores de
 *   esa especialidad (generalista / laboral / fiscal). Si no se pasa
 *   especialidad, se usa generalista por defecto.
 */
export function VistaConfigPanel({ alcance, especialidad }: { alcance: Alcance; especialidad?: Especialidad }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [config, setConfig] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const modulos: ModuloDef[] = alcance === "asesor" ? MODULOS_ASESOR : MODULOS_CLIENTE;
  const espQS = alcance === "asesor" ? `&especialidad=${especialidad ?? "generalista"}` : "";

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    setLoading(true);
    setError(null);
    setSuccess(null);
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
    setSaving(true);
    setError(null);
    setSuccess(null);
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

  const activos = Object.values(config).filter(Boolean).length;

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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {modulos.map((m) => {
            const on = Boolean(config[m.key]);
            return (
              <label
                key={m.key}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: 10,
                  alignItems: "start",
                  padding: 12,
                  borderRadius: 10,
                  border: `1px solid ${on ? "color-mix(in srgb, var(--accent) 40%, transparent)" : "var(--line, #e5e7eb)"}`,
                  background: on ? "color-mix(in srgb, var(--accent) 6%, transparent)" : "var(--card, #fff)",
                  cursor: "pointer",
                  transition: "background 0.15s, border-color 0.15s",
                }}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(m.key)}
                  style={{ marginTop: 3 }}
                />
                <div style={{ display: "grid", gap: 2 }}>
                  <strong style={{ fontSize: 13 }}>{m.label}</strong>
                  <span className="muted" style={{ fontSize: 11, lineHeight: 1.4 }}>{m.descripcion}</span>
                  <span className="muted" style={{ fontSize: 10, fontFamily: "var(--mono, monospace)" }}>
                    {m.rutas.join(" · ")}
                  </span>
                </div>
              </label>
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
