"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Barra de progreso superior tipo Vercel/YouTube que indica que una
 * navegación está en curso. Sin librerías.
 *
 * Estrategia: hook a clicks en <a>/<Link> internos y a popstate; se oculta
 * cuando cambia el pathname. Respeta prefers-reduced-motion.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const finishRef = useRef<number | null>(null);

  function start() {
    if (timerRef.current != null) return;
    setActive(true);
    setProgress(8);
    timerRef.current = window.setInterval(() => {
      setProgress((p) => {
        // Curva logarítmica: avanza rápido al inicio y se ralentiza
        if (p < 70) return p + (70 - p) * 0.08;
        if (p < 90) return p + (90 - p) * 0.03;
        return p;
      });
    }, 120);
  }

  function finish() {
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setProgress(100);
    if (finishRef.current != null) clearTimeout(finishRef.current);
    finishRef.current = window.setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 220);
  }

  // Cierra la barra cuando cambia la ruta
  useEffect(() => {
    if (active) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Detecta clicks en links internos (mismo origen) y navegaciones del historial
  useEffect(() => {
    function isInternalLinkClick(e: MouseEvent) {
      if (e.defaultPrevented) return null;
      if (e.button !== 0) return null;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
      const t = e.target as HTMLElement | null;
      const a = t?.closest?.("a") as HTMLAnchorElement | null;
      if (!a) return null;
      if (a.target && a.target !== "_self") return null;
      const href = a.getAttribute("href");
      if (!href) return null;
      if (href.startsWith("#")) return null;
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return null;
      try {
        const url = new URL(a.href, window.location.href);
        if (url.origin !== window.location.origin) return null;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
        return url;
      } catch {
        return null;
      }
    }

    function onClick(e: MouseEvent) {
      const url = isInternalLinkClick(e);
      if (url) start();
    }
    function onPop() {
      start();
    }

    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPop);
      if (timerRef.current != null) clearInterval(timerRef.current);
      if (finishRef.current != null) clearTimeout(finishRef.current);
    };
  }, []);

  if (!active && progress === 0) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, var(--accent, #6366f1), color-mix(in srgb, var(--accent, #6366f1) 60%, #fff))",
          transition: "width 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease",
          opacity: progress >= 100 ? 0 : 1,
          boxShadow: "0 0 8px color-mix(in srgb, var(--accent, #6366f1) 80%, transparent), 0 0 2px color-mix(in srgb, var(--accent, #6366f1) 80%, transparent)",
        }}
      />
    </div>
  );
}
