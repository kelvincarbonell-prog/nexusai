"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, FileText, ArrowRight, ArrowLeft, Rocket, ScanLine } from "lucide-react";
import { WelcomeShell, WelcomeButton, WelcomeSuccess } from "@/components/welcome/welcome-shell";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const STEPS = [
  { key: "bienvenida", label: "Bienvenida" },
  { key: "datos", label: "Datos personales" },
  { key: "fiscal", label: "Régimen fiscal" },
  { key: "fin", label: "Listo" },
];

export default function BienvenidaAutonomo() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [datos, setDatos] = useState({
    nombre: "",         // nombre comercial / persona física
    nif: "",            // DNI o NIE
    epigrafe_iae: "",
    fecha_alta: new Date().toISOString().slice(0, 10),
  });

  const [fiscal, setFiscal] = useState({
    direccion: "",
    codigo_postal: "",
    localidad: "",
    provincia: "",
    ccaa: "madrid",
    telefono: "",
    email_facturacion: "",
    iban: "",
    regimen_irpf: "estimacion_directa",         // estimacion_directa | estimacion_directa_simplificada | modulos
    regimen_iva: "general",                       // general | simplificado | recargo_equivalencia | agricultura | caja
    retencion_clientes: "no",                      // si/no
    porcentaje_retencion: "15",
    actividad_profesional: "no",
  });

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }
      const { data: empresa } = await supabase
        .from("empresas")
        .select("id,nombre,nif,metadata")
        .eq("owner_user_id", auth.user.id)
        .maybeSingle();
      if (empresa) {
        setEmpresaId(empresa.id);
        setDatos((d) => ({ ...d, nombre: empresa.nombre ?? "", nif: empresa.nif ?? "" }));
        const meta = (empresa.metadata ?? {}) as Record<string, string>;
        setDatos((d) => ({ ...d, epigrafe_iae: meta.epigrafe_iae ?? d.epigrafe_iae }));
        setFiscal((f) => ({
          ...f,
          direccion: meta.cliente_direccion ?? f.direccion,
          codigo_postal: meta.codigo_postal ?? f.codigo_postal,
          localidad: meta.localidad ?? f.localidad,
          provincia: meta.provincia ?? f.provincia,
          ccaa: (meta.ccaa as string) ?? f.ccaa,
          telefono: meta.cliente_telefono ?? f.telefono,
          email_facturacion: meta.cliente_email ?? f.email_facturacion,
          iban: meta.iban ?? f.iban,
          regimen_iva: (meta.regimen_iva as string) ?? f.regimen_iva,
          regimen_irpf: (meta.regimen_irpf as string) ?? f.regimen_irpf,
          retencion_clientes: (meta.retencion_clientes as string) ?? f.retencion_clientes,
          porcentaje_retencion: meta.porcentaje_retencion ?? f.porcentaje_retencion,
          actividad_profesional: (meta.actividad_profesional as string) ?? f.actividad_profesional,
        }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar(): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      if (!empresaId) {
        const res = await fetch("/api/clientes", {
          method: "POST",
          headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: datos.nombre,
            nif: datos.nif,
            account_type: "autonomo",
          }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "Error");
        setEmpresaId(json.empresa.id);
        return true;
      }
      const res = await fetch(`/api/empresas/${empresaId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: datos.nombre,
          nif: datos.nif,
          account_type: "autonomo",
          metadata_patch: {
            epigrafe_iae: datos.epigrafe_iae,
            fecha_alta_actividad: datos.fecha_alta,
            cliente_direccion: fiscal.direccion,
            codigo_postal: fiscal.codigo_postal,
            localidad: fiscal.localidad,
            provincia: fiscal.provincia,
            ccaa: fiscal.ccaa,
            cliente_telefono: fiscal.telefono,
            cliente_email: fiscal.email_facturacion,
            iban: fiscal.iban,
            regimen_irpf: fiscal.regimen_irpf,
            regimen_iva: fiscal.regimen_iva,
            retencion_clientes: fiscal.retencion_clientes,
            porcentaje_retencion: fiscal.porcentaje_retencion,
            actividad_profesional: fiscal.actividad_profesional,
          },
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function siguiente() {
    setError(null);
    if (step === 1) {
      if (!datos.nombre.trim() || !datos.nif.trim()) {
        setError("Nombre y DNI/NIE son obligatorios.");
        return;
      }
      const ok = await guardar();
      if (!ok) return;
    }
    if (step === 2) {
      const ok = await guardar();
      if (!ok) return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  return (
    <WelcomeShell
      eyebrow="Bienvenido autónomo"
      title={<>Tu actividad en <span className="brand-text">Modelo 26</span></>}
      subtitle="Configura tu régimen fiscal en 3 pasos. Tarda 2 minutos."
      steps={STEPS}
      currentStep={step}
    >
      {step === 0 ? (
        <div style={{ textAlign: "center", display: "grid", gap: 16 }}>
          <WelcomeSuccess
            title="Cuenta activa"
            subtitle="Vamos a configurar tu régimen fiscal. M26 calculará automáticamente tu IVA, IRPF, retenciones y todos los modelos AEAT."
            icon={<User size={36} strokeWidth={1.8} color="white" />}
          />
          <ul style={{ listStyle: "none", padding: 0, margin: "12px auto", display: "grid", gap: 8, maxWidth: 380, textAlign: "left", fontSize: 13 }}>
            <li style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <User size={14} color="var(--accent)" /> Tus datos personales
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <FileText size={14} color="var(--accent)" /> Tu régimen fiscal (IRPF + IVA)
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ScanLine size={14} color="var(--accent)" /> Primera factura con OCR
            </li>
          </ul>
          <WelcomeButton onClick={siguiente}>Empezar <ArrowRight size={15} /></WelcomeButton>
        </div>
      ) : null}

      {step === 1 ? (
        <div style={{ display: "grid", gap: 16 }}>
          <header>
            <span className="card-eyebrow">Paso 1 de 3</span>
            <h2 style={{ fontSize: 20, margin: "4px 0 0" }}>Tus datos personales</h2>
          </header>
          <div className="form two-cols">
            <label className="label">
              Nombre y apellidos <span style={{ color: "var(--bad)" }}>*</span>
              <input className="input" autoFocus value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} placeholder="Carlos Ruiz Pérez" />
              <small className="muted" style={{ fontSize: 11 }}>Como persona física que ejerce la actividad.</small>
            </label>
            <label className="label">
              DNI / NIE <span style={{ color: "var(--bad)" }}>*</span>
              <input className="input" value={datos.nif} onChange={(e) => setDatos({ ...datos, nif: e.target.value.toUpperCase() })} style={{ fontFamily: "var(--mono)" }} placeholder="12345678X" />
            </label>
            <label className="label">
              Epígrafe IAE
              <input className="input" value={datos.epigrafe_iae} onChange={(e) => setDatos({ ...datos, epigrafe_iae: e.target.value })} placeholder="843 · Servicios financieros" />
              <small className="muted" style={{ fontSize: 11 }}>Lo encuentras en tu Modelo 036/037.</small>
            </label>
            <label className="label">
              Fecha de alta de la actividad
              <input type="date" className="input" value={datos.fecha_alta} onChange={(e) => setDatos({ ...datos, fecha_alta: e.target.value })} />
            </label>
            <label className="label">
              Dirección fiscal
              <input className="input" value={fiscal.direccion} onChange={(e) => setFiscal({ ...fiscal, direccion: e.target.value })} placeholder="Calle Sol 5, 2º A" />
            </label>
            <label className="label">
              Código postal
              <input className="input" value={fiscal.codigo_postal} onChange={(e) => setFiscal({ ...fiscal, codigo_postal: e.target.value })} style={{ fontFamily: "var(--mono)" }} placeholder="28013" />
            </label>
            <label className="label">
              Localidad
              <input className="input" value={fiscal.localidad} onChange={(e) => setFiscal({ ...fiscal, localidad: e.target.value })} placeholder="Madrid" />
            </label>
            <label className="label">
              Provincia
              <input className="input" value={fiscal.provincia} onChange={(e) => setFiscal({ ...fiscal, provincia: e.target.value })} placeholder="Madrid" />
            </label>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div style={{ display: "grid", gap: 16 }}>
          <header>
            <span className="card-eyebrow">Paso 2 de 3</span>
            <h2 style={{ fontSize: 20, margin: "4px 0 0" }}>Tu régimen fiscal</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Lo que marques aquí determina los modelos AEAT que te toca presentar. Puedes consultar tu modelo 036/037 si tienes dudas.
            </p>
          </header>
          <div className="form two-cols">
            <label className="label">
              Régimen de IRPF <span style={{ color: "var(--bad)" }}>*</span>
              <select className="input" value={fiscal.regimen_irpf} onChange={(e) => setFiscal({ ...fiscal, regimen_irpf: e.target.value })}>
                <option value="estimacion_directa">Estimación directa normal</option>
                <option value="estimacion_directa_simplificada">Estimación directa simplificada</option>
                <option value="modulos">Estimación objetiva (módulos)</option>
              </select>
              <small className="muted" style={{ fontSize: 11 }}>Lo normal en autónomos: estimación directa simplificada.</small>
            </label>
            <label className="label">
              Régimen de IVA <span style={{ color: "var(--bad)" }}>*</span>
              <select className="input" value={fiscal.regimen_iva} onChange={(e) => setFiscal({ ...fiscal, regimen_iva: e.target.value })}>
                <option value="general">Régimen general</option>
                <option value="simplificado">Simplificado</option>
                <option value="recargo_equivalencia">Recargo de equivalencia (comercio minorista)</option>
                <option value="agricultura">Agricultura, ganadería y pesca</option>
                <option value="caja">Régimen especial del criterio de caja</option>
              </select>
            </label>
            <label className="label">
              ¿Es actividad profesional? <span style={{ color: "var(--bad)" }}>*</span>
              <select className="input" value={fiscal.actividad_profesional} onChange={(e) => setFiscal({ ...fiscal, actividad_profesional: e.target.value })}>
                <option value="no">No (actividad empresarial)</option>
                <option value="si">Sí (profesional liberal)</option>
              </select>
              <small className="muted" style={{ fontSize: 11 }}>
                Los profesionales aplican retención IRPF en sus facturas (7 % nuevos, 15 % general).
              </small>
            </label>
            {fiscal.actividad_profesional === "si" ? (
              <label className="label">
                % retención IRPF a clientes
                <select className="input" value={fiscal.porcentaje_retencion} onChange={(e) => setFiscal({ ...fiscal, porcentaje_retencion: e.target.value })}>
                  <option value="7">7 % (primer año y 2 siguientes)</option>
                  <option value="15">15 % (general)</option>
                </select>
              </label>
            ) : <div />}
            <label className="label">
              Teléfono
              <input className="input" value={fiscal.telefono} onChange={(e) => setFiscal({ ...fiscal, telefono: e.target.value })} placeholder="+34 600 000 000" />
            </label>
            <label className="label">
              Email facturación
              <input type="email" className="input" value={fiscal.email_facturacion} onChange={(e) => setFiscal({ ...fiscal, email_facturacion: e.target.value })} placeholder="hola@tuactividad.com" />
            </label>
            <label className="label span-form">
              IBAN
              <input className="input" value={fiscal.iban} onChange={(e) => setFiscal({ ...fiscal, iban: e.target.value.toUpperCase().replace(/\s/g, "") })} style={{ fontFamily: "var(--mono)" }} placeholder="ES00 0000 0000 0000 0000 0000" />
            </label>
          </div>

          {/* Modelos que aplican según régimen */}
          <div style={{ padding: 14, borderRadius: 10, background: "color-mix(in srgb, var(--accent) 6%, transparent)", border: "1px solid var(--line)" }}>
            <span className="card-eyebrow">Modelos AEAT que te tocarán</span>
            <ul style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 12, lineHeight: 1.7 }}>
              {fiscal.regimen_iva !== "recargo_equivalencia" ? <li><strong>303</strong> · IVA trimestral</li> : null}
              <li><strong>130</strong> · Pago fraccionado IRPF trimestral</li>
              <li><strong>100</strong> · Declaración Renta anual</li>
              {fiscal.actividad_profesional === "si" ? <li><strong>111</strong> · Retenciones IRPF (si tienes trabajadores o profesionales contratados)</li> : null}
              <li><strong>390</strong> · Resumen anual IVA (enero)</li>
              <li><strong>347</strong> · Operaciones con terceros &gt; 3.005 € (febrero)</li>
            </ul>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div style={{ textAlign: "center", display: "grid", gap: 16 }}>
          <WelcomeSuccess
            title="¡Configurado!"
            subtitle={`Ya puedes facturar, llevar gastos y presentar tus modelos AEAT.`}
            icon={<Rocket size={36} strokeWidth={1.8} color="white" />}
          />
          <ul style={{ listStyle: "none", padding: 0, margin: "12px auto", display: "grid", gap: 6, maxWidth: 400, textAlign: "left", fontSize: 13 }}>
            <li>✓ Datos personales registrados</li>
            <li>✓ Régimen IRPF: {fiscal.regimen_irpf === "estimacion_directa" ? "Estimación directa" : fiscal.regimen_irpf === "estimacion_directa_simplificada" ? "ED simplificada" : "Módulos"}</li>
            <li>✓ Régimen IVA: {fiscal.regimen_iva}</li>
            {fiscal.actividad_profesional === "si" ? <li>✓ Retención IRPF en facturas: {fiscal.porcentaje_retencion} %</li> : null}
            <li>✓ Calendario fiscal personalizado activado</li>
          </ul>
          <WelcomeButton onClick={() => router.push("/portal")}>
            Ir a mi portal <ArrowRight size={15} />
          </WelcomeButton>
        </div>
      ) : null}

      {error ? <p role="alert" style={{ color: "var(--bad)", fontSize: 13, marginTop: 12 }}>{error}</p> : null}

      {step > 0 && step < 3 ? (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
          <button className="button ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={busy} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={14} /> Atrás
          </button>
          <WelcomeButton onClick={siguiente} loading={busy}>
            Continuar <ArrowRight size={15} />
          </WelcomeButton>
        </div>
      ) : null}
    </WelcomeShell>
  );
}
