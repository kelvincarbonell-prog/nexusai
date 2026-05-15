"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Step = "intro" | "empresa" | "listo";

export function OnboardingWizard({ userName }: { userName?: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [tipo, setTipo] = useState<"autonomo" | "empresa">("empresa");
  const [nombre, setNombre] = useState("");
  const [nif, setNif] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empresa, setEmpresa] = useState<{ id: string; nombre: string; inbox_alias: string } | null>(null);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function crearEmpresa() {
    if (nombre.length < 2 || nif.length < 8) {
      setError("Revisa el nombre y NIF.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tk = await token();
      const res = await fetch("/api/onboarding/empresa", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, nif, account_type: tipo }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setEmpresa(json.empresa);
      setStep("listo");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    setBusy(true);
    try {
      const tk = await token();
      await fetch("/api/onboarding/empresa", { method: "PATCH", headers: { Authorization: `Bearer ${tk}` } });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function finish() {
    router.refresh();
    if (empresa) router.push(`/clientes/${empresa.id}`);
  }

  const progress = step === "intro" ? 33 : step === "empresa" ? 66 : 100;
  const first = userName?.split(" ")[0];

  return (
    <article className="card span-12 onboarding glow-border" style={{ position: "relative", overflow: "hidden" }}>
      <div className="onboarding-dots" aria-hidden="true">
        <span className={step === "intro" ? "active" : "done"} />
        <span className={step === "empresa" ? "active" : step === "listo" ? "done" : ""} />
        <span className={step === "listo" ? "active" : ""} />
      </div>

      <div className="onboarding-bar" aria-hidden="true">
        <span style={{ ["--p" as never]: `${progress}%` } as React.CSSProperties} />
      </div>

      {step === "intro" ? (
        <div className="onboarding-body">
          <span className="card-eyebrow">Bienvenido a M26</span>
          <h2 className="title" style={{ fontSize: 32, marginTop: 8 }}>
            Hola{first ? `, ${first}` : ""}. <em>Pongamos M26 en marcha en 60 segundos.</em>
          </h2>
          <p className="subtitle">
            En tres pasos: creas tu primera empresa, recibes tu buzón único de facturas y entras al panel. Sin tarjeta,
            sin configuración técnica.
          </p>
          <ul className="onboarding-bullets">
            <li>● Cada empresa tiene su propio buzón <code>facturas-xxx@inbox.m26.app</code></li>
            <li>● Reenvías una factura por email y M26 la procesa sola</li>
            <li>● Modelos AEAT y nóminas calculados en directo</li>
          </ul>
          <div className="button-row" style={{ marginTop: 18 }}>
            <button className="button" onClick={() => setStep("empresa")}>Empezar →</button>
            <button className="button ghost" onClick={skip} disabled={busy}>Saltar onboarding</button>
          </div>
        </div>
      ) : null}

      {step === "empresa" ? (
        <div className="onboarding-body">
          <span className="card-eyebrow">Paso 1 · Datos básicos</span>
          <h2 className="title" style={{ fontSize: 26, marginTop: 8 }}>
            ¿Sobre qué empresa empezamos?
          </h2>
          <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>
            Puedes añadir más después. Si gestionas a otros, esta empresa será tu cliente inicial.
          </p>

          <div className="form two-cols" style={{ marginTop: 16 }}>
            <label className="label">
              Tipo
              <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as "autonomo" | "empresa")}>
                <option value="empresa">Empresa / sociedad</option>
                <option value="autonomo">Autónomo</option>
              </select>
            </label>
            <label className="label">
              {tipo === "autonomo" ? "Nombre completo" : "Razón social"}
              <input
                className="input"
                placeholder={tipo === "autonomo" ? "Juan García López" : "Innova Apps S.L."}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                autoFocus
              />
            </label>
            <label className="label span-form">
              {tipo === "autonomo" ? "DNI / NIE" : "CIF"}
              <input
                className="input"
                placeholder={tipo === "autonomo" ? "12345678Z" : "B12345674"}
                value={nif}
                onChange={(e) => setNif(e.target.value.toUpperCase())}
                maxLength={20}
                style={{ fontFamily: "var(--mono)" }}
              />
            </label>
          </div>

          {error ? <p role="alert" style={{ color: "var(--bad)", marginTop: 12 }}>{error}</p> : null}

          <div className="button-row" style={{ marginTop: 18, justifyContent: "space-between" }}>
            <button className="button secondary" onClick={() => setStep("intro")} disabled={busy}>← Atrás</button>
            <div className="button-row">
              <button className="button ghost" onClick={skip} disabled={busy}>Saltar</button>
              <button className="button" onClick={crearEmpresa} disabled={busy || !nombre || !nif}>
                {busy ? "Creando…" : "Crear empresa →"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {step === "listo" && empresa ? (
        <div className="onboarding-body">
          <span className="card-eyebrow good">Listo</span>
          <h2 className="title" style={{ fontSize: 30, marginTop: 8 }}>
            <em>{empresa.nombre}</em> ya está en M26.
          </h2>
          <p className="subtitle">
            Reenvía cualquier factura recibida a este buzón y aparecerá en tu contabilidad — procesada, validada y
            categorizada.
          </p>

          <div className="onboarding-alias" role="region" aria-label="Buzón de facturas">
            <span className="demo-muted" style={{ fontSize: 11 }}>Tu buzón único de facturas</span>
            <div className="alias-box">
              <code>{empresa.inbox_alias}@inbox.m26.app</code>
              <button
                className="button compact secondary"
                onClick={() => {
                  navigator.clipboard?.writeText(`${empresa.inbox_alias}@inbox.m26.app`);
                }}
              >
                Copiar
              </button>
            </div>
            <small className="muted">Configúralo como reenvío automático en tu gestor de correo.</small>
          </div>

          <div className="button-row" style={{ marginTop: 18, justifyContent: "flex-end" }}>
            <button className="button" onClick={finish}>Abrir {empresa.nombre} →</button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
