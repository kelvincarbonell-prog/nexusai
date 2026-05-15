"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function LoginForm({ redirectTo = "/dashboard", caption = "Usa el usuario de Supabase Auth." }: { redirectTo?: string; caption?: string }) {
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
    <form action={submit} className="login-card form">
      <div>
        <h2>Acceder</h2>
        <p className="muted">{caption}</p>
      </div>
      <label>
        Email
        <input className="input" name="email" type="email" placeholder="tu@email.com" autoComplete="email" required />
      </label>
      <label>
        Contraseña
        <input className="input" name="password" type="password" placeholder="Contraseña" autoComplete="current-password" required />
      </label>
      {error ? <p role="alert" style={{ color: "var(--danger)", margin: 0 }}>{error}</p> : null}
      <button className="button" type="submit" disabled={isSubmitting}>
        <LogIn size={17} aria-hidden="true" />
        {isSubmitting ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
