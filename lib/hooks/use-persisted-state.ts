"use client";

import { useEffect, useState } from "react";

/**
 * Hook: estado React persistido en localStorage.
 * Igual que useState pero recuerda el valor entre sesiones.
 *
 * Ejemplo:
 *   const [filtro, setFiltro] = usePersistedState("gastos:estado", "todos");
 */
export function usePersistedState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(`m26.${key}`);
      if (raw == null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(`m26.${key}`, JSON.stringify(value));
    } catch {
      // localStorage puede fallar (quota, modo privado): ignoramos
    }
  }, [key, value]);

  return [value, setValue];
}
