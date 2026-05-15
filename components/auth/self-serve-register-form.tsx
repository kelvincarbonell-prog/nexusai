"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { validateNif } from "@/lib/aeat/validators";

type Step = 1 | 2 | 3;
type AccountType = "autonomo" | "empresa";

type FormState = {
  accountType: AccountType;
  name: string;
  email: string;
  password: string;
  businessName: string;
  nif: string;
};

function passwordStrength(p: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  const labels = ["muy débil", "débil", "regular", "buena", "fuerte"] as const;
  return { score: s as 0 | 1 | 2 | 3 | 4, label: labels[s] };
}

export function SelfServeRegisterForm() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>({
    accountType: "autonomo",
    name: "",
    email: "",
    password: "",
    businessName: "",
    nif: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const strength = passwordStrength(form.password);
  const nifCheck = useMemo(() => validateNif(form.nif), [form.nif]);
  const emailLooksOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function next() {
    setError(null);
    if (step === 1) setStep(2);
    else if (step === 2) {
      if (form.name.trim().length < 2) {
        setError("Indícanos tu nombre completo.");
        return;
      }
      if (!emailLooksOk) {
        setError("Revisa tu email.");
        return;
      }
      if (strength.score < 2) {
        setError("La contraseña es demasiado débil. Usa al menos 8 caracteres con mayúsculas y números.");
        return;
      }
      setStep(3);
    }
  }

  function back() {
    setError(null);
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (form.businessName.trim().length < 2) {
        setError(form.accountType === "autonomo" ? "Indica tu nombre fiscal." : "Indica la razón social.");
        return;
      }
      if (!nifCheck.ok) {
        setError(`NIF/CIF inválido: ${nifCheck.reason}`);
        return;
      }

      const { data, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            name: form.name,
            business_name: form.businessName,
            nif: form.nif.toUpperCase().replace(/\s|-/g, ""),
            account_type: form.accountType,
            onboarding_source: "self_serve",
          },
        },
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (!data.session || !data.user) {
        setSuccess("Cuenta creada. Revisa tu email para confirmar el acceso y vuelve al login.");
        return;
      }

      const { error: profileError } = await supabase.from("perfiles").upsert({
        id: data.user.id,
        email: form.email,
        nombre: form.name,
        rol: "portal_cliente",
      });
      if (profileError) {
        setError(`Cuenta creada, pero error en perfil: ${profileError.message}`);
        return;
      }

      const { error: companyError } = await supabase.from("empresas").insert({
        owner_user_id: data.user.id,
        gestor_id: data.user.id,
        nombre: form.businessName,
        nif: form.nif.toUpperCase().replace(/\s|-/g, ""),
        account_type: form.accountType,
        onboarding_source: "self_serve",
      });
      if (companyError) {
        setError(`Cuenta creada, pero error al crear empresa: ${companyError.message}`);
        return;
      }

      setSuccess("¡Cuenta creada! Llevándote al dashboard…");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 900);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="register-success">
        <div className="success-icon" aria-hidden="true">✓</div>
        <h2 className="title" style={{ fontSize: 26, marginTop: 8 }}>{success}</h2>
        <p className="muted" style={{ fontSize: 14, marginTop: 8 }}>
          Si no te redirige solo, <a href="/dashboard" style={{ color: "var(--accent)", textDecoration: "underline" }}>entra aquí</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="register-form">
      <div className="register-progress" aria-label={`Paso ${step} de 3`}>
        <div className="register-steps">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`step ${step >= s ? "active" : ""} ${step > s ? "done" : ""}`}>
              <span className="dot">{step > s ? "✓" : s}</span>
              <span className="lbl">
                {s === 1 ? "Tipo" : s === 2 ? "Datos" : "Fiscal"}
              </span>
            </div>
          ))}
        </div>
        <div className="register-bar" aria-hidden="true">
          <span style={{ ["--p" as never]: `${((step - 1) / 2) * 100}%` } as React.CSSProperties} />
        </div>
      </div>

      {step === 1 ? (
        <div className="register-step">
          <span className="card-eyebrow">Paso 1</span>
          <h2 className="title" style={{ fontSize: 28, marginTop: 6 }}>
            ¿Quién <em>eres</em>?
          </h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
            Elige el perfil que mejor te describe. Podrás cambiarlo o añadir más entidades después.
          </p>

          <div className="register-type-grid">
            <button
              type="button"
              className={`register-type ${form.accountType === "autonomo" ? "active" : ""}`}
              onClick={() => update("accountType", "autonomo")}
            >
              <span className="register-icon">👤</span>
              <strong>Autónomo</strong>
              <small>Profesional, freelance o trabajador por cuenta propia.</small>
              <span className="pill plain">9 €/mes</span>
            </button>
            <button
              type="button"
              className={`register-type ${form.accountType === "empresa" ? "active" : ""}`}
              onClick={() => update("accountType", "empresa")}
            >
              <span className="register-icon">🏢</span>
              <strong>Empresa / Pyme</strong>
              <small>S.L., S.A., comunidad de bienes o cualquier sociedad.</small>
              <span className="pill plain">39 €/mes</span>
            </button>
          </div>

          <div className="register-actions">
            <span />
            <button type="button" className="button" onClick={next}>
              Continuar →
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="register-step">
          <span className="card-eyebrow">Paso 2 · Tus datos</span>
          <h2 className="title" style={{ fontSize: 28, marginTop: 6 }}>
            Crea tu acceso.
          </h2>

          <div className="form" style={{ marginTop: 14 }}>
            <label className="label">
              Nombre completo
              <input
                className="input"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Ana García López"
                autoFocus
              />
            </label>
            <label className="label">
              Email
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value.toLowerCase())}
                placeholder="tu@email.com"
                autoComplete="email"
              />
              {form.email.length > 0 && !emailLooksOk ? (
                <small style={{ color: "var(--warn)", fontFamily: "var(--mono)", fontSize: 11 }}>Email no parece válido</small>
              ) : null}
            </label>
            <label className="label">
              Contraseña
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
              />
              {form.password.length > 0 ? (
                <div className="strength" aria-label={`Fuerza de la contraseña: ${strength.label}`}>
                  <div className="strength-bars">
                    {[1, 2, 3, 4].map((i) => (
                      <span key={i} className={i <= strength.score ? `lvl-${strength.score}` : ""} />
                    ))}
                  </div>
                  <small style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 11 }}>{strength.label}</small>
                </div>
              ) : null}
            </label>
          </div>

          <div className="register-actions">
            <button type="button" className="button secondary" onClick={back}>← Atrás</button>
            <button type="button" className="button" onClick={next}>Continuar →</button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="register-step">
          <span className="card-eyebrow">Paso 3 · {form.accountType === "autonomo" ? "Datos fiscales" : "Empresa"}</span>
          <h2 className="title" style={{ fontSize: 28, marginTop: 6 }}>
            {form.accountType === "autonomo" ? "Casi listo, Ana." : "Tu empresa."}
          </h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
            Estos datos van en tus facturas y modelos AEAT. Puedes editarlos después.
          </p>

          <div className="form" style={{ marginTop: 14 }}>
            <label className="label">
              {form.accountType === "autonomo" ? "Nombre fiscal" : "Razón social"}
              <input
                className="input"
                value={form.businessName}
                onChange={(e) => update("businessName", e.target.value)}
                placeholder={form.accountType === "autonomo" ? "Ana García López" : "Innova Apps S.L."}
                autoFocus
              />
            </label>
            <label className="label">
              {form.accountType === "autonomo" ? "DNI / NIE" : "CIF"}
              <input
                className="input"
                style={{ fontFamily: "var(--mono)" }}
                value={form.nif}
                onChange={(e) => update("nif", e.target.value.toUpperCase())}
                placeholder={form.accountType === "autonomo" ? "12345678Z" : "B12345674"}
                maxLength={20}
              />
              {form.nif.length >= 8 ? (
                <small
                  style={{
                    color: nifCheck.ok ? "var(--good)" : "var(--warn)",
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                  }}
                >
                  {nifCheck.ok ? `✓ ${nifCheck.tipo} válido` : `✕ ${nifCheck.reason}`}
                </small>
              ) : null}
            </label>
          </div>

          <p className="muted" style={{ fontSize: 12, marginTop: 14, lineHeight: 1.5 }}>
            Al crear la cuenta aceptas los <a href="#" style={{ color: "var(--accent)", textDecoration: "underline" }}>términos</a> y la
            {" "}<a href="#" style={{ color: "var(--accent)", textDecoration: "underline" }}>política de privacidad</a>. Sin tarjeta · 14 días gratis · cancelas en un clic.
          </p>

          <div className="register-actions">
            <button type="button" className="button secondary" onClick={back} disabled={busy}>← Atrás</button>
            <button type="button" className="button" onClick={submit} disabled={busy || !nifCheck.ok}>
              {busy ? "Creando…" : "Crear cuenta ✓"}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p role="alert" className="register-error">{error}</p> : null}
    </div>
  );
}
