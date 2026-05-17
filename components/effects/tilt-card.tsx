"use client";

import { useRef, type ReactNode } from "react";

/**
 * Tarjeta con efecto de inclinación 3D al pasar el cursor.
 * Reacciona a la posición del ratón con rotateX/rotateY suave.
 */
export function TiltCard({
  children,
  className,
  intensity = 8,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateY = (x - 0.5) * intensity * 2;
    const rotateX = -(y - 0.5) * intensity * 2;
    el.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
    // Spotlight glow
    el.style.setProperty("--gx", `${x * 100}%`);
    el.style.setProperty("--gy", `${y * 100}%`);
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(900px) rotateX(0) rotateY(0)";
  }

  return (
    <div
      ref={ref}
      className={`tilt-card ${className ?? ""}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ transition: "transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)", willChange: "transform", position: "relative" }}
    >
      {children}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          background:
            "radial-gradient(400px circle at var(--gx, 50%) var(--gy, 50%), color-mix(in srgb, var(--accent) 12%, transparent), transparent 60%)",
          pointerEvents: "none",
          opacity: 0.9,
          transition: "opacity 0.2s",
        }}
      />
    </div>
  );
}
