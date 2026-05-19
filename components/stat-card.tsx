import type { LucideIcon } from "lucide-react";

/**
 * KPI card uniforme para los dashboards. Usa los tokens de tema (var(--accent),
 * var(--good), etc.) y tipografía consistente con el resto de mini-KPIs.
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
  const color = tono === "bad" ? "#ef4444" : tono === "warn" ? "#f59e0b" : tono === "ok" ? "#10b981" : "var(--accent)";
  return (
    <article
      className="card span-3"
      style={{
        display: "grid",
        gap: 6,
        border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
        background: `color-mix(in srgb, ${color} 4%, transparent)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, color, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {Icon ? <Icon size={12} /> : null}
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--mono, monospace)", color: "var(--ink, inherit)" }}>{value}</div>
      {hint ? <p className="muted" style={{ margin: 0, fontSize: 11, lineHeight: 1.4 }}>{hint}</p> : null}
    </article>
  );
}
