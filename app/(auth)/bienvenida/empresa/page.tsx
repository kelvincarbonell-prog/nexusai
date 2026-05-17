"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, ArrowRight, ArrowLeft, Rocket, ScanLine } from "lucide-react";
import { WelcomeShell, WelcomeButton, WelcomeSuccess } from "@/components/welcome/welcome-shell";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const STEPS = [
  { key: "bienvenida", label: "Bienvenida" },
  { key: "datos", label: "Datos empresa" },
  { key: "fiscal", label: "Fiscal" },
  { key: "fin", label: "Listo" },
];

const CCAA = [
  { v: "", l: "—" }, { v: "madrid", l: "Madrid" }, { v: "cataluna", l: "Cataluña" }, { v: "valencia", l: "Valencia" },
  { v: "andalucia", l: "Andalucía" }, { v: "pais_vasco", l: "País Vasco" }, { v: "galicia", l: "Galicia" },
  { v: "aragon", l: "Aragón" }, { v: "canarias", l: "Canarias" }, { v: "castilla_leon", l: "Castilla y León" },
  { v: "castilla_la_mancha", l: "Castilla-La Mancha" }, { v: "murcia", l: "Murcia" }, { v: "navarra", l: "Navarra" },
  { v: "asturias", l: "Asturias" }, { v: "cantabria", l: "Cantabria" }, { v: "baleares", l: "Baleares" },
  { v: "extremadura", l: "Extremadura" }, { v: "rioja", l: "La Rioja" },
];

export default function BienvenidaEmpresa() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [datos, setDatos] = useState({
    nombre: "",
    nif: "",
    forma_juridica: "SL",
    actividad: "",
    cnae: "",
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
    regimen_iva: "general",
    epigrafe_iae: "",
  });

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.push("/login"); return; }
      // Carga empresa si ya existe (creada en signup)
      const { data: empresa } = await supabase
        .from("empresas")
        .select("id,nombre,nif,metadata")
        .eq("owner_user_id", auth.user.id)
        .maybeSingle();
      if (empresa) {
        setEmpresaId(empresa.id);
        setDatos((d) => ({ ...d, nombre: empresa.nombre ?? "", nif: empresa.nif ?? "" }));
        const meta = (empresa.metadata ?? {}) as Record<string, string>;
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
          epigrafe_iae: meta.epigrafe_iae ?? f.epigrafe_iae,
        }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardarEmpresa(): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      if (!empresaId) {
        // Crear empresa
        const res = await fetch("/api/clientes", {
          method: "POST",
          headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: datos.nombre,
            nif: datos.nif,
            account_type: "empresa",
            cliente_email: fiscal.email_facturacion || undefined,
            cliente_telefono: fiscal.telefono || undefined,
            cliente_direccion: fiscal.direccion || undefined,
          }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "Error");
        setEmpresaId(json.empresa.id);
        return true;
      }
      // Actualizar
      const res = await fetch(`/api/empresas/${empresaId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: datos.nombre,
          nif: datos.nif,
          metadata_patch: {
            forma_juridica: datos.forma_juridica,
            actividad: datos.actividad,
            cnae: datos.cnae,
            cliente_direccion: fiscal.direccion,
            codigo_postal: fiscal.codigo_postal,
            localidad: fiscal.localidad,
            provincia: fiscal.provincia,
            ccaa: fiscal.ccaa,
            cliente_telefono: fiscal.telefono,
            cliente_email: fiscal.email_facturacion,
            iban: fiscal.iban,
            regimen_iva: fiscal.regimen_iva,
            epigrafe_iae: fiscal.epigrafe_iae,
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
        setError("Razón social y NIF/CIF son obligatorios.");
        return;
      }
      const ok = await guardarEmpresa();
      if (!ok) return;
    }
    if (step === 2) {
      const ok = await guardarEmpresa();
      if (!ok) return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  return (
    <WelcomeShell
      eyebrow="Bienvenida empresa"
      title={<>Tu empresa en <span className="brand-text">Modelo 26</span></>}
      subtitle="Configura tus datos fiscales y comerciales en 3 pasos."
      steps={STEPS}
      currentStep={step}
      accent="var(--accent)"
    >
      {step === 0 ? (
        <div style={{ textAlign: "center", display: "grid", gap: 16 }}>
          <WelcomeSuccess
            title="Cuenta activa"
            subtitle="Vamos a registrar los datos de tu empresa para que puedas emitir facturas, llevar contabilidad y presentar modelos AEAT desde hoy."
            icon={<Building2 size={36} strokeWidth={1.8} color="white" />}
          />
          <ul style={{ listStyle: "none", padding: 0, margin: "12px auto", display: "grid", gap: 8, maxWidth: 380, textAlign: "left", fontSize: 13 }}>
            <li style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Building2 size={14} color="var(--accent)" /> Datos generales de la empresa
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <FileText size={14} color="var(--accent)" /> Datos fiscales (NIF, dirección, IBAN)
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ScanLine size={14} color="var(--accent)" /> Sube tu primera factura con OCR
            </li>
          </ul>
          <WelcomeButton onClick={siguiente}>Empezar <ArrowRight size={15} /></WelcomeButton>
        </div>
      ) : null}

      {step === 1 ? (
        <div style={{ display: "grid", gap: 16 }}>
          <header>
            <span className="card-eyebrow">Paso 1 de 3</span>
            <h2 style={{ fontSize: 20, margin: "4px 0 0" }}>Datos generales</h2>
          </header>
          <div className="form two-cols">
            <label className="label">
              Razón social <span style={{ color: "var(--bad)" }}>*</span>
              <input className="input" autoFocus value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} placeholder="Innova Apps S.L." />
            </label>
            <label className="label">
              NIF / CIF <span style={{ color: "var(--bad)" }}>*</span>
              <input className="input" value={datos.nif} onChange={(e) => setDatos({ ...datos, nif: e.target.value.toUpperCase() })} style={{ fontFamily: "var(--mono)" }} placeholder="B12345678" />
            </label>
            <label className="label">
              Forma jurídica
              <select className="input" value={datos.forma_juridica} onChange={(e) => setDatos({ ...datos, forma_juridica: e.target.value })}>
                <option value="SL">Sociedad Limitada (SL)</option>
                <option value="SA">Sociedad Anónima (SA)</option>
                <option value="SLU">SL Unipersonal (SLU)</option>
                <option value="SC">Sociedad Civil</option>
                <option value="CB">Comunidad de Bienes</option>
                <option value="COOP">Cooperativa</option>
                <option value="OTRA">Otra</option>
              </select>
            </label>
            <label className="label">
              CNAE
              <input className="input" value={datos.cnae} onChange={(e) => setDatos({ ...datos, cnae: e.target.value })} placeholder="6201 · Programación informática" />
            </label>
            <label className="label span-form">
              Actividad principal
              <input className="input" value={datos.actividad} onChange={(e) => setDatos({ ...datos, actividad: e.target.value })} placeholder="Desarrollo de software a medida" />
            </label>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div style={{ display: "grid", gap: 16 }}>
          <header>
            <span className="card-eyebrow">Paso 2 de 3</span>
            <h2 style={{ fontSize: 20, margin: "4px 0 0" }}>Datos fiscales y bancarios</h2>
          </header>
          <div className="form two-cols">
            <label className="label span-form">
              Dirección fiscal
              <input className="input" value={fiscal.direccion} onChange={(e) => setFiscal({ ...fiscal, direccion: e.target.value })} placeholder="Calle Gran Vía 28, 5º C" />
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
            <label className="label">
              Comunidad autónoma
              <select className="input" value={fiscal.ccaa} onChange={(e) => setFiscal({ ...fiscal, ccaa: e.target.value })}>
                {CCAA.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </label>
            <label className="label">
              Régimen IVA
              <select className="input" value={fiscal.regimen_iva} onChange={(e) => setFiscal({ ...fiscal, regimen_iva: e.target.value })}>
                <option value="general">Régimen general</option>
                <option value="simplificado">Régimen simplificado</option>
                <option value="recargo_equivalencia">Recargo de equivalencia</option>
                <option value="caja">Régimen especial caja</option>
              </select>
            </label>
            <label className="label">
              Teléfono
              <input className="input" value={fiscal.telefono} onChange={(e) => setFiscal({ ...fiscal, telefono: e.target.value })} placeholder="+34 900 000 000" />
            </label>
            <label className="label">
              Email facturación
              <input type="email" className="input" value={fiscal.email_facturacion} onChange={(e) => setFiscal({ ...fiscal, email_facturacion: e.target.value })} placeholder="facturas@empresa.com" />
            </label>
            <label className="label">
              Epígrafe IAE
              <input className="input" value={fiscal.epigrafe_iae} onChange={(e) => setFiscal({ ...fiscal, epigrafe_iae: e.target.value })} placeholder="843" />
            </label>
            <label className="label">
              IBAN
              <input className="input" value={fiscal.iban} onChange={(e) => setFiscal({ ...fiscal, iban: e.target.value.toUpperCase().replace(/\s/g, "") })} style={{ fontFamily: "var(--mono)" }} placeholder="ES00 0000 0000 0000 0000 0000" />
            </label>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div style={{ textAlign: "center", display: "grid", gap: 16 }}>
          <WelcomeSuccess
            title="¡Empresa configurada!"
            subtitle={`${datos.nombre} ya puede operar en Modelo 26.`}
            icon={<Rocket size={36} strokeWidth={1.8} color="white" />}
          />
          <ul style={{ listStyle: "none", padding: 0, margin: "12px auto", display: "grid", gap: 6, maxWidth: 380, textAlign: "left", fontSize: 13 }}>
            <li>✓ Datos generales guardados</li>
            <li>✓ Datos fiscales y bancarios completos</li>
            <li>✓ Régimen IVA: {fiscal.regimen_iva}</li>
            <li>✓ Numeración de facturas inicializada</li>
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
