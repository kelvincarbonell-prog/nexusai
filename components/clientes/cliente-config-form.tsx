"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Empresa = {
  id: string;
  nombre: string;
  nif: string | null;
  account_type: string | null;
  plan: string | null;
  inbox_alias: string | null;
  metadata: Record<string, unknown>;
};

export function ClienteConfigForm({ empresa }: { empresa: Empresa }) {
  const meta = empresa.metadata ?? {};
  const [form, setForm] = useState({
    nombre: empresa.nombre ?? "",
    nif: empresa.nif ?? "",
    account_type: (empresa.account_type ?? "empresa") as "autonomo" | "empresa",
    plan: empresa.plan ?? "starter",
    cliente_email: (meta.cliente_email as string | undefined) ?? "",
    cliente_telefono: (meta.cliente_telefono as string | undefined) ?? "",
    cliente_direccion: (meta.cliente_direccion as string | undefined) ?? "",
    cnae: (meta.cnae as string | undefined) ?? "",
    ccaa: (meta.ccaa as string | undefined) ?? "",
    iban: (meta.iban as string | undefined) ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function setField<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function guardar() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const supabase = createBrowserSupabase();
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch(`/api/empresas/${empresa.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          nif: form.nif,
          account_type: form.account_type,
          plan: form.plan,
          metadata_patch: {
            cliente_email: form.cliente_email,
            cliente_telefono: form.cliente_telefono,
            cliente_direccion: form.cliente_direccion,
            cnae: form.cnae,
            ccaa: form.ccaa,
            iban: form.iban,
          },
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setSuccess("Configuración guardada.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid">
      <article className="card span-12">
        <span className="card-eyebrow">Datos generales</span>
        <div className="form two-cols" style={{ marginTop: 12 }}>
          <label className="label">
            Razón social / nombre
            <input className="input" value={form.nombre} onChange={(e) => setField("nombre", e.target.value)} />
          </label>
          <label className="label">
            NIF / CIF
            <input className="input" value={form.nif} onChange={(e) => setField("nif", e.target.value.toUpperCase())} style={{ fontFamily: "var(--mono)" }} />
          </label>
          <label className="label">
            Tipo
            <select className="input" value={form.account_type} onChange={(e) => setField("account_type", e.target.value as "autonomo" | "empresa")}>
              <option value="empresa">Empresa</option>
              <option value="autonomo">Autónomo</option>
            </select>
          </label>
          <label className="label">
            Plan
            <select className="input" value={form.plan} onChange={(e) => setField("plan", e.target.value)}>
              <option value="starter">Starter</option>
              <option value="negocio">Negocio</option>
              <option value="premium">Premium</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </label>
          <label className="label">
            CNAE
            <input className="input" value={form.cnae} onChange={(e) => setField("cnae", e.target.value)} placeholder="6201 Programación informática" />
          </label>
          <label className="label">
            Comunidad autónoma
            <select className="input" value={form.ccaa} onChange={(e) => setField("ccaa", e.target.value)}>
              <option value="">—</option>
              <option value="madrid">Madrid</option>
              <option value="cataluna">Cataluña</option>
              <option value="valencia">Comunidad Valenciana</option>
              <option value="andalucia">Andalucía</option>
              <option value="pais_vasco">País Vasco</option>
              <option value="galicia">Galicia</option>
              <option value="aragon">Aragón</option>
              <option value="canarias">Canarias</option>
              <option value="castilla_leon">Castilla y León</option>
              <option value="castilla_la_mancha">Castilla-La Mancha</option>
              <option value="murcia">Murcia</option>
              <option value="navarra">Navarra</option>
              <option value="asturias">Asturias</option>
              <option value="cantabria">Cantabria</option>
              <option value="baleares">Baleares</option>
              <option value="extremadura">Extremadura</option>
              <option value="rioja">La Rioja</option>
              <option value="ceuta">Ceuta</option>
              <option value="melilla">Melilla</option>
            </select>
          </label>
        </div>
      </article>

      <article className="card span-12">
        <span className="card-eyebrow">Contacto</span>
        <div className="form two-cols" style={{ marginTop: 12 }}>
          <label className="label">
            Email
            <input type="email" className="input" value={form.cliente_email} onChange={(e) => setField("cliente_email", e.target.value)} />
          </label>
          <label className="label">
            Teléfono
            <input className="input" value={form.cliente_telefono} onChange={(e) => setField("cliente_telefono", e.target.value)} />
          </label>
          <label className="label span-form">
            Dirección
            <input className="input" value={form.cliente_direccion} onChange={(e) => setField("cliente_direccion", e.target.value)} />
          </label>
          <label className="label span-form">
            IBAN principal
            <input className="input" value={form.iban} onChange={(e) => setField("iban", e.target.value.toUpperCase().replace(/\s/g, ""))} style={{ fontFamily: "var(--mono)" }} placeholder="ESxx xxxx xxxx xxxx xxxx xxxx" />
          </label>
        </div>
      </article>

      {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
      {success ? <p role="status" style={{ color: "var(--good)" }}>{success}</p> : null}

      <div className="card span-12" style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="button" onClick={guardar} disabled={busy}>
          {busy ? "Guardando…" : "Guardar configuración"}
        </button>
      </div>
    </section>
  );
}
