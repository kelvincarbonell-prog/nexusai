"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Users, FileText, Rocket, ArrowRight, ArrowLeft, UserPlus, Plus, Trash2 } from "lucide-react";
import { WelcomeShell, WelcomeButton, WelcomeSuccess } from "@/components/welcome/welcome-shell";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Asesor = { nombre: string; email: string; rol: "gestor" | "asesor" };

const STEPS = [
  { key: "bienvenida", label: "Bienvenida" },
  { key: "datos", label: "Tu gestoría" },
  { key: "fiscal", label: "Datos fiscales" },
  { key: "equipo", label: "Equipo" },
  { key: "fin", label: "Listo" },
];

export default function BienvenidaGestor() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [datos, setDatos] = useState({ nombre: "", apellidos: "", nombre_gestoria: "" });
  const [fiscal, setFiscal] = useState({
    nif_gestoria: "",
    direccion: "",
    codigo_postal: "",
    localidad: "",
    provincia: "",
    telefono: "",
  });
  const [equipo, setEquipo] = useState<Asesor[]>([]);
  const [draft, setDraft] = useState<Asesor>({ nombre: "", email: "", rol: "asesor" });

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("perfiles")
        .select("nombre,apellidos,nombre_gestoria,metadata")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (profile) {
        setDatos({
          nombre: profile.nombre ?? "",
          apellidos: profile.apellidos ?? "",
          nombre_gestoria: profile.nombre_gestoria ?? "",
        });
        const meta = (profile.metadata ?? {}) as Record<string, string>;
        setFiscal({
          nif_gestoria: meta.nif_gestoria ?? "",
          direccion: meta.direccion ?? "",
          codigo_postal: meta.codigo_postal ?? "",
          localidad: meta.localidad ?? "",
          provincia: meta.provincia ?? "",
          telefono: meta.telefono ?? "",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardarPerfil(): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: datos.nombre,
          apellidos: datos.apellidos,
          nombre_gestoria: datos.nombre_gestoria,
          metadata_patch: fiscal,
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

  async function invitarEquipo() {
    if (equipo.length === 0) return;
    const { data: sess } = await supabase.auth.getSession();
    const tk = sess.session?.access_token ?? "";
    for (const a of equipo) {
      try {
        await fetch("/api/asesores", {
          method: "POST",
          headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
          body: JSON.stringify(a),
        });
      } catch {
        // ignora errores individuales y sigue
      }
    }
  }

  async function siguiente() {
    setError(null);
    if (step === 1) {
      if (!datos.nombre.trim() || !datos.nombre_gestoria.trim()) {
        setError("Nombre y nombre de la gestoría son obligatorios.");
        return;
      }
      const ok = await guardarPerfil();
      if (!ok) return;
    }
    if (step === 2) {
      const ok = await guardarPerfil();
      if (!ok) return;
    }
    if (step === 3) {
      setBusy(true);
      await invitarEquipo();
      setBusy(false);
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function añadirAsesor() {
    if (!draft.email.trim() || !draft.nombre.trim()) return;
    setEquipo((e) => [...e, draft]);
    setDraft({ nombre: "", email: "", rol: "asesor" });
  }

  function eliminarAsesor(i: number) {
    setEquipo((e) => e.filter((_, idx) => idx !== i));
  }

  return (
    <WelcomeShell
      eyebrow="Bienvenida gestoría"
      title={<>Tu despacho en <span className="brand-text">Modelo 26</span></>}
      subtitle="Configura tu gestoría en 4 pasos. Tarda 3 minutos."
      steps={STEPS}
      currentStep={step}
    >
      {/* PASO 0: Bienvenida */}
      {step === 0 ? (
        <div style={{ textAlign: "center", display: "grid", gap: 16 }}>
          <WelcomeSuccess
            title="Tu cuenta está activa"
            subtitle="Vamos a configurar tu gestoría para que puedas empezar a trabajar con clientes hoy mismo."
            icon={<Briefcase size={36} strokeWidth={1.8} color="white" />}
          />
          <ul style={{ listStyle: "none", padding: 0, margin: "12px auto", display: "grid", gap: 8, maxWidth: 380, textAlign: "left" }}>
            <li style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <Briefcase size={14} color="var(--accent)" /> Datos de tu gestoría
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <FileText size={14} color="var(--accent)" /> Datos fiscales para facturas
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <Users size={14} color="var(--accent)" /> Invita a tu equipo
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
              <Rocket size={14} color="var(--accent)" /> Al panel del gestor
            </li>
          </ul>
          <WelcomeButton onClick={siguiente}>
            Empezar <ArrowRight size={15} />
          </WelcomeButton>
        </div>
      ) : null}

      {/* PASO 1: Datos personales + gestoría */}
      {step === 1 ? (
        <div style={{ display: "grid", gap: 16 }}>
          <header>
            <span className="card-eyebrow">Paso 1 de 4</span>
            <h2 style={{ fontSize: 20, margin: "4px 0 0" }}>Cómo te llamas y cómo se llama tu gestoría</h2>
          </header>
          <div className="form two-cols">
            <label className="label">
              Nombre <span style={{ color: "var(--bad)" }}>*</span>
              <input className="input" autoFocus value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} placeholder="Laura" />
            </label>
            <label className="label">
              Apellidos
              <input className="input" value={datos.apellidos} onChange={(e) => setDatos({ ...datos, apellidos: e.target.value })} placeholder="Sánchez Ruiz" />
            </label>
            <label className="label span-form">
              Nombre comercial de la gestoría <span style={{ color: "var(--bad)" }}>*</span>
              <input className="input" value={datos.nombre_gestoria} onChange={(e) => setDatos({ ...datos, nombre_gestoria: e.target.value })} placeholder="Gabinete Sánchez" />
              <small className="muted" style={{ fontSize: 11 }}>Aparece en las facturas que emites a clientes y en los modelos AEAT firmados.</small>
            </label>
          </div>
        </div>
      ) : null}

      {/* PASO 2: Datos fiscales */}
      {step === 2 ? (
        <div style={{ display: "grid", gap: 16 }}>
          <header>
            <span className="card-eyebrow">Paso 2 de 4</span>
            <h2 style={{ fontSize: 20, margin: "4px 0 0" }}>Datos fiscales de la gestoría</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Los necesitas para emitir tus facturas. Puedes editarlos después en Mi perfil.</p>
          </header>
          <div className="form two-cols">
            <label className="label">
              NIF / CIF
              <input className="input" value={fiscal.nif_gestoria} onChange={(e) => setFiscal({ ...fiscal, nif_gestoria: e.target.value.toUpperCase() })} style={{ fontFamily: "var(--mono)" }} placeholder="B12345678" />
            </label>
            <label className="label">
              Teléfono
              <input className="input" value={fiscal.telefono} onChange={(e) => setFiscal({ ...fiscal, telefono: e.target.value })} placeholder="+34 600 000 000" />
            </label>
            <label className="label span-form">
              Dirección
              <input className="input" value={fiscal.direccion} onChange={(e) => setFiscal({ ...fiscal, direccion: e.target.value })} placeholder="Calle Mayor 10, 3º A" />
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

      {/* PASO 3: Equipo */}
      {step === 3 ? (
        <div style={{ display: "grid", gap: 16 }}>
          <header>
            <span className="card-eyebrow">Paso 3 de 4 · opcional</span>
            <h2 style={{ fontSize: 20, margin: "4px 0 0" }}>Invita a tu equipo</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>Cada asesor recibirá un email para activar su cuenta. Puedes hacerlo más tarde desde la sección Equipo.</p>
          </header>

          <div className="form three-cols">
            <label className="label">
              Nombre
              <input className="input" value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} placeholder="Carlos Ruiz" />
            </label>
            <label className="label">
              Email
              <input type="email" className="input" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="carlos@gestoria.com" />
            </label>
            <label className="label">
              Rol
              <select className="input" value={draft.rol} onChange={(e) => setDraft({ ...draft, rol: e.target.value as "gestor" | "asesor" })}>
                <option value="asesor">Asesor</option>
                <option value="gestor">Gestor</option>
              </select>
            </label>
          </div>
          <button className="button secondary" onClick={añadirAsesor} disabled={!draft.email || !draft.nombre} style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "start" }}>
            <Plus size={14} /> Añadir a la lista
          </button>

          {equipo.length > 0 ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
              {equipo.map((a, i) => (
                <li key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <UserPlus size={14} color="var(--accent)" />
                    <strong style={{ fontSize: 13 }}>{a.nombre}</strong>
                    <small className="muted" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>{a.email}</small>
                    <span className="pill plain" style={{ fontSize: 10 }}>{a.rol}</span>
                  </span>
                  <button className="button ghost compact" onClick={() => eliminarAsesor(i)} style={{ color: "var(--bad)", padding: 4 }}>
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* PASO 4: Fin */}
      {step === 4 ? (
        <div style={{ textAlign: "center", display: "grid", gap: 16 }}>
          <WelcomeSuccess
            title="¡Todo listo!"
            subtitle={`Tu gestoría "${datos.nombre_gestoria}" está configurada. Vamos al panel.`}
            icon={<Rocket size={36} strokeWidth={1.8} color="white" />}
          />
          <ul style={{ listStyle: "none", padding: 0, margin: "12px auto", display: "grid", gap: 6, maxWidth: 380, textAlign: "left", fontSize: 13 }}>
            <li>✓ Perfil guardado</li>
            <li>✓ Datos fiscales configurados</li>
            {equipo.length > 0 ? <li>✓ {equipo.length} invitaciones enviadas al equipo</li> : null}
            <li>✓ Plan: starter (puedes mejorar después)</li>
          </ul>
          <WelcomeButton onClick={() => router.push("/dashboard")}>
            Ir al panel del gestor <ArrowRight size={15} />
          </WelcomeButton>
        </div>
      ) : null}

      {error ? <p role="alert" style={{ color: "var(--bad)", fontSize: 13, marginTop: 12 }}>{error}</p> : null}

      {/* Navegación */}
      {step > 0 && step < 4 ? (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 18 }}>
          <button className="button ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={busy} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ArrowLeft size={14} /> Atrás
          </button>
          <WelcomeButton onClick={siguiente} loading={busy}>
            {step === 3 && equipo.length === 0 ? "Saltar y terminar" : "Continuar"} <ArrowRight size={15} />
          </WelcomeButton>
        </div>
      ) : null}
    </WelcomeShell>
  );
}
