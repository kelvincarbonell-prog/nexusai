"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  Clock,
  Mic,
  LayoutDashboard,
  Mail,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Building2,
  Sparkles,
  Upload,
  PlayCircle,
  StopCircle,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { VoiceAssistant } from "@/components/voice/voice-assistant";

type Empresa = { id: string; nombre: string; nif?: string; inbox_alias?: string };
type Trabajador = { id: string; nombre: string; activo: boolean };
type View = "home" | "fichar" | "factura" | "voz";

export function MobileHome({ empresas }: { empresas: Empresa[] }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const empresa = empresas.find((e) => e.id === empresaId);
  const [view, setView] = useState<View>("home");
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [trabajadorId, setTrabajadorId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  useEffect(() => {
    if (!empresaId) return;
    (async () => {
      const tk = await token();
      const res = await fetch(`/api/laboral/trabajadores?empresa_id=${empresaId}`, { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (json.ok) {
        const active = (json.items ?? []).filter((t: Trabajador) => t.activo);
        setTrabajadores(active);
        if (active.length === 1) setTrabajadorId(active[0].id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function fichar(accion: "entrada" | "salida") {
    if (!trabajadorId) {
      setError("Selecciona el trabajador primero.");
      return;
    }
    setBusy(true); setError(null); setMsg(null);
    try {
      const tk = await token();
      const res = await fetch("/api/laboral/horario", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId, trabajador_id: trabajadorId, accion, fuente: "movil" }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setMsg(`Fichaje de ${accion} a las ${new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setBusy(false); }
  }

  async function subirFactura() {
    if (!file) { setError("Elige una foto o un PDF."); return; }
    setBusy(true); setError(null); setMsg(null);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result ?? "").split(",")[1] ?? "");
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });
      const tk = await token();
      const res = await fetch("/api/agents/extract-invoice", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresaId,
          source: "mobile",
          filename: file.name,
          mime_type: file.type || "image/jpeg",
          base64,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      const d = json.item?.datos_extraidos ?? {};
      const conf = Math.round(json.confidence ?? 0);
      setMsg(`${d.vendor_name ?? "Proveedor"} · ${d.total ?? "?"} € · ${conf}% confianza`);
      setFile(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setBusy(false); }
  }

  if (empresas.length === 0) {
    return (
      <div style={shell}>
        <Card>
          <strong style={{ fontSize: 17 }}>Sin empresas</strong>
          <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.7 }}>
            Entra desde la versión web para configurar tu gestoría.
          </p>
        </Card>
      </div>
    );
  }

  const inicial = (empresa?.nombre ?? "M").slice(0, 1).toUpperCase();
  const horaSaludo = () => {
    const h = new Date().getHours();
    if (h < 6) return "Buenas noches";
    if (h < 13) return "Buenos días";
    if (h < 20) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <div style={shell}>
      <header style={topbar}>
        <div style={brand}>M26</div>
        <select
          aria-label="Empresa activa"
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          style={selectEmpresa}
        >
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </header>

      {view === "home" && (
        <main style={mainGrid}>
          <section style={{ display: "grid", gap: 4, padding: "0 4px 4px" }}>
            <span style={{ fontSize: 12, opacity: 0.6, textTransform: "uppercase", letterSpacing: 0.6 }}>
              {horaSaludo()}
            </span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>
              ¿Qué necesitas?
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, opacity: 0.7 }}>
              Acciones rápidas optimizadas para el día a día desde el móvil.
            </p>
          </section>

          {/* CTA principal — sube facturas, la acción más frecuente */}
          <button onClick={() => setView("factura")} style={primaryCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={iconCircle("primary")}><Camera size={20} /></div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <strong style={{ fontSize: 16, color: "#fff" }}>Subir factura o ticket</strong>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
                  Foto → IA extrae proveedor, importe e IVA al instante.
                </p>
              </div>
              <ArrowRight size={18} color="rgba(255,255,255,0.85)" />
            </div>
          </button>

          {/* Acciones secundarias */}
          <div style={tileGrid}>
            <Tile
              onClick={() => setView("fichar")}
              icon={<Clock size={18} />}
              label="Fichar"
              hint="Entrada / salida"
            />
            <Tile
              onClick={() => setView("voz")}
              icon={<Mic size={18} />}
              label="Asistente voz"
              hint="«IVA del trimestre»"
            />
            <Tile
              href="/dashboard"
              icon={<LayoutDashboard size={18} />}
              label="Panel completo"
              hint="Versión escritorio"
            />
            {empresa?.inbox_alias && (
              <Tile
                icon={<Mail size={18} />}
                label="Buzón email"
                hint={`${empresa.inbox_alias}@inbox.m26.app`}
                disabled
              />
            )}
          </div>

          <section style={{ padding: "8px 4px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.7, fontSize: 12 }}>
              <Sparkles size={12} />
              <span>Acceso rápido a lo que más se usa fuera de oficina.</span>
            </div>
          </section>
        </main>
      )}

      {view === "factura" && (
        <main style={section}>
          <BackButton onClick={() => { setView("home"); setMsg(null); setError(null); }} />
          <Header icon={<Camera size={18} />} title="Subir factura o ticket" sub="Hazle una foto o sube un PDF y la IA hace el resto." />
          <Card>
            <label style={{ display: "grid", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Foto o archivo</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={fileInput}
              />
              {file && (
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  Seleccionado: <strong>{file.name}</strong>
                </span>
              )}
            </label>
            <button onClick={subirFactura} disabled={!file || busy} style={primaryBtn}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {busy ? "Procesando…" : "Extraer datos"}
            </button>
          </Card>
          {msg && <Notice tone="ok" icon={<CheckCircle2 size={14} />}>{msg}</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
        </main>
      )}

      {view === "fichar" && (
        <main style={section}>
          <BackButton onClick={() => { setView("home"); setMsg(null); setError(null); }} />
          <Header icon={<Clock size={18} />} title="Fichaje" sub="Selecciona trabajador y registra entrada o salida." />
          <Card>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>Trabajador</span>
              <select value={trabajadorId} onChange={(e) => setTrabajadorId(e.target.value)} style={selectInput}>
                <option value="">— Selecciona —</option>
                {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
              </select>
            </label>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
              <button onClick={() => fichar("entrada")} disabled={busy || !trabajadorId} style={successBtn}>
                <PlayCircle size={16} />
                Entrada
              </button>
              <button onClick={() => fichar("salida")} disabled={busy || !trabajadorId} style={dangerBtn}>
                <StopCircle size={16} />
                Salida
              </button>
            </div>
          </Card>
          {msg && <Notice tone="ok" icon={<CheckCircle2 size={14} />}>{msg}</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
        </main>
      )}

      {view === "voz" && (
        <main style={section}>
          <BackButton onClick={() => setView("home")} />
          <Header icon={<Mic size={18} />} title="Asistente de voz" sub="Pregunta lo que necesites sobre tu fiscalidad." />
          <VoiceAssistant empresaId={empresaId} />
        </main>
      )}
    </div>
  );
}

// ===================== UI helpers =====================

function Tile({
  icon, label, hint, onClick, href, disabled,
}: {
  icon: React.ReactNode; label: string; hint?: string;
  onClick?: () => void; href?: string; disabled?: boolean;
}) {
  const body = (
    <>
      <div style={iconCircle("muted")}>{icon}</div>
      <strong style={{ fontSize: 14 }}>{label}</strong>
      {hint && <span style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.4 }}>{hint}</span>}
    </>
  );
  const baseStyle: React.CSSProperties = {
    display: "grid", gap: 8, padding: 14, borderRadius: 14,
    background: "var(--card, color-mix(in srgb, currentColor 4%, transparent))",
    border: "1px solid color-mix(in srgb, currentColor 12%, transparent)",
    textDecoration: "none", color: "inherit", textAlign: "left",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.7 : 1,
  };
  if (href) {
    return <a href={href} style={baseStyle}>{body}</a>;
  }
  return (
    <button onClick={onClick} disabled={disabled} style={baseStyle}>
      {body}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={backBtn}>
      <ArrowLeft size={14} /> Volver
    </button>
  );
}

function Header({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={iconCircle("primary-soft")}>{icon}</span>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h2>
      </div>
      <p style={{ margin: 0, fontSize: 13, opacity: 0.7, lineHeight: 1.45 }}>{sub}</p>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: 14, borderRadius: 14,
      background: "color-mix(in srgb, currentColor 5%, transparent)",
      border: "1px solid color-mix(in srgb, currentColor 14%, transparent)",
      display: "grid", gap: 10,
    }}>
      {children}
    </div>
  );
}

function Notice({ tone, icon, children }: { tone: "ok" | "error"; icon?: React.ReactNode; children: React.ReactNode }) {
  const bg = tone === "ok" ? "#10b98115" : "#ef444415";
  const border = tone === "ok" ? "#10b98155" : "#ef444455";
  const fg = tone === "ok" ? "#10b981" : "#ef4444";
  return (
    <div style={{ padding: 12, borderRadius: 10, background: bg, border: `1px solid ${border}`, color: fg, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
      {icon}<span>{children}</span>
    </div>
  );
}

function iconCircle(variant: "primary" | "primary-soft" | "muted"): React.CSSProperties {
  if (variant === "primary") return {
    display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: 12,
    background: "rgba(255,255,255,0.18)", color: "#fff", flexShrink: 0,
  };
  if (variant === "primary-soft") return {
    display: "grid", placeItems: "center", width: 32, height: 32, borderRadius: 10,
    background: "color-mix(in srgb, var(--accent, #6366f1) 18%, transparent)",
    color: "var(--accent, #6366f1)", flexShrink: 0,
  };
  return {
    display: "grid", placeItems: "center", width: 36, height: 36, borderRadius: 10,
    background: "color-mix(in srgb, currentColor 9%, transparent)",
    color: "inherit", flexShrink: 0,
  };
}

// ===================== styles =====================

const shell: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--bg)",
  color: "var(--ink, #111)",
  paddingBottom: 80,
};
const topbar: React.CSSProperties = {
  position: "sticky", top: 0, zIndex: 10,
  display: "flex", alignItems: "center", gap: 10,
  padding: "12px 14px",
  borderBottom: "1px solid color-mix(in srgb, currentColor 10%, transparent)",
  background: "color-mix(in srgb, var(--bg) 90%, transparent)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
};
const brand: React.CSSProperties = {
  width: 34, height: 34, borderRadius: 10,
  display: "grid", placeItems: "center",
  background: "var(--accent, #6366f1)", color: "#fff",
  fontSize: 13, fontWeight: 800, letterSpacing: 0.5,
};
const selectEmpresa: React.CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid color-mix(in srgb, currentColor 16%, transparent)",
  background: "color-mix(in srgb, currentColor 6%, transparent)",
  color: "inherit", fontSize: 14, fontWeight: 600,
};
const mainGrid: React.CSSProperties = { padding: 14, display: "grid", gap: 12 };
const section: React.CSSProperties = { padding: 14, display: "grid", gap: 14 };
const tileGrid: React.CSSProperties = {
  display: "grid", gap: 10,
  gridTemplateColumns: "1fr 1fr",
};
const primaryCard: React.CSSProperties = {
  padding: 16, borderRadius: 16, border: "none",
  background: "linear-gradient(135deg, var(--accent, #6366f1), color-mix(in srgb, var(--accent, #6366f1) 70%, #000))",
  color: "#fff", textAlign: "left", cursor: "pointer",
  boxShadow: "0 8px 24px -10px color-mix(in srgb, var(--accent, #6366f1) 50%, transparent)",
};
const primaryBtn: React.CSSProperties = {
  padding: "12px 16px", borderRadius: 10, border: "none",
  background: "var(--accent, #6366f1)", color: "#fff",
  fontWeight: 600, fontSize: 14, cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center",
};
const successBtn: React.CSSProperties = {
  padding: "14px", borderRadius: 12, border: "none",
  background: "#10b981", color: "#fff", fontWeight: 700, fontSize: 14,
  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center",
};
const dangerBtn: React.CSSProperties = {
  padding: "14px", borderRadius: 12, border: "none",
  background: "#ef4444", color: "#fff", fontWeight: 700, fontSize: 14,
  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center",
};
const backBtn: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 10,
  border: "1px solid color-mix(in srgb, currentColor 16%, transparent)",
  background: "transparent", color: "inherit",
  fontSize: 13, cursor: "pointer", justifySelf: "start",
  display: "inline-flex", alignItems: "center", gap: 6,
};
const fileInput: React.CSSProperties = {
  padding: 10, borderRadius: 10, border: "1px dashed color-mix(in srgb, currentColor 20%, transparent)",
  background: "color-mix(in srgb, currentColor 4%, transparent)",
  fontSize: 13,
};
const selectInput: React.CSSProperties = {
  padding: "10px 12px", borderRadius: 10,
  border: "1px solid color-mix(in srgb, currentColor 16%, transparent)",
  background: "color-mix(in srgb, currentColor 4%, transparent)",
  color: "inherit", fontSize: 14,
};
