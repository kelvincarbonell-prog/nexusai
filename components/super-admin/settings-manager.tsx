"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type SettingRow = {
  key: string;
  value: Record<string, unknown> | string;
  description: string | null;
};

export function SettingsManager({ settings }: { settings: SettingRow[] }) {
  const [rows, setRows] = useState(settings);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function save(row: SettingRow) {
    setMessage("");
    setIsSaving(true);
    try {
      const supabase = createBrowserSupabase();
      const { data } = await supabase.auth.getSession();
      let parsedValue = row.value;
      if (typeof row.value === "string") {
        try {
          parsedValue = JSON.parse(row.value);
        } catch {
          setMessage("El JSON del ajuste no es válido.");
          return;
        }
      }
      const res = await fetch("/api/super-admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ ...row, value: parsedValue }),
      });
      setMessage(res.ok ? "Ajuste guardado." : "No se pudo guardar el ajuste.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <article className="card span-12" id="settings">
      <div className="eyebrow">Configuración Super Admin</div>
      <h2>Ajustes globales</h2>
      <div className="settings-grid">
        {rows.map((row) => (
          <div className="setting-box" key={row.key}>
            <strong>{row.key}</strong>
            <small>{row.description}</small>
            <textarea
              className="input textarea"
              aria-label={`JSON del ajuste ${row.key}`}
              value={typeof row.value === "string" ? row.value : JSON.stringify(row.value, null, 2)}
              onChange={(event) =>
                setRows((current) => current.map((item) => (item.key === row.key ? { ...item, value: event.target.value } : item)))
              }
            />
            <button className="button secondary" type="button" onClick={() => save(row)} disabled={isSaving}>
              <Save size={14} aria-hidden="true" />
              Guardar ajuste
            </button>
          </div>
        ))}
      </div>
      {message ? <p className="muted" role="status">{message}</p> : null}
    </article>
  );
}
