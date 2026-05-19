"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bot,
  AlertTriangle,
  AlertOctagon,
  Info,
  RefreshCw,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Alerta = {
  id: string;
  categoria: string;
  nivel: "info" | "warning" | "danger";
  titulo: string;
  descripcion: string;
  cta?: { label: string; href: string };
};

const NIVEL_BG: Record<Alerta["nivel"], string> = {
  danger: "#ef444412",
  warning: "#f59e0b12",
  info: "#3b82f612",
};
const NIVEL_BORDER: Record<Alerta["nivel"], string> = {
  danger: "#ef444466",
  warning: "#f59e0b66",
  info: "#3b82f666",
};
const NIVEL_COLOR: Record<Alerta["nivel"], string> = {
  danger: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
};

function NivelIcon({ nivel }: { nivel: Alerta["nivel"] }) {
  if (nivel === "danger") return <AlertOctagon size={16} color={NIVEL_COLOR.danger} />;
  if (nivel === "warning") return <AlertTriangle size={16} color={NIVEL_COLOR.warning} />;
  return <Info size={16} color={NIVEL_COLOR.info} />;
}

export function BotFiscalPanel({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [resumen, setResumen] = useState({ total: 0, danger: 0, warning: 0, info: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedAt, setScannedAt] = useState<string | null>(null);

  async function scan() {
    setLoading(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch(`/api/agents/bot-fiscal?empresa_id=${empresaId}`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Error");
      setAlertas(j.alertas ?? []);
      setResumen(j.resumen ?? { total: 0, danger: 0, warning: 0, info: 0 });
      setScannedAt(new Date().toLocaleTimeString("es-ES"));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Bot size={18} />
        <h3 style={{ margin: 0 }}>Bot fiscal proactivo</h3>
        <span style={{ fontSize: 11, opacity: 0.6 }}>
          {scannedAt ? `Última revisión: ${scannedAt}` : ""}
        </span>
        <button
          type="button"
          onClick={scan}
          disabled={loading}
          style={{
            marginLeft: "auto",
            padding: "6px 12px",
            borderRadius: 8,
            border: "1px solid var(--line, #e5e7eb)",
            background: "transparent",
            cursor: loading ? "wait" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
          }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : undefined} />
          {loading ? "Escaneando…" : "Re-escanear"}
        </button>
      </header>

      {resumen.total > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {resumen.danger > 0 && (
            <Badge color={NIVEL_COLOR.danger} bg={NIVEL_BG.danger}>
              {resumen.danger} urgentes
            </Badge>
          )}
          {resumen.warning > 0 && (
            <Badge color={NIVEL_COLOR.warning} bg={NIVEL_BG.warning}>
              {resumen.warning} avisos
            </Badge>
          )}
          {resumen.info > 0 && (
            <Badge color={NIVEL_COLOR.info} bg={NIVEL_BG.info}>
              {resumen.info} mejoras
            </Badge>
          )}
        </div>
      )}

      {error && (
        <div style={{ padding: 10, borderRadius: 8, background: "#ef444412", border: "1px solid #ef444455", color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {!loading && alertas.length === 0 && !error && (
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            background: "#10b98112",
            border: "1px solid #10b98155",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <CheckCircle2 size={18} color="#10b981" />
          <div style={{ display: "grid" }}>
            <strong style={{ fontSize: 14 }}>Todo en orden</strong>
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              El bot fiscal no ha detectado incidencias. Sigue así.
            </span>
          </div>
        </div>
      )}

      {alertas.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {alertas.map((a) => (
            <li
              key={a.id}
              style={{
                padding: 12,
                borderRadius: 10,
                background: NIVEL_BG[a.nivel],
                border: `1px solid ${NIVEL_BORDER[a.nivel]}`,
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <NivelIcon nivel={a.nivel} />
                <strong style={{ fontSize: 14 }}>{a.titulo}</strong>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                    opacity: 0.6,
                  }}
                >
                  {a.categoria.replace(/_/g, " ")}
                </span>
              </div>
              <span style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.4 }}>{a.descripcion}</span>
              {a.cta && (
                <Link
                  href={a.cta.href}
                  style={{
                    justifySelf: "start",
                    fontSize: 12,
                    color: NIVEL_COLOR[a.nivel],
                    fontWeight: 600,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    marginTop: 2,
                  }}
                >
                  {a.cta.label} <ArrowRight size={12} />
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Badge({ children, color, bg }: { children: React.ReactNode; color: string; bg: string }) {
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 600,
        border: `1px solid ${color}33`,
      }}
    >
      {children}
    </span>
  );
}
