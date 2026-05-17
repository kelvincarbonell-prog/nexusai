"use client";

import { useMemo, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Perfil = {
  id: string;
  email: string;
  nombre: string | null;
  apellidos: string | null;
  rol: string;
  nombre_gestoria: string | null;
  foto_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export function PerfilForm({ initial }: { initial: Perfil }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [perfil, setPerfil] = useState(initial);
  const initialMeta = (initial.metadata ?? {}) as Record<string, string | undefined>;
  const [draft, setDraft] = useState({
    nombre: initial.nombre ?? "",
    apellidos: initial.apellidos ?? "",
    nombre_gestoria: initial.nombre_gestoria ?? "",
  });
  const [fiscal, setFiscal] = useState({
    nif_gestoria: initialMeta.nif_gestoria ?? "",
    direccion: initialMeta.direccion ?? "",
    codigo_postal: initialMeta.codigo_postal ?? "",
    localidad: initialMeta.localidad ?? "",
    provincia: initialMeta.provincia ?? "",
    pais: initialMeta.pais ?? "España",
    telefono: initialMeta.telefono ?? "",
    email_facturacion: initialMeta.email_facturacion ?? "",
    iban_cobros: initialMeta.iban_cobros ?? "",
    colegio_profesional: initialMeta.colegio_profesional ?? "",
    n_colegiado: initialMeta.n_colegiado ?? "",
    web: initialMeta.web ?? "",
    cnae: initialMeta.cnae ?? "",
    epigrafe_iae: initialMeta.epigrafe_iae ?? "",
    regimen_fiscal: initialMeta.regimen_fiscal ?? "general",
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");

  function setF<K extends keyof typeof fiscal>(k: K, v: string) {
    setFiscal((p) => ({ ...p, [k]: v }));
  }

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function guardarDatos() {
    setBusy("perfil");
    setError(null);
    setSuccess(null);
    try {
      const tk = await token();
      const metadata_patch = Object.fromEntries(
        Object.entries(fiscal).map(([k, v]) => [k, v?.trim() ?? ""]),
      );
      const res = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, metadata_patch }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setPerfil(json.perfil);
      setSuccess("Perfil y datos fiscales guardados.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function subirFoto(file: File) {
    if (file.size > 3_000_000) {
      setError("La imagen no puede pasar de 3 MB.");
      return;
    }
    setBusy("avatar");
    setError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const tk = await token();
      const res = await fetch("/api/perfil/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mime_type: file.type || "image/png",
          base64,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setPerfil((p) => ({ ...p, foto_url: json.foto_url }));
      setSuccess("Foto actualizada.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function cambiarPassword() {
    if (newPassword.length < 8) {
      setError("Mínimo 8 caracteres.");
      return;
    }
    setBusy("password");
    setError(null);
    try {
      const { error: e } = await supabase.auth.updateUser({ password: newPassword });
      if (e) throw new Error(e.message);
      setNewPassword("");
      setSuccess("Contraseña actualizada.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const initials = (perfil.nombre || perfil.email).split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");

  return (
    <section className="grid">
      <article className="card span-4" style={{ display: "grid", gap: 12, alignContent: "start" }}>
        <span className="card-eyebrow">Tu identidad</span>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "12px 0" }}>
          <div
            style={{
              width: 128,
              height: 128,
              borderRadius: "50%",
              overflow: "hidden",
              background: perfil.foto_url ? `center / cover no-repeat url("${perfil.foto_url}")` : "linear-gradient(135deg, #b794f4 0%, #67e8f9 100%)",
              display: "grid",
              placeItems: "center",
              color: "white",
              fontSize: 42,
              fontWeight: 800,
              boxShadow: "0 12px 30px -10px var(--accent-glow)",
            }}
            aria-label="Foto de perfil"
          >
            {!perfil.foto_url ? initials : null}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: "none" }}
            onChange={(e) => e.target.files?.[0] && subirFoto(e.target.files[0])}
          />
          <div className="button-row">
            <button className="button secondary compact" onClick={() => fileInput.current?.click()} disabled={busy === "avatar"}>
              {busy === "avatar" ? "Subiendo…" : "📷 Cambiar foto"}
            </button>
            {perfil.foto_url ? (
              <button
                className="button ghost compact"
                onClick={async () => {
                  setBusy("avatar");
                  const tk = await token();
                  await fetch("/api/perfil", {
                    method: "PATCH",
                    headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ foto_url: null }),
                  });
                  setPerfil((p) => ({ ...p, foto_url: null }));
                  setBusy(null);
                }}
              >
                Quitar
              </button>
            ) : null}
          </div>
          <small className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11, textAlign: "center" }}>
            PNG, JPG, WEBP — máx 3 MB
          </small>
        </div>

        <div style={{ textAlign: "center" }}>
          <strong style={{ fontSize: 18 }}>{perfil.nombre || "Sin nombre"}</strong>
          <div className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12, marginTop: 4 }}>{perfil.email}</div>
          <div style={{ marginTop: 8 }}>
            <span className="pill plain">{perfil.rol}</span>
          </div>
        </div>
      </article>

      <article className="card span-8" style={{ display: "grid", gap: 16 }}>
        <span className="card-eyebrow">Datos personales</span>
        <div className="form two-cols">
          <label className="label">
            Nombre
            <input className="input" value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />
          </label>
          <label className="label">
            Apellidos
            <input className="input" value={draft.apellidos} onChange={(e) => setDraft({ ...draft, apellidos: e.target.value })} />
          </label>
          <label className="label span-form">
            Nombre de la gestoría o despacho
            <input className="input" value={draft.nombre_gestoria} onChange={(e) => setDraft({ ...draft, nombre_gestoria: e.target.value })} placeholder="Gabinete Sánchez" />
          </label>
        </div>

        <span className="card-eyebrow" style={{ marginTop: 8 }}>Datos fiscales de la gestoría</span>
        <small className="muted" style={{ fontSize: 12, marginTop: -8 }}>
          Aparecerán en tus facturas emitidas, en la firma de modelos AEAT y en los PDF que envíes a clientes.
        </small>
        <div className="form two-cols">
          <label className="label">
            NIF / CIF de la gestoría
            <input className="input" value={fiscal.nif_gestoria} onChange={(e) => setF("nif_gestoria", e.target.value.toUpperCase())} style={{ fontFamily: "var(--mono)" }} placeholder="B12345678" />
          </label>
          <label className="label">
            CNAE / actividad
            <input className="input" value={fiscal.cnae} onChange={(e) => setF("cnae", e.target.value)} placeholder="6920 · Actividades de contabilidad" />
          </label>
          <label className="label">
            Epígrafe IAE
            <input className="input" value={fiscal.epigrafe_iae} onChange={(e) => setF("epigrafe_iae", e.target.value)} placeholder="842 · Servicios financieros y contables" />
          </label>
          <label className="label">
            Régimen fiscal
            <select className="input" value={fiscal.regimen_fiscal} onChange={(e) => setF("regimen_fiscal", e.target.value)}>
              <option value="general">Régimen general</option>
              <option value="simplificado">Régimen simplificado IVA</option>
              <option value="recargo_equivalencia">Recargo de equivalencia</option>
              <option value="modulos">Estimación objetiva (módulos)</option>
              <option value="autonomo">Autónomo · estimación directa</option>
            </select>
          </label>
          <label className="label span-form">
            Dirección fiscal
            <input className="input" value={fiscal.direccion} onChange={(e) => setF("direccion", e.target.value)} placeholder="Calle Mayor, 10, 3º A" />
          </label>
          <label className="label">
            Código postal
            <input className="input" value={fiscal.codigo_postal} onChange={(e) => setF("codigo_postal", e.target.value)} placeholder="28013" style={{ fontFamily: "var(--mono)" }} />
          </label>
          <label className="label">
            Localidad
            <input className="input" value={fiscal.localidad} onChange={(e) => setF("localidad", e.target.value)} placeholder="Madrid" />
          </label>
          <label className="label">
            Provincia
            <input className="input" value={fiscal.provincia} onChange={(e) => setF("provincia", e.target.value)} placeholder="Madrid" />
          </label>
          <label className="label">
            País
            <input className="input" value={fiscal.pais} onChange={(e) => setF("pais", e.target.value)} placeholder="España" />
          </label>
        </div>

        <span className="card-eyebrow" style={{ marginTop: 8 }}>Contacto y cobros</span>
        <div className="form two-cols">
          <label className="label">
            Teléfono
            <input type="tel" className="input" value={fiscal.telefono} onChange={(e) => setF("telefono", e.target.value)} placeholder="+34 600 000 000" />
          </label>
          <label className="label">
            Email facturación
            <input type="email" className="input" value={fiscal.email_facturacion} onChange={(e) => setF("email_facturacion", e.target.value)} placeholder="facturacion@gestoria.com" />
          </label>
          <label className="label">
            Web
            <input className="input" value={fiscal.web} onChange={(e) => setF("web", e.target.value)} placeholder="https://gestoria.com" />
          </label>
          <label className="label">
            IBAN para cobros
            <input className="input" value={fiscal.iban_cobros} onChange={(e) => setF("iban_cobros", e.target.value.toUpperCase().replace(/\s/g, ""))} style={{ fontFamily: "var(--mono)" }} placeholder="ESxx xxxx xxxx xxxx xxxx xxxx" />
          </label>
        </div>

        <span className="card-eyebrow" style={{ marginTop: 8 }}>Colegiación profesional (opcional)</span>
        <div className="form two-cols">
          <label className="label">
            Colegio profesional
            <input className="input" value={fiscal.colegio_profesional} onChange={(e) => setF("colegio_profesional", e.target.value)} placeholder="Colegio de Economistas de Madrid" />
          </label>
          <label className="label">
            Nº de colegiado
            <input className="input" value={fiscal.n_colegiado} onChange={(e) => setF("n_colegiado", e.target.value)} placeholder="12345" />
          </label>
        </div>

        <div className="button-row" style={{ justifyContent: "flex-end" }}>
          <button className="button" onClick={guardarDatos} disabled={busy === "perfil"}>
            {busy === "perfil" ? "Guardando…" : "Guardar perfil y datos fiscales"}
          </button>
        </div>
      </article>

      <article className="card span-6">
        <span className="card-eyebrow">Seguridad</span>
        <div className="form" style={{ marginTop: 8 }}>
          <label className="label">
            Nueva contraseña
            <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
          </label>
          <div className="button-row" style={{ justifyContent: "flex-end" }}>
            <button className="button" onClick={cambiarPassword} disabled={busy === "password" || newPassword.length < 8}>
              {busy === "password" ? "Cambiando…" : "Cambiar contraseña"}
            </button>
          </div>
        </div>
      </article>

      <article className="card span-6">
        <span className="card-eyebrow">Sesión</span>
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
          Tu sesión expirará automáticamente por seguridad. Puedes cerrarla manualmente desde cualquier dispositivo.
        </p>
        <div className="button-row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          <button className="button danger" onClick={signOut}>Cerrar sesión</button>
        </div>
      </article>

      {error ? <article className="card span-12" style={{ borderColor: "var(--bad)", background: "rgba(248, 113, 113, 0.06)" }}><p role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p></article> : null}
      {success ? <article className="card span-12" style={{ borderColor: "var(--good)", background: "rgba(74, 222, 128, 0.06)" }}><p role="status" style={{ color: "var(--good)", margin: 0 }}>{success}</p></article> : null}
    </section>
  );
}
