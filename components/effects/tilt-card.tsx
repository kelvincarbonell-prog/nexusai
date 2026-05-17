"use client";

import { useRef, type ReactNode } from "react";

/**
 * Tarjeta con efecto de inclinación 3D al pasar el cursor.
 * Optimizado: throttling con requestAnimationFrame, no fuerza layout en cada movimiento.
 */
export function TiltCard({
  children,
  className,
  intensity = 6,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);
  const rectRef = useRef<DOMRect | null>(null);

  function onEnter(e: React.MouseEvent<HTMLDivElement>) {
    rectRef.current = e.currentTarget.getBoundingClientRect();
  }

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = rectRef.current;
    if (!rect) return;
    pendingRef.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const p = pendingRef.current;
      const node = ref.current;
      if (!p || !node) return;
      const rotateY = (p.x - 0.5) * intensity * 2;
      const rotateX = -(p.y - 0.5) * intensity * 2;
      node.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      node.style.setProperty("--gx", `${p.x * 100}%`);
      node.style.setProperty("--gy", `${p.y * 100}%`);
    });
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    el.style.transform = "perspective(900px) rotateX(0) rotateY(0)";
  }

  return (
    <div
      ref={ref}
      className={`tilt-card ${className ?? ""}`}
      onMouseEnter={onEnter}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)", position: "relative" }}
    >
      {children}
      <div
        aria-hidden="true"
        className="tilt-glow"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          background:
            "radial-gradient(380px circle at var(--gx, 50%) var(--gy, 50%), color-mix(in srgb, var(--accent) 10%, transparent), transparent 60%)",
          pointerEvents: "none",
          opacity: 0.85,
        }}
      />
    </div>
  );
}
