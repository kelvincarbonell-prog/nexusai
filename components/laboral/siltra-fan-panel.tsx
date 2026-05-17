"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileCheck2, AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Resp = {
  ok: boolean;
  errores?: string[];
  empresa?: { nif: string; razon_social: string; ccc: string };
  periodo?: string;
  n_trabajadores?: number;
  totales?: {
    base_cc: number;
    ss_empresa: number;
    ss_trabajador: number;
    irpf: number;
  };
};

const EUR = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function SiltraFanPanel({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const today = new Date();
  const defaultPeriodo = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const [periodo, setPeriodo] = useState(defaultPeriodo);
  const [preview, setPreview] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPreview() {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/laboral/siltra/fan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ empresa_id: empresaId, periodo, tipo: "FAN_COTIZ", formato: "json" }),
      });
      const j = await res.json();
      setPreview(j as Resp);
      if (!j.ok && j.error && (!j.errores || j.errores.length === 0)) {
        setError(j.error);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function descargar() {
    setDownloading(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/laboral/siltra/fan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ empresa_id: empresaId, periodo, tipo: "FAN_COTIZ", formato: "txt" }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "No se pudo generar el fichero");
        if (j.errores) setPreview({ ok: false, errores: j.errores });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `FAN_${periodo.replace("-", "")}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, periodo]);

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <ShieldCheck size={18} />
        <h3 style={{ margin: 0 }}>SILTRA · Fichero FAN cotización mensual</h3>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value || defaultPeriodo)}
            style={input}
          />
          <button
            type="button"
            onClick={descargar}
            disabled={downloading || loading || !preview?.ok}
            className="button"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {downloading ? "Generando…" : "Descargar FAN"}
          </button>
        </div>
      </header>

      <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
        Fichero posicional que se sube a Sistema RED (SILTRA) para la cotización mensual a TGSS.
        Genera el archivo a partir de las nóminas guardadas del periodo.
      </p>

      {loading && (
        <div style={{ fontSize: 13, opacity: 0.7, display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={14} className="animate-spin" />
          Validando datos…
        </div>
      )}

      {error && (
        <div style={{ padding: 10, borderRadius: 8, background: "#ef444412", border: "1px solid #ef444455", color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {preview && !loading && (
        <>
          {preview.errores && preview.errores.length > 0 && (
            <div style={{ padding: 12, borderRadius: 10, background: "#f59e0b12", border: "1px solid #f59e0b55", display: "grid", gap: 6 }}>
              <strong style={{ display: "flex", alignItems: "center", gap: 6, color: "#f59e0b" }}>
                <AlertTriangle size={14} /> Faltan datos para generar el FAN
              </strong>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, opacity: 0.85, display: "grid", gap: 2 }}>
                {preview.errores.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {preview.totales && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
              <Mini titulo="Trabajadores" valor={String(preview.n_trabajadores ?? 0)} />
              <Mini titulo="Base CC total" valor={EUR(preview.totales.base_cc)} />
              <Mini titulo="SS empresa" valor={EUR(preview.totales.ss_empresa)} tono="warn" />
              <Mini titulo="SS trabajador" valor={EUR(preview.totales.ss_trabajador)} />
              <Mini titulo="IRPF retenido (M111)" valor={EUR(preview.totales.irpf)} />
            </div>
          )}

          {preview.ok && (
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: "#10b98112",
                border: "1px solid #10b98155",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
              }}
            >
              <FileCheck2 size={14} color="#10b981" />
              Listo para subir a Sistema RED. Pulsa "Descargar FAN" y súbelo desde SILTRA.
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Mini({ titulo, valor, tono }: { titulo: string; valor: string; tono?: "warn" }) {
  const border = tono === "warn" ? "#f59e0b55" : "var(--border, #e5e7eb)";
  const bg = tono === "warn" ? "#f59e0b08" : "var(--card, #fff)";
  return (
    <div style={{ padding: 12, borderRadius: 10, border: `1px solid ${border}`, background: bg, display: "grid", gap: 2 }}>
      <span style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.4 }}>{titulo}</span>
      <strong style={{ fontSize: 17 }}>{valor}</strong>
    </div>
  );
}

const input: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid var(--border, #e5e7eb)",
  background: "var(--card, #fff)",
  fontSize: 13,
};
