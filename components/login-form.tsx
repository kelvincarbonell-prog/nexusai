"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function LoginForm({ redirectTo = "/dashboard" }: { redirectTo?: string; caption?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(formData: FormData) {
    setError("");
    setIsSubmitting(true);
    try {
      const email = String(formData.get("email") ?? "");
      const password = String(formData.get("password") ?? "");
      const supabase = createBrowserSupabase();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError("Email o contraseña incorrectos.");
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("No se pudo conectar con Supabase. Inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form action={submit} className="form" style={{ gap: 14 }}>
      <button
        type="button"
        className="login-card-row"
        onClick={() => setError("La autenticación con certificado FNMT estará disponible en producción.")}
      >
        <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="sb-brand-mark" aria-hidden="true">id</span>
          <span>
            <strong>Certificado digital</strong>
            <small style={{ display: "block" }}>FNMT *4521·M</small>
          </span>
        </span>
        <span className="kbd">↵</span>
      </button>

      <button
        type="button"
        className="login-card-row"
        onClick={() => setError("Cl@ve PIN se integrará junto a la firma electrónica.")}
      >
        <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="sb-brand-mark" aria-hidden="true" style={{ background: "var(--pill)", color: "var(--ink)", border: "1px solid var(--line)" }}>C@</span>
          <strong>Cl@ve PIN</strong>
        </span>
        <span className="kbd">↵</span>
      </button>

      <div className="divider">O EMAIL</div>

      <label className="label">
        Email
        <input className="input" name="email" type="email" placeholder="tu@gestoria.es" autoComplete="email" required />
      </label>
      <label className="label">
        Contraseña
        <input className="input" name="password" type="password" placeholder="••••••••••" autoComplete="current-password" required />
      </label>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "var(--mono)", fontSize: 12 }}>
        <label style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "var(--ink-soft)" }}>
          <input type="checkbox" defaultChecked /> Recordarme
        </label>
        <a className="muted" href="#">¿Contraseña?</a>
      </div>

      {error ? <p role="alert" style={{ color: "var(--bad)", margin: 0, fontSize: 13 }}>{error}</p> : null}

      <button className="button" type="submit" disabled={isSubmitting} style={{ justifyContent: "center", padding: "12px 14px" }}>
        {isSubmitting ? "Entrando…" : "Entrar al copiloto"}
        <span className="kbd" style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)", borderColor: "transparent" }}>⌘↵</span>
      </button>
    </form>
  );
}
