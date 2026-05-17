/**
 * Skeleton de página reutilizable. Muestra cabecera + grid de tarjetas
 * con shimmer mientras la ruta nueva se renderiza.
 */
export function PageSkeleton({ title, rows = 3 }: { title?: string; rows?: number }) {
  return (
    <div data-route-enter style={{ padding: "24px 28px", display: "grid", gap: 16 }}>
      <header style={{ display: "grid", gap: 8 }}>
        <span className="skeleton" style={{ height: 12, width: 140 }} />
        <span className="skeleton" style={{ height: 28, width: title ? `${Math.min(title.length * 14 + 60, 480)}px` : 320 }} />
        <span className="skeleton" style={{ height: 14, width: "60%", maxWidth: 480 }} />
      </header>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              padding: 16,
              borderRadius: 14,
              border: "1px solid var(--border, color-mix(in srgb, var(--line) 80%, transparent))",
              background: "color-mix(in srgb, var(--card, var(--bg)) 92%, transparent)",
              display: "grid",
              gap: 10,
            }}
          >
            <span className="skeleton" style={{ height: 14, width: "40%" }} />
            <span className="skeleton" style={{ height: 28, width: "70%" }} />
            <span className="skeleton" style={{ height: 12, width: "90%" }} />
            <span className="skeleton" style={{ height: 12, width: "55%" }} />
          </div>
        ))}
      </section>
    </div>
  );
}
