"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Botón "Volver" sencillo:
 *  - usa router.back() si hay historial,
 *  - fallback al `href` proporcionado si no.
 *
 * Drop-in para cualquier sub-página de detalle.
 */
export function BackLink({
  href,
  label,
  className,
  compact = false,
}: {
  href: string;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  const router = useRouter();

  function onClick(e: React.MouseEvent) {
    // Permite ctrl/cmd click para abrir en pestaña según el href de fallback
    if (e.metaKey || e.ctrlKey || e.button === 1) return;
    e.preventDefault();
    // Si hay historial interno, vuelve; si no, navega al fallback
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(href);
    }
  }

  return (
    <a
      href={href}
      onClick={onClick}
      className={`button ghost ${compact ? "compact" : ""} ${className ?? ""}`}
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
    >
      <ArrowLeft size={14} aria-hidden="true" />
      {label ?? "Volver"}
    </a>
  );
}
