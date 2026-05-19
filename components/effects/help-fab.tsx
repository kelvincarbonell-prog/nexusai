"use client";

import { HelpCircle } from "lucide-react";

/**
 * Botón flotante de ayuda persistente en toda la app. Click → abre el
 * modal de atajos+ayuda gestionado por KeyboardShortcuts (mismo modal
 * que se abre con la tecla «?»).
 */
export function HelpFab() {
  return (
    <button
      type="button"
      aria-label="Ayuda y atajos de teclado"
      title="Ayuda · Atajos (?)"
      onClick={() => window.dispatchEvent(new Event("m26:open-help"))}
      style={{
        position: "fixed",
        bottom: 22,
        right: 92,        // a la izquierda del FAB del asistente
        zIndex: 900,
        width: 44,
        height: 44,
        borderRadius: 999,
        border: "1px solid var(--line, #d1d5db)",
        background: "var(--panel, #fff)",
        color: "var(--ink, #111)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 20px -8px rgba(0,0,0,0.18)",
      }}
    >
      <HelpCircle size={20} strokeWidth={1.8} />
    </button>
  );
}
