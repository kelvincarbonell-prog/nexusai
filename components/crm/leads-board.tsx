"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Lead = {
  id: string;
  nombre: string;
  empresa: string | null;
  email: string | null;
  telefono: string | null;
  estado: "nuevo" | "contactado" | "cualificado" | "propuesta" | "ganado" | "perdido";
  valor_estimado: number | null;
  probabilidad: number | null;
  proxima_accion: string | null;
  fecha_proxima_accion: string | null;
  updated_at: string;
};

const COLUMNS: { key: Lead["estado"]; label: string; color: string }[] = [
  { key: "nuevo", label: "Nuevo", color: "var(--muted)" },
  { key: "contactado", label: "Contactado", color: "var(--accent)" },
  { key: "cualificado", label: "Cualificado", color: "var(--accent-3)" },
  { key: "propuesta", label: "Propuesta", color: "var(--warn)" },
  { key: "ganado", label: "Ganado", color: "var(--good)" },
  { key: "perdido", label: "Perdido", color: "var(--bad)" },
];

const EUR = (n: number | null) => n == null ? "—" : new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function LeadsBoard() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ nombre: "", empresa: "", email: "", telefono: "", valor_estimado: "" });

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    setBusy(true);
    try {
      const tk = await token();
      const res = await fetch("/api/crm/leads", { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (json.ok) setLeads(json.items ?? []);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function crearLead() {
    if (!draft.nombre) {
      setError("Indica al menos el nombre.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tk = await token();
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          email: draft.email || undefined,
          telefono: draft.telefono || undefined,
          empresa: draft.empresa || undefined,
          valor_estimado: draft.valor_estimado ? Number(draft.valor_estimado) : undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setShowNew(false);
      setDraft({ nombre: "", empresa: "", email: "", telefono: "", valor_estimado: "" });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function moverLead(id: string, estado: Lead["estado"]) {
    const tk = await token();
    const res = await fetch("/api/crm/leads", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, estado }),
    });
    const json = await res.json();
    if (json.ok) load();
  }

  const stats = COLUMNS.map((c) => ({
    ...c,
    count: leads.filter((l) => l.estado === c.key).length,
    valor: leads.filter((l) => l.estado === c.key).reduce((s, l) => s + (l.valor_estimado ?? 0), 0),
  }));

  return (
    <section className="grid">
      <div className="card span-12" style={{ display: "grid", gap: 12 }}>
        <div className="topbar" style={{ border: 0, padding: 0, margin: 0, alignItems: "flex-end" }}>
          <div>
            <span className="card-eyebrow">CRM</span>
            <h2 className="title" style={{ fontSize: 24, marginTop: 4 }}>Pipeline de oportunidades</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {leads.length} leads · {EUR(leads.reduce((s, l) => s + (l.valor_estimado ?? 0), 0))} en cartera
            </p>
          </div>
          <button className="button" onClick={() => setShowNew((v) => !v)}>
            {showNew ? "Cancelar" : "+ Nuevo lead"}
          </button>
        </div>

        {showNew ? (
          <div className="setting-box" style={{ padding: 14, borderRadius: 8, display: "grid", gap: 10 }}>
            <div className="form two-cols">
              <label className="label">Nombre <input className="input" value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} autoFocus /></label>
              <label className="label">Empresa <input className="input" value={draft.empresa} onChange={(e) => setDraft({ ...draft, empresa: e.target.value })} /></label>
              <label className="label">Email <input className="input" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></label>
              <label className="label">Teléfono <input className="input" value={draft.telefono} onChange={(e) => setDraft({ ...draft, telefono: e.target.value })} /></label>
              <label className="label">Valor estimado (€) <input className="input" type="number" min={0} value={draft.valor_estimado} onChange={(e) => setDraft({ ...draft, valor_estimado: e.target.value })} /></label>
            </div>
            {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
            <div className="button-row" style={{ justifyContent: "flex-end" }}>
              <button className="button" onClick={crearLead} disabled={busy}>{busy ? "Creando…" : "Crear"}</button>
            </div>
          </div>
        ) : null}

        <div className="leads-board">
          {COLUMNS.map((col) => {
            const colLeads = leads.filter((l) => l.estado === col.key);
            const stat = stats.find((s) => s.key === col.key)!;
            return (
              <div key={col.key} className="leads-col">
                <div className="leads-col-head">
                  <span className="leads-col-dot" style={{ background: col.color }} />
                  <strong>{col.label}</strong>
                  <small className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{stat.count} · {EUR(stat.valor)}</small>
                </div>
                <div className="leads-col-body">
                  {colLeads.map((l) => (
                    <div key={l.id} className="lead-card">
                      <strong>{l.nombre}</strong>
                      {l.empresa ? <small className="muted">{l.empresa}</small> : null}
                      {l.valor_estimado ? <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)", marginTop: 4 }}>{EUR(l.valor_estimado)}</div> : null}
                      <div className="lead-actions">
                        {COLUMNS.filter((c) => c.key !== col.key).map((c) => (
                          <button key={c.key} className="button ghost compact" onClick={() => moverLead(l.id, c.key)} title={`Mover a ${c.label}`} style={{ fontSize: 10, padding: "2px 5px" }}>
                            {c.label.slice(0, 4)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {colLeads.length === 0 ? <small className="muted" style={{ textAlign: "center", padding: 16 }}>—</small> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
