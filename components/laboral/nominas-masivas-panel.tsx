"use client";

import { useMemo, useState } from "react";
import { Users, CheckCircle2, AlertTriangle, Loader2, Zap, FileText } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Resultado = {
  trabajador_id: string;
  nombre: string | null;
  status: "creada" | "sobrescrita" | "saltada" | "error";
  error?: string;
  liquido?: number;
  bruto?: number;
  ss_empresa?: number;
};

type Resp = {
  ok: boolean;
  periodo: string;
  total_trabajadores: number;
  resumen: { creadas: number; sobrescritas: number; saltadas: number; errores: number };
  totales: { bruto: number; liquido: number; ss_empresa: number; irpf_retenido: number; coste_total_empresa: number };
  resultados: Resultado[];
};

const EUR = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function NominasMasivasPanel({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const today = new Date();
  const defaultPeriodo = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
  const [periodo, setPeriodo] = useState(defaultPeriodo);
  const [sobreescribir, setSobreescribir] = useState(false);
  const [result, setResult] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generar() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/laboral/nominas/generar-mes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ empresa_id: empresaId, periodo, sobreescribir }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "No se pudo generar");
      setResult(j as Resp);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Users size={18} />
        <h3 style={{ margin: 0 }}>Generación masiva de nóminas</h3>
      </header>
      <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
        Genera las nóminas de todos los trabajadores activos en un clic. Las nóminas existentes
        se saltan por defecto (puedes sobreescribirlas).
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
        <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
          <span style={{ opacity: 0.8 }}>Periodo</span>
          <input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value || defaultPeriodo)}
            style={input}
          />
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={sobreescribir}
            onChange={(e) => setSobreescribir(e.target.checked)}
          />
          Sobreescribir las ya generadas
        </label>
        <button
          type="button"
          onClick={generar}
          disabled={loading}
          style={{
            marginLeft: "auto",
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            background: "var(--accent, #6366f1)",
            color: "#fff",
            cursor: loading ? "wait" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontWeight: 600,
          }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
          {loading ? "Generando…" : "Generar nóminas del mes"}
        </button>
      </div>

      {error && (
        <div style={{ padding: 10, borderRadius: 8, background: "#ef444412", border: "1px solid #ef444455", color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {result && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
            <Mini titulo="Creadas" valor={String(result.resumen.creadas)} tono="ok" />
            <Mini titulo="Sobrescritas" valor={String(result.resumen.sobrescritas)} />
            <Mini titulo="Saltadas" valor={String(result.resumen.saltadas)} />
            <Mini titulo="Errores" valor={String(result.resumen.errores)} tono={result.resumen.errores > 0 ? "error" : undefined} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <Mini titulo="Total bruto" valor={EUR(result.totales.bruto)} />
            <Mini titulo="Total líquido" valor={EUR(result.totales.liquido)} />
            <Mini titulo="SS empresa" valor={EUR(result.totales.ss_empresa)} />
            <Mini titulo="IRPF retenido (M111)" valor={EUR(result.totales.irpf_retenido)} />
            <Mini titulo="Coste total empresa" valor={EUR(result.totales.coste_total_empresa)} tono="ok" />
          </div>

          <div style={{ overflow: "auto", border: "1px solid var(--border, #e5e7eb)", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--card-bg, #f9fafb)", textAlign: "left" }}>
                  <th style={th}>Estado</th>
                  <th style={th}>Trabajador</th>
                  <th style={thNum}>Bruto</th>
                  <th style={thNum}>Líquido</th>
                  <th style={thNum}>SS empresa</th>
                  <th style={th}>Detalles</th>
                </tr>
              </thead>
              <tbody>
                {result.resultados.map((r) => (
                  <tr key={r.trabajador_id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                    <td style={td}><StatusBadge status={r.status} /></td>
                    <td style={td}>{r.nombre ?? "—"}</td>
                    <td style={tdNum}>{r.bruto ? EUR(r.bruto) : "—"}</td>
                    <td style={tdNum}>{r.liquido ? EUR(r.liquido) : "—"}</td>
                    <td style={tdNum}>{r.ss_empresa ? EUR(r.ss_empresa) : "—"}</td>
                    <td style={{ ...td, color: r.error ? "#ef4444" : undefined, fontSize: 12 }}>
                      {r.error ?? (r.status === "creada" || r.status === "sobrescrita" ? "OK" : "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, opacity: 0.7 }}>
            <FileText size={12} />
            Las nóminas generadas alimentan el modelo 111 del trimestre y los seguros sociales (TC1/TC2) automáticamente.
          </div>
        </>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: Resultado["status"] }) {
  const map: Record<Resultado["status"], { label: string; color: string; bg: string; Icon: React.ComponentType<{ size?: number }> }> = {
    creada: { label: "Creada", color: "#10b981", bg: "#10b98112", Icon: CheckCircle2 },
    sobrescrita: { label: "Sobrescrita", color: "#3b82f6", bg: "#3b82f612", Icon: CheckCircle2 },
    saltada: { label: "Saltada", color: "#6b7280", bg: "#6b728012", Icon: CheckCircle2 },
    error: { label: "Error", color: "#ef4444", bg: "#ef444412", Icon: AlertTriangle },
  };
  const { label, color, bg, Icon } = map[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: bg, color, fontSize: 11, fontWeight: 600 }}>
      <Icon size={11} />
      {label}
    </span>
  );
}

function Mini({ titulo, valor, tono }: { titulo: string; valor: string; tono?: "ok" | "error" }) {
  const border = tono === "ok" ? "#10b98155" : tono === "error" ? "#ef444455" : "var(--border, #e5e7eb)";
  const bg = tono === "ok" ? "#10b98108" : tono === "error" ? "#ef444408" : "var(--card, #fff)";
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
const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4, opacity: 0.7 };
const thNum: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "10px 12px" };
const tdNum: React.CSSProperties = { ...td, textAlign: "right", fontFamily: "var(--mono, monospace)" };
