"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { VoiceAssistant } from "@/components/voice/voice-assistant";

type Empresa = { id: string; nombre: string; nif?: string; inbox_alias?: string };
type Trabajador = { id: string; nombre: string; activo: boolean };

export function MobileHome({ empresas }: { empresas: Empresa[] }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const empresa = empresas.find((e) => e.id === empresaId);
  const [view, setView] = useState<"home" | "fichar" | "factura" | "voz">("home");
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [trabajadorId, setTrabajadorId] = useState<string>("");
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
      setError("Selecciona trabajador.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const tk = await token();
      const res = await fetch("/api/laboral/horario", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId, trabajador_id: trabajadorId, accion, fuente: "movil" }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setMsg(`Fichaje de ${accion} registrado: ${new Date().toLocaleTimeString("es-ES")}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function subirFactura() {
    if (!file) {
      setError("Selecciona o haz una foto.");
      return;
    }
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
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
      setMsg(
        `Extraída con ${json.confidence?.toFixed(0)}% de confianza. ${d.vendor_name ?? "Proveedor"} · Total ${d.total ?? "?"} €`,
      );
      setFile(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  if (empresas.length === 0) {
    return (
      <div className="mobile-shell">
        <h1>Modelo 26</h1>
        <p>No tienes empresas. Entra desde escritorio para configurar tu gestoría.</p>
      </div>
    );
  }

  return (
    <div className="mobile-shell">
      <header className="mobile-topbar">
        <div className="brand-mark" style={{ width: 32, height: 32 }}>NX</div>
        <select className="input mobile-empresa" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </header>

      {view === "home" ? (
        <main className="mobile-grid">
          <button className="mobile-tile" onClick={() => setView("voz")}>
            <span className="mobile-tile-icon" aria-hidden="true">🎙️</span>
            <strong>Asistente de voz</strong>
            <small>«¿Cuánto IVA llevo este trimestre?»</small>
          </button>
          <button className="mobile-tile" onClick={() => setView("factura")}>
            <span className="mobile-tile-icon" aria-hidden="true">📸</span>
            <strong>Subir factura</strong>
            <small>Foto → datos extraídos al instante</small>
          </button>
          <button className="mobile-tile" onClick={() => setView("fichar")}>
            <span className="mobile-tile-icon" aria-hidden="true">🕒</span>
            <strong>Fichar</strong>
            <small>Entrada / salida en un toque</small>
          </button>
          <a className="mobile-tile" href="/dashboard">
            <span className="mobile-tile-icon" aria-hidden="true">📊</span>
            <strong>Dashboard completo</strong>
            <small>Versión escritorio</small>
          </a>
          {empresa?.inbox_alias ? (
            <div className="mobile-tile" style={{ background: "#eef7d0", color: "#101820", cursor: "default" }}>
              <span className="mobile-tile-icon" aria-hidden="true">📬</span>
              <strong>Buzón email</strong>
              <small>{empresa.inbox_alias}@inbox.m26.app</small>
            </div>
          ) : null}
        </main>
      ) : null}

      {view === "voz" ? (
        <main style={{ padding: 16 }}>
          <button className="button secondary compact" onClick={() => setView("home")}>← Volver</button>
          <div style={{ marginTop: 12 }}>
            <VoiceAssistant empresaId={empresaId} />
          </div>
        </main>
      ) : null}

      {view === "factura" ? (
        <main style={{ padding: 16, display: "grid", gap: 12 }}>
          <button className="button secondary compact" onClick={() => setView("home")}>← Volver</button>
          <h2 className="title" style={{ fontSize: 22 }}>Sube o fotografía la factura</h2>
          <input
            className="input"
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button className="button" onClick={subirFactura} disabled={!file || busy}>
            {busy ? "Procesando…" : "Extraer datos"}
          </button>
          {msg ? <p role="status" style={{ color: "var(--brand)" }}>{msg}</p> : null}
          {error ? <p role="alert" style={{ color: "var(--danger)" }}>{error}</p> : null}
        </main>
      ) : null}

      {view === "fichar" ? (
        <main style={{ padding: 16, display: "grid", gap: 12 }}>
          <button className="button secondary compact" onClick={() => setView("home")}>← Volver</button>
          <h2 className="title" style={{ fontSize: 22 }}>Fichaje</h2>
          <select className="input" value={trabajadorId} onChange={(e) => setTrabajadorId(e.target.value)}>
            <option value="">Selecciona trabajador…</option>
            {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <button className="button" onClick={() => fichar("entrada")} disabled={busy || !trabajadorId}>Entrada</button>
            <button className="button danger" onClick={() => fichar("salida")} disabled={busy || !trabajadorId}>Salida</button>
          </div>
          {msg ? <p role="status" style={{ color: "var(--brand)" }}>{msg}</p> : null}
          {error ? <p role="alert" style={{ color: "var(--danger)" }}>{error}</p> : null}
        </main>
      ) : null}
    </div>
  );
}
