"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "m26-theme";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const current = (document.documentElement.getAttribute("data-theme") as "dark" | "light") || (stored as "dark" | "light") || "dark";
    setTheme(current);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      className={compact ? "theme-toggle" : "button secondary compact"}
      onClick={toggle}
      aria-label={`Cambiar a modo ${theme === "dark" ? "claro" : "oscuro"}`}
      title={`Modo ${theme === "dark" ? "claro" : "oscuro"}`}
    >
      {theme === "dark" ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
    </button>
  );
}
