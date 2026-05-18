"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, MessageCircle, HelpCircle, Loader2, X } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type SuggestedAction =
  | { kind: "crear_solicitud"; label: string; solicitud_key: string }
  | { kind: "hablar_gestor"; label: string }
  | { kind: "ver_documento"; label: string; doc_tipo: string };

type Triage = {
  ok: boolean;
  intent: string;
  suggested_solicitud_keys: string[];
  quick_answer: string;
  suggested_actions: SuggestedAction[];
  should_escalate: boolean;
  confianza: number;
  source?: string;
};

const TOPICS_INICIALES = [
  { label: "Dar de alta un trabajador", key: "alta trabajador" },
  { label: "Comunicar baja médica (IT)", key: "baja medica trabajador" },
  { label: "Pedir vacaciones", key: "vacaciones de un trabajador" },
  { label: "Presentar IVA trimestral", key: "presentar IVA 303" },
  { label: "Mi nómina del mes", key: "consultar nomina" },
  { label: "Solicitar presupuesto", key: "presupuesto servicio" },
];

export function ChatAssistant({
  empresaId,
  onSeleccionarSolicitud,
  onPedirAsesor,
  draft,
  onDraftChange,
}: {
  empresaId: string;
  /** El cliente acepta una sugerencia de solicitud: abre el formulario pre-rellenado. */
  onSeleccionarSolicitud?: (solicitudKey: string) => void;
  /** El cliente quiere hablar con un humano. Envía el mensaje al gestor. */
  onPedirAsesor?: () => void;
  /** Texto actual del input (para detectar cuándo dispara triage). */
  draft: string;
  /** Permite al asistente cambiar el draft (cuando hace clic en un topic inicial). */
  onDraftChange?: (value: string) => void;
}) {
  const supabase = useRef(createBrowserSupabase()).current;
  const [triage, setTriage] = useState<Triage | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const debounceRef = useRef<number | null>(null);

  async function consultar(text: string) {
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/portal/chat-triage", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ empresa_id: empresaId, message: text }),
      });
      const j = await res.json();
      if (j.ok) {
        setTriage(j as Triage);
        setDismissed(false);
      }
    } finally {
      setLoading(false);
    }
  }

  // Debounce: cuando el cliente para de escribir 700ms, dispara triage
  useEffect(() => {
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    if (draft.trim().length < 8) {
      setTriage(null);
      return;
    }
    debounceRef.current = window.setTimeout(() => consultar(draft), 700);
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // Vista inicial: no hay mensaje, sugerimos temas
  if (!draft.trim() && !triage) {
    return (
      <div style={card("info")}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Sparkles size={14} color="var(--accent)" />
          <strong style={{ fontSize: 13 }}>¿En qué te ayudo?</strong>
        </div>
        <p style={{ margin: "2px 0 10px", fontSize: 12, opacity: 0.75 }}>
          Elige un tema o escribe tu consulta. Te ayudo a estructurarla antes de mandársela a tu gestor.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
          {TOPICS_INICIALES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onDraftChange?.(t.key)}
              style={chip}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (dismissed) return null;

  // Mientras consulta IA
  if (loading && !triage) {
    return (
      <div style={card("info")}>
        <Loader2 size={14} className="animate-spin" />
        <span style={{ fontSize: 12, opacity: 0.7 }}>Analizando tu consulta…</span>
      </div>
    );
  }

  if (!triage) return null;

  return (
    <div style={card(triage.should_escalate ? "warn" : "info")}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {triage.should_escalate ? (
          <HelpCircle size={14} color="#f59e0b" />
        ) : (
          <Sparkles size={14} color="var(--accent)" />
        )}
        <strong style={{ fontSize: 13 }}>
          {triage.should_escalate ? "Te dejo con tu gestor" : "Sugerencia rápida"}
        </strong>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Cerrar sugerencia"
          style={{ marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer", padding: 4 }}
        >
          <X size={12} />
        </button>
      </div>
      <p style={{ margin: "6px 0 8px", fontSize: 13, lineHeight: 1.45 }}>{triage.quick_answer}</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {triage.suggested_actions.map((a, i) => {
          if (a.kind === "crear_solicitud") {
            return (
              <button
                key={`s-${i}`}
                type="button"
                onClick={() => onSeleccionarSolicitud?.(a.solicitud_key)}
                style={btn("primary")}
              >
                {a.label}
              </button>
            );
          }
          if (a.kind === "hablar_gestor") {
            return (
              <button key={`h-${i}`} type="button" onClick={() => onPedirAsesor?.()} style={btn("ghost")}>
                <MessageCircle size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
                {a.label}
              </button>
            );
          }
          return null;
        })}
      </div>
      {triage.confianza < 0.6 && (
        <p style={{ margin: "8px 0 0", fontSize: 11, opacity: 0.6 }}>
          No estoy 100% seguro de la respuesta. Si no te encaja, pulsa &quot;Hablar con un asesor&quot;.
        </p>
      )}
    </div>
  );
}

function card(tone: "info" | "warn"): React.CSSProperties {
  return {
    padding: 12,
    borderRadius: 10,
    border: `1px solid ${tone === "warn" ? "#f59e0b55" : "color-mix(in srgb, var(--accent) 35%, transparent)"}`,
    background: tone === "warn"
      ? "color-mix(in srgb, #f59e0b 10%, transparent)"
      : "color-mix(in srgb, var(--accent) 6%, transparent)",
    display: "grid",
    gap: 4,
    marginBottom: 10,
  };
}

const chip: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
  background: "color-mix(in srgb, currentColor 4%, transparent)",
  color: "inherit",
  cursor: "pointer",
  fontSize: 12,
  textAlign: "left",
};

function btn(variant: "primary" | "ghost"): React.CSSProperties {
  if (variant === "primary") {
    return {
      padding: "6px 12px",
      borderRadius: 8,
      border: "none",
      background: "var(--accent)",
      color: "#fff",
      cursor: "pointer",
      fontSize: 12,
      fontWeight: 600,
    };
  }
  return {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid color-mix(in srgb, currentColor 25%, transparent)",
    background: "transparent",
    cursor: "pointer",
    color: "inherit",
    fontSize: 12,
    fontWeight: 600,
  };
}
