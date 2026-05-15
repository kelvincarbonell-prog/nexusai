"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { validateNif } from "@/lib/aeat/validators";

export function NuevoClienteForm({ onClose, onCreated }: { onClose?: () => void; onCreated?: (id: string) => void }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const router = useRouter();
  const [tipo, setTipo] = useState<"autonomo" | "empresa">("empresa");
  const [draft, setDraft] = useState({
    nombre: "",
    nif: "",
    cliente_email: "",
    cliente_telefono: "",
    cliente_direccion: "",
    plan: "negocio",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nifCheck = useMemo(() => validateNif(draft.nif), [draft.nif]);

  async function crear() {
    if (!draft.nombre || draft.nombre.length < 2) {
      setError("Indica el nombre o razón social.");
      return;
    }
    if (!nifCheck.ok) {
      setError(`NIF/CIF inválido: ${nifCheck.reason}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const tk = session.session?.access_token ?? "";
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          nif: draft.nif.toUpperCase().replace(/\s|-/g, ""),
          account_type: tipo,
          cliente_email: draft.cliente_email || undefined,
          cliente_telefono: draft.cliente_telefono || undefined,
          cliente_direccion: draft.cliente_direccion || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      if (onCreated) onCreated(json.empresa.id);
      router.refresh();
      onClose?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card span-12 glow-border" style={{ display: "grid", gap: 12 }}>
      <div className="topbar" style={{ border: 0, padding: 0, margin: 0, alignItems: "flex-start" }}>
        <div>
          <span className="card-eyebrow">Nuevo cliente</span>
          <h3 style={{ marginTop: 4, fontSize: 20, fontWeight: 700 }}>Añade un autónomo o empresa</h3>
        </div>
        {onClose ? <button className="button ghost compact" onClick={onClose}>×</button> : null}
      </div>

      <div className="register-type-grid">
        <button type="button" className={`register-type ${tipo === "autonomo" ? "active" : ""}`} onClick={() => setTipo("autonomo")}>
          <span className="register-icon">👤</span>
          <strong>Autónomo</strong>
          <small>Profesional o freelance</small>
        </button>
        <button type="button" className={`register-type ${tipo === "empresa" ? "active" : ""}`} onClick={() => setTipo("empresa")}>
          <span className="register-icon">🏢</span>
          <strong>Empresa</strong>
          <small>S.L., S.A., CB, sociedad civil</small>
        </button>
      </div>

      <div className="form two-cols">
        <label className="label">
          {tipo === "autonomo" ? "Nombre completo" : "Razón social"}
          <input className="input" value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} placeholder={tipo === "autonomo" ? "Ana García López" : "Innova Apps S.L."} autoFocus />
        </label>
        <label className="label">
          {tipo === "autonomo" ? "DNI / NIE" : "CIF"}
          <input className="input" style={{ fontFamily: "var(--mono)" }} value={draft.nif} onChange={(e) => setDraft({ ...draft, nif: e.target.value.toUpperCase() })} placeholder={tipo === "autonomo" ? "12345678Z" : "B12345674"} maxLength={20} />
          {draft.nif.length >= 8 ? (
            <small style={{ color: nifCheck.ok ? "var(--good)" : "var(--warn)", fontFamily: "var(--mono)", fontSize: 11 }}>
              {nifCheck.ok ? `✓ ${nifCheck.tipo} válido` : `✕ ${nifCheck.reason}`}
            </small>
          ) : null}
        </label>
        <label className="label">
          Email de contacto
          <input className="input" type="email" value={draft.cliente_email} onChange={(e) => setDraft({ ...draft, cliente_email: e.target.value })} placeholder="contacto@cliente.es" />
        </label>
        <label className="label">
          Teléfono
          <input className="input" value={draft.cliente_telefono} onChange={(e) => setDraft({ ...draft, cliente_telefono: e.target.value })} placeholder="+34 600 12 34 56" />
        </label>
        <label className="label span-form">
          Dirección fiscal
          <input className="input" value={draft.cliente_direccion} onChange={(e) => setDraft({ ...draft, cliente_direccion: e.target.value })} placeholder="Calle Mayor 12, 28001 Madrid" />
        </label>
        <label className="label">
          Plan
          <select className="input" value={draft.plan} onChange={(e) => setDraft({ ...draft, plan: e.target.value })}>
            <option value="negocio">Negocio</option>
            <option value="negocio_plus">Negocio +</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </label>
      </div>

      {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}

      <div className="button-row" style={{ justifyContent: "flex-end" }}>
        {onClose ? <button className="button secondary" onClick={onClose} disabled={busy}>Cancelar</button> : null}
        <button className="button" onClick={crear} disabled={busy || !nifCheck.ok}>
          {busy ? "Creando…" : "Crear cliente"}
        </button>
      </div>
    </div>
  );
}
