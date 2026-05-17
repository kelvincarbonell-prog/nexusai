"use client";

import { useEffect, useState } from "react";
import { Mic, ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { UserAvatarButton } from "@/components/user/user-avatar-button";

function useNow(intervalMs = 30_000): string {
  // Empieza vacío para evitar hydration mismatch.
  const [s, setS] = useState("");
  useEffect(() => {
    function update() {
      setS(new Date().toLocaleString("es-ES", { weekday: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }));
    }
    update();
    const t = window.setInterval(update, intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return s;
}

/**
 * Topbar global con buscador, campana y avatar.
 * Incluye un botón "Volver" inteligente que aparece cuando estamos en
 * una sub-página de detalle (cualquier ruta con >1 segmento de
 * profundidad: /clientes/[id], /facturacion/x, etc.).
 */
export function AppTopbar() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const segments = pathname.split("/").filter(Boolean);
  const showBack = segments.length > 1;
  const parent = "/" + segments[0];
  const now = useNow();

  function openPalette() {
    const evt = new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true });
    window.dispatchEvent(evt);
  }

  function goBack(e: React.MouseEvent) {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(parent);
    }
  }

  return (
    <div className="topbar">
      {showBack ? (
        <a
          href={parent}
          onClick={goBack}
          className="button ghost compact"
          aria-label="Volver"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginRight: 8,
            whiteSpace: "nowrap",
          }}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Volver
        </a>
      ) : null}

      <button
        type="button"
        className="topbar-search"
        aria-label="Abrir buscador (Cmd/Ctrl+K)"
        onClick={openPalette}
        style={{ cursor: "pointer", textAlign: "left" }}
      >
        <span className="kbd">⌘K</span>
        <span style={{ flex: 1, color: "var(--muted)" }}>
          Buscar cliente, página o modelo AEAT…
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--muted)" }}>
          <span className="pulse-dot" aria-hidden="true" />
          <Mic size={13} aria-hidden="true" /> voz
        </span>
      </button>
      <div className="topbar-meta">
        <time suppressHydrationWarning>{now}</time>
        <NotificationsBell />
        <ThemeToggle compact />
        <UserAvatarButton />
      </div>
    </div>
  );
}
