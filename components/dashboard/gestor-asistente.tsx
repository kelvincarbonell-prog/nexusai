"use client";

import { useMemo, useRef, useState } from "react";
import { Sparkles, Send, Loader2, X, MessageCircleQuestion } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Mensaje = { rol: "user" | "asistente"; texto: string };

const SUGERENCIAS = [
  "Resumen de mi cartera esta semana",
  "¿Qué cliente tiene más facturas vencidas?",
  "¿Cuántos modelos AEAT vencen en 7 días?",
  "¿Qué empresas están en estado crítico?",
];

export function GestorAsistente() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [open, setOpen] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  async function enviar(texto?: string) {
    const message = (texto ?? draft).trim();
    if (!message || busy) return;
    setMensajes((m) => [...m, { rol: "user", texto: message }]);
    setDraft("");
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/agents/gestor-asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ message }),
      });
      let answer = "";
      try {
        const j = await res.json();
        if (j.ok && typeof j.answer === "string" && j.answer.trim()) {
          answer = j.answer.trim();
        } else if (j.error) {
          answer = `⚠ ${j.error}`;
        } else {
          answer = "No he podido procesar la pregunta. Inténtalo de nuevo.";
        }
      } catch {
        answer = `⚠ El servidor respondió ${res.status} sin JSON válido.`;
      }
      setMensajes((m) => [...m, { rol: "asistente", texto: answer }]);
    } catch (e: unknown) {
      setMensajes((m) => [...m, { rol: "asistente", texto: `⚠ ${e instanceof Error ? e.message : "Error de red"}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir asistente del gestor"
        style={fab}
      >
        <Sparkles size={18} />
        <span style={{ fontWeight: 600 }}>Asistente</span>
      </button>
    );
  }

  return (
    <div style={panel}>
      <header style={panelHead}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} color="var(--accent, #6366f1)" />
          <strong style={{ fontSize: 14, color: "var(--ink, #111)" }}>Asistente del gestor</strong>
        </div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Cerrar asistente"
          title="Cerrar"
          style={closeBtn}
        >
          <X size={16} />
        </button>
      </header>

      <div style={messagesBox}>
        {mensajes.length === 0 && (
          <div style={{ padding: 12, display: "grid", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
              Pregúntame sobre tu cartera. Tengo acceso al estado en tiempo real de todas tus empresas.
            </p>
            <div style={{ display: "grid", gap: 6 }}>
              {SUGERENCIAS.map((s) => (
                <button key={s} onClick={() => enviar(s)} style={chip}>
                  <MessageCircleQuestion size={11} style={{ marginRight: 6, verticalAlign: "middle" }} />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {mensajes.map((m, i) => (
          <div key={i} style={bubble(m.rol)}>
            {m.texto}
          </div>
        ))}
        {busy && (
          <div style={bubble("asistente")}>
            <Loader2 size={14} className="animate-spin" style={{ verticalAlign: "middle", marginRight: 6 }} />
            Analizando tu cartera…
          </div>
        )}
      </div>

      <footer style={panelFoot}>
        <textarea
          ref={inputRef}
          value={draft}
          rows={2}
          placeholder="Pregúntame lo que necesites…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          style={textarea}
        />
        <button onClick={() => enviar()} disabled={busy || !draft.trim()} style={sendBtn} aria-label="Enviar">
          <Send size={14} />
        </button>
      </footer>
    </div>
  );
}

const fab: React.CSSProperties = {
  position: "fixed",
  bottom: 22,
  right: 22,
  zIndex: 900,
  padding: "12px 16px",
  borderRadius: 999,
  border: "none",
  background: "linear-gradient(135deg, var(--accent, #6366f1), color-mix(in srgb, var(--accent, #6366f1) 70%, #000))",
  color: "#fff",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  boxShadow: "0 12px 30px -8px color-mix(in srgb, var(--accent, #6366f1) 50%, transparent)",
};

const panel: React.CSSProperties = {
  position: "fixed",
  bottom: 22,
  right: 22,
  zIndex: 900,
  width: "min(420px, calc(100vw - 32px))",
  maxHeight: "min(620px, calc(100vh - 80px))",
  background: "var(--bg, #ffffff)",
  color: "var(--ink, #111)",
  border: "1px solid var(--line, #d1d5db)",
  borderRadius: 14,
  boxShadow: "0 24px 60px -12px rgba(0,0,0,0.38)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const panelHead: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid var(--line, #d1d5db)",
  background: "var(--card, #f9fafb)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const messagesBox: React.CSSProperties = {
  flex: 1,
  overflow: "auto",
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  background: "var(--bg, #ffffff)",
  color: "var(--ink, #111)",
};

const panelFoot: React.CSSProperties = {
  padding: 10,
  borderTop: "1px solid var(--line, #d1d5db)",
  background: "var(--card, #f9fafb)",
  display: "flex",
  gap: 6,
  alignItems: "end",
};

const textarea: React.CSSProperties = {
  flex: 1,
  resize: "none",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--line, #d1d5db)",
  background: "var(--bg, #fff)",
  color: "var(--ink, #111)",
  fontSize: 14,
  lineHeight: 1.45,
  fontFamily: "inherit",
  outline: "none",
};

const sendBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "none",
  background: "var(--accent, #6366f1)",
  color: "#fff",
  cursor: "pointer",
};

const iconBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 4,
  color: "inherit",
};

const closeBtn: React.CSSProperties = {
  border: "1px solid var(--line, #d1d5db)",
  background: "#ffffff",
  cursor: "pointer",
  width: 34,
  height: 34,
  borderRadius: 8,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#374151",
  flexShrink: 0,
};

const chip: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--line, #d1d5db)",
  background: "var(--card, #f9fafb)",
  color: "var(--ink, #111)",
  cursor: "pointer",
  fontSize: 13,
  textAlign: "left",
  lineHeight: 1.4,
};

function bubble(rol: Mensaje["rol"]): React.CSSProperties {
  const isUser = rol === "user";
  return {
    alignSelf: isUser ? "flex-end" : "flex-start",
    maxWidth: "88%",
    padding: "10px 14px",
    borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
    background: isUser
      ? "var(--accent, #6366f1)"
      : "var(--card, #f3f4f6)",
    color: isUser ? "#ffffff" : "var(--ink, #111)",
    border: isUser ? "none" : "1px solid var(--line, #d1d5db)",
    fontSize: 14,
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };
}
