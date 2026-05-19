import type { LucideIcon } from "lucide-react";

/**
 * KPI card uniforme. Usa la clase global `.card` (que respeta el tema
 * claro/oscuro) + un acento tonal lateral cuando se pasa `tono`. Sin
 * fondos hardcoded, así no aparece blanco puro sobre fondos oscuros.
 */
export function StatCard({
  label,
  value,
  hint,
  Icon,
  tono,
}: {
  label: string;
  value: string;
  hint?: string;
  Icon?: LucideIcon;
  tono?: "ok" | "warn" | "bad" | "neutral";
}) {
  const color = tono === "bad" ? "var(--bad, #ef4444)"
    : tono === "warn" ? "var(--warn, #f59e0b)"
    : tono === "ok" ? "var(--good, #10b981)"
    : "var(--accent)";
  return (
    <article
      className="card span-3"
      style={{
        display: "grid",
        gap: 6,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Barra lateral tonal — da color sin pisar el bg del tema */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: color,
          opacity: 0.85,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 6, color, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {Icon ? <Icon size={12} /> : null}
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--mono, monospace)", color: "var(--ink)" }}>{value}</div>
      {hint ? <p className="muted" style={{ margin: 0, fontSize: 11, lineHeight: 1.4 }}>{hint}</p> : null}
    </article>
  );
}
