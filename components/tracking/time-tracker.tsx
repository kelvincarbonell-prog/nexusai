"use client";

import { useEffect, useMemo, useRef } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Time tracker: cada ~30s mientras la pestaña tiene foco y la página
 * está visible, manda un heartbeat al server con la duración acumulada.
 *
 * Usa Page Visibility API + window focus para pausar cuando el usuario
 * cambia de pestaña, deja la ventana o el dispositivo entra en idle.
 */
export function TimeTracker({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const lastSentRef = useRef<number>(Date.now());
  const focusedRef = useRef<boolean>(typeof document !== "undefined" ? !document.hidden : true);

  useEffect(() => {
    if (!empresaId) return;
    if (typeof document === "undefined") return;

    function onVisibility() {
      focusedRef.current = !document.hidden;
      if (focusedRef.current) lastSentRef.current = Date.now();
    }
    function onFocus() {
      focusedRef.current = true;
      lastSentRef.current = Date.now();
    }
    function onBlur() {
      focusedRef.current = false;
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);

    const tick = async () => {
      if (!focusedRef.current) return;
      const now = Date.now();
      const dur = Math.min(60_000, now - lastSentRef.current);
      if (dur < 5_000) return;
      lastSentRef.current = now;
      try {
        const { data: session } = await supabase.auth.getSession();
        const tk = session.session?.access_token;
        if (!tk) return;
        await fetch("/api/tracking/visit", {
          method: "POST",
          headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
          body: JSON.stringify({ empresa_id: empresaId, duration_ms: dur, path: window.location.pathname }),
          keepalive: true,
        });
      } catch {
        // silencio
      }
    };

    const id = setInterval(tick, 30_000);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      // Envío final al desmontar
      void tick();
    };
  }, [empresaId, supabase]);

  return null;
}
