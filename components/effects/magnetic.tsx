"use client";

import { useRef, type ReactNode } from "react";

/**
 * Wrap an element to make it "magnetic" — its child translates slightly toward
 * the cursor when the cursor is nearby.
 */
export function Magnetic({ children, strength = 0.3 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);

  function onMove(e: React.MouseEvent<HTMLSpanElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "translate(0, 0)";
  }

  return (
    <span
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ display: "inline-block" }}
    >
      <span
        ref={ref}
        style={{ display: "inline-block", transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)", willChange: "transform" }}
      >
        {children}
      </span>
    </span>
  );
}
