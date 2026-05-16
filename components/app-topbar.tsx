"use client";

import { Mic } from "lucide-react";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { UserAvatarButton } from "@/components/user/user-avatar-button";

export function AppTopbar() {
  function openPalette() {
    const evt = new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true });
    window.dispatchEvent(evt);
  }

  return (
    <div className="topbar">
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
        <time suppressHydrationWarning>
          {new Date().toLocaleString("es-ES", { weekday: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </time>
        <NotificationsBell />
        <ThemeToggle compact />
        <UserAvatarButton />
      </div>
    </div>
  );
}
