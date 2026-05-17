"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Pequeñas partículas flotantes sutiles. Canvas-based para no inflar el DOM.
 * Respeta prefers-reduced-motion (no se anima). Desactivado en mobile
 * (< 900px) para no penalizar el rendimiento.
 */
export function Particles({
  count = 22,
  className,
  style,
}: {
  count?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  // Solo se monta en desktop y respetando reduce-motion
  useEffect(() => {
    const isDesktop = window.matchMedia("(min-width: 900px)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isDesktop && !reduce) setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const canvas = ref.current;
    if (!canvas) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = window.devicePixelRatio || 1;
    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;

    function resize() {
      if (!canvas) return;
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx?.scale(dpr, dpr);
    }
    resize();
    window.addEventListener("resize", resize);

    const accentVar = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#7c5cff";

    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.6 + Math.random() * 1.6,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15 - 0.04,
      a: 0.25 + Math.random() * 0.45,
    }));

    let raf = 0;
    function frame() {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `${accentVar}${Math.round(p.a * 255).toString(16).padStart(2, "0")}`;
        ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(frame);
    }
    if (reduce) {
      // Solo dibuja una vez, sin animar
      frame();
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, [count, enabled]);

  if (!enabled) return null;
  return (
    <canvas
      ref={ref}
      className={className}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", ...style }}
    />
  );
}
