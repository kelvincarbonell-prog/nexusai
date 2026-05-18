"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Estado vacío reutilizable: icono + título + descripción + CTA.
 *
 * Drop-in para listas, tablas, paneles que no tienen aún datos.
 * Mantén el mensaje en positivo: "Crea tu primer X" mejor que "Sin datos".
 */
export function EmptyState({
  icon,
  title,
  description,
  cta,
  secondary,
  size = "md",
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  cta?: { label: string; href?: string; onClick?: () => void };
  secondary?: { label: string; href?: string; onClick?: () => void };
  size?: "sm" | "md" | "lg";
}) {
  const padding = size === "sm" ? "20px 16px" : size === "lg" ? "48px 32px" : "32px 22px";
  const iconSize = size === "sm" ? 28 : size === "lg" ? 48 : 36;

  return (
    <div
      style={{
        padding,
        borderRadius: 14,
        border: "1px dashed color-mix(in srgb, currentColor 22%, transparent)",
        background: "color-mix(in srgb, currentColor 3%, transparent)",
        display: "grid",
        gap: 8,
        placeItems: "center",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: iconSize + 18,
          height: iconSize + 18,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background: "color-mix(in srgb, var(--accent, #6366f1) 12%, transparent)",
          color: "var(--accent, #6366f1)",
        }}
      >
        {icon ?? <Inbox size={iconSize} strokeWidth={1.6} />}
      </div>
      <strong style={{ fontSize: size === "sm" ? 14 : 16, marginTop: 2 }}>{title}</strong>
      {description && (
        <p style={{ margin: 0, fontSize: 13, opacity: 0.7, lineHeight: 1.5, maxWidth: 380 }}>{description}</p>
      )}
      {(cta || secondary) && (
        <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
          {cta && (cta.href ? (
            <Link href={cta.href} className="button">{cta.label}</Link>
          ) : (
            <button onClick={cta.onClick} className="button">{cta.label}</button>
          ))}
          {secondary && (secondary.href ? (
            <Link href={secondary.href} className="button ghost">{secondary.label}</Link>
          ) : (
            <button onClick={secondary.onClick} className="button ghost">{secondary.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
