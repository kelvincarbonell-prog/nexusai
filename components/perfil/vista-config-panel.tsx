"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Save, Layers, Check, Loader2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { MODULOS_ASESOR, MODULOS_CLIENTE, mergeWithDefaults, type Alcance, type ModuloDef } from "@/lib/vista-config/catalogo";

type Tab = Alcance;

export function VistaConfigPanel() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [tab, setTab] = useState<Tab>("asesor");
  const [configAsesor, setConfigAsesor] = useState<Record<string, boolean>>({});
  const [configCliente, setConfigCliente] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const config = tab === "asesor" ? configAsesor : configCliente;
  const setConfig = tab === "asesor" ? setConfigAsesor : setConfigCliente;
  const modulos: ModuloDef[] = tab === "asesor" ? MODULOS_ASESOR : MODULOS_CLIENTE;

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    setLoading(true);
    try {
      const tk = await token();
      const [resA, resC] = await Promise.all([
        fetch("/api/gestoria/vista-config?alcance=asesor", { headers: { Authorization: `Bearer ${tk}` } }),
        fetch("/api/gestoria/vista-config?alcance=cliente", { headers: { Authorization: `Bearer ${tk}` } }),
      ]);
      const [jA, jC] = await Promise.all([resA.json(), resC.json()]);
      if (jA.ok) setConfigAsesor(mergeWithDefaults("asesor", jA.modulos));
      if (jC.ok) setConfigCliente(mergeWithDefaults("cliente", jC.modulos));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const res = await fetch("/api/gestoria/vista-config", {
        method: "PUT",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ alcance: tab, modulos: config }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Error");
      setSuccess(`Vista «${tab === "asesor" ? "Asesor" : "Cliente"}» guardada.`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  const activos = Object.values(config).filter(Boolean).length;

  return (
    <section className="grid">
      <article className="card span-12" style={{ display: "grid", gap: 14 }}>
        <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Layers size={18} />
          <div>
            <span className="card-eyebrow">Vistas configurables</span>
            <h2 style={{ fontSize: 18, margin: "4px 0 0" }}>Qué ven asesores y clientes</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Activa o desactiva módulos para cada vista. Los cambios se aplican a toda la gestoría.
            </p>
          </div>
          <span className="pill plain" style={{ marginLeft: "auto", fontSize: 11 }}>
            <Eye size={11} style={{ marginRight: 4, verticalAlign: "middle" }} />
            {activos} de {modulos.length} activos
          </span>
        </header>

        <div style={{ display: "flex", gap: 6 }}>
          {(["asesor", "cliente"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setSuccess(null); }}
              className={`button compact ${tab === t ? "" : "ghost"}`}
            >
              {t === "asesor" ? "Vista asesor" : "Vista cliente"}
            </button>
          ))}
        </div>

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
        {success ? (
          <p role="status" style={{ color: "var(--good)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Check size={14} /> {success}
          </p>
        ) : null}

        {loading ? (
          <p className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Loader2 size={14} className="animate-spin" /> Cargando configuración…
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
            {saving ? "Guardando…" : "Guardar vista"}
          </button>
        </div>
      </article>
    </section>
  );
}
