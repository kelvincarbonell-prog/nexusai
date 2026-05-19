"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Command, ArrowRight } from "lucide-react";

/**
 * Atajos globales de teclado al estilo Linear / Notion / Github.
 *
 * Modo "G + letra" para navegación:
 *   G H → /dashboard (Home)
 *   G C → /clientes
 *   G F → /facturacion
 *   G A → /aeat
 *   G B → /contabilidad
 *   G L → /laboral
 *   G S → /solicitudes
 *   G M → /mensajes
 *   G T → /tareas
 *   G I → /inteligencia
 *
 * Acciones directas:
 *   ? → abre el modal de ayuda (atajos)
 *   N → crear factura nueva
 *   U → subir gasto/factura (OCR)
 *
 * Cmd/Ctrl + K → command palette (gestionado por CommandPalette).
 *
 * Se ignora si el usuario está escribiendo en un input/textarea/contenteditable.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const [waitingG, setWaitingG] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Permite abrir el modal de ayuda desde cualquier sitio
  // disparando window.dispatchEvent(new Event('m26:open-help')).
  useEffect(() => {
    const onOpen = () => setShowHelp(true);
    window.addEventListener("m26:open-help", onOpen);
    return () => window.removeEventListener("m26:open-help", onOpen);
  }, []);

  useEffect(() => {
    function isTyping(target: EventTarget | null) {
      if (!target) return false;
      const el = target as HTMLElement;
      const tag = (el.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      if (el.isContentEditable) return true;
      return false;
    }

    let resetTimer: number | null = null;

    function onKey(e: KeyboardEvent) {
      if (isTyping(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const key = e.key.toLowerCase();

      if (waitingG) {
        const map: Record<string, string> = {
          h: "/dashboard",
          c: "/clientes",
          f: "/facturacion",
          a: "/aeat",
          b: "/contabilidad",
          l: "/laboral",
          s: "/solicitudes",
          m: "/mensajes",
          t: "/tareas",
          i: "/inteligencia",
        };
        if (map[key]) {
          e.preventDefault();
          router.push(map[key]);
        }
        setWaitingG(false);
        if (resetTimer) window.clearTimeout(resetTimer);
        return;
      }

      if (key === "g") {
        e.preventDefault();
        setWaitingG(true);
        if (resetTimer) window.clearTimeout(resetTimer);
        resetTimer = window.setTimeout(() => setWaitingG(false), 1500);
        return;
      }

      if (key === "?" || (key === "/" && e.shiftKey)) {
        e.preventDefault();
        setShowHelp(true);
        return;
      }

      if (key === "n") {
        e.preventDefault();
        router.push("/facturacion?nueva=1");
        return;
      }
      if (key === "u") {
        e.preventDefault();
        // Si estamos en una ficha de cliente, abre OCR ahí; si no, ve a clientes
        if (typeof window !== "undefined" && /^\/clientes\/[0-9a-f-]+/i.test(window.location.pathname)) {
          const url = new URL(window.location.href);
          url.searchParams.set("tab", "lector-gastos");
          router.push(url.pathname + url.search);
        } else {
          router.push("/clientes");
        }
        return;
      }
      if (key === "escape") {
        setShowHelp(false);
        setWaitingG(false);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (resetTimer) window.clearTimeout(resetTimer);
    };
  }, [waitingG, router]);

  return (
    <>
      {/* Indicador "esperando segunda tecla" tras pulsar G */}
      {waitingG && (
        <div style={{
          position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, padding: "8px 14px", borderRadius: 999,
          background: "color-mix(in srgb, var(--accent, #6366f1) 18%, var(--bg, #000))",
          border: "1px solid var(--accent, #6366f1)", color: "#fff",
          fontFamily: "var(--mono, monospace)", fontSize: 12, fontWeight: 600,
          display: "inline-flex", alignItems: "center", gap: 8,
          boxShadow: "0 10px 30px -10px rgba(0,0,0,0.4)",
        }}>
          <Command size={12} /> G + letra para navegar… (H, C, F, A, B, L, S, M, T, I)
        </div>
      )}

      {/* Modal de ayuda */}
      {showHelp && (
        <div role="dialog" aria-modal="true" onClick={() => setShowHelp(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          display: "grid", placeItems: "center", padding: 16, zIndex: 9999,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: "min(540px, 100%)", background: "var(--card, #fff)", borderRadius: 14,
            border: "1px solid color-mix(in srgb, currentColor 14%, transparent)",
            padding: 20, display: "grid", gap: 14,
          }}>
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <strong style={{ fontSize: 15 }}>Atajos de teclado</strong>
              <button onClick={() => setShowHelp(false)} aria-label="Cerrar" style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit" }}><X size={16} /></button>
            </header>

            <div>
              <h3 style={{ fontSize: 12, margin: "4px 0 6px", opacity: 0.65, textTransform: "uppercase", letterSpacing: 0.4 }}>Navegación</h3>
              <Grid items={[
                { keys: ["⌘", "K"], label: "Buscar" },
                { keys: ["G", "H"], label: "Hoy" },
                { keys: ["G", "C"], label: "Clientes" },
                { keys: ["G", "F"], label: "Facturación" },
                { keys: ["G", "A"], label: "Modelos AEAT" },
                { keys: ["G", "B"], label: "Contabilidad" },
                { keys: ["G", "L"], label: "Laboral" },
                { keys: ["G", "S"], label: "Solicitudes" },
                { keys: ["G", "M"], label: "Mensajes" },
                { keys: ["G", "T"], label: "Tareas" },
                { keys: ["G", "I"], label: "Inteligencia" },
              ]} />
            </div>

            <div>
              <h3 style={{ fontSize: 12, margin: "4px 0 6px", opacity: 0.65, textTransform: "uppercase", letterSpacing: 0.4 }}>Acciones</h3>
              <Grid items={[
                { keys: ["N"], label: "Nueva factura" },
                { keys: ["U"], label: "Subir factura al OCR" },
                { keys: ["?"], label: "Esta ayuda" },
                { keys: ["Esc"], label: "Cerrar modales" },
              ]} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Grid({ items }: { items: Array<{ keys: string[]; label: string }> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
      {items.map((it) => (
        <div key={it.label} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "6px 10px", borderRadius: 8,
          background: "color-mix(in srgb, currentColor 5%, transparent)",
          fontSize: 12,
        }}>
          <span>{it.label}</span>
          <span style={{ display: "inline-flex", gap: 3 }}>
            {it.keys.map((k, i) => (
              <kbd key={i} style={{
                padding: "1px 6px", borderRadius: 4,
                background: "color-mix(in srgb, currentColor 10%, transparent)",
                fontFamily: "var(--mono, monospace)", fontSize: 11, fontWeight: 700,
                border: "1px solid color-mix(in srgb, currentColor 14%, transparent)",
              }}>{k}</kbd>
            ))}
          </span>
        </div>
      ))}
      <div style={{ gridColumn: "1/-1", fontSize: 10, opacity: 0.55, textAlign: "right", display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
        <ArrowRight size={10} /> Pulsa ? en cualquier momento para abrir esta ayuda
      </div>
    </div>
  );
}
