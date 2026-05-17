"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Eye, EyeOff, Sparkles, ShieldCheck } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Página de bienvenida tras aceptar la invitación.
 *
 * Flujo:
 *   1. El usuario pulsa el botón "Confirmar invitación" del email.
 *   2. Supabase verifica el token, abre sesión, redirige aquí.
 *   3. Mostramos animación de "verificación con éxito".
 *   4. Pedimos contraseña nueva (porque las cuentas invitadas no tienen).
 *   5. Tras guardar la contraseña → /dashboard.
 */
export default function BienvenidaPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();

  const [phase, setPhase] = useState<"checking" | "verified" | "password" | "saving" | "done" | "error">("checking");
  const [user, setUser] = useState<{ email?: string; nombre?: string; nombre_gestoria?: string } | null>(null);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setPhase("error");
        setError("La sesión del enlace ha caducado. Pide a tu gestor que te reenvíe la invitación.");
        return;
      }
      setUser({
        email: auth.user.email,
        nombre: (auth.user.user_metadata?.nombre as string) ?? "",
        nombre_gestoria: (auth.user.user_metadata?.nombre_gestoria as string) ?? "",
      });
      setPhase("verified");
      // Pasamos a fase password después de un breve "verified" para la animación
      setTimeout(() => setPhase("password"), 1800);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardarPassword() {
    if (password.length < 8) {
      setError("Mínimo 8 caracteres.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setPhase("saving");
    setError(null);
    try {
      const { error: e } = await supabase.auth.updateUser({
        password,
        data: { password_set: true, password_set_at: new Date().toISOString() },
      });
      if (e) throw new Error(e.message);
      setPhase("done");
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (e: unknown) {
      setPhase("password");
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  const score = scorePassword(password);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "var(--bg)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Aurora de fondo */}
      <div className="bv-aurora" aria-hidden="true" />

      <article
        className="card"
        style={{
          maxWidth: 460,
          width: "100%",
          padding: 32,
          textAlign: "center",
          position: "relative",
          zIndex: 1,
          display: "grid",
          gap: 18,
          boxShadow: "0 24px 60px -20px color-mix(in srgb, var(--accent) 35%, transparent)",
        }}
      >
        {/* HERO: icono + título según fase */}
        {phase === "checking" ? (
          <>
            <div className="bv-icon-loading" aria-hidden="true">
              <Sparkles size={36} strokeWidth={1.5} color="var(--accent)" />
            </div>
            <h1 style={{ fontSize: 22, margin: 0 }}>Verificando tu invitación…</h1>
            <p className="muted" style={{ fontSize: 13 }}>Estamos comprobando el enlace seguro.</p>
          </>
        ) : null}

        {phase === "verified" ? (
          <>
            <div className="bv-icon-success" aria-hidden="true">
              <Check size={42} strokeWidth={3} color="white" />
            </div>
            <h1 style={{ fontSize: 24, margin: 0, color: "var(--good)" }}>✓ Verificación con éxito</h1>
            <p style={{ fontSize: 14, margin: 0 }}>
              Bienvenido{user?.nombre ? `, ${user.nombre}` : ""}.{user?.nombre_gestoria ? <> Te has unido a <strong>{user.nombre_gestoria}</strong>.</> : null}
            </p>
          </>
        ) : null}

        {phase === "password" || phase === "saving" ? (
          <>
            <div className="bv-icon-success" aria-hidden="true" style={{ width: 60, height: 60 }}>
              <ShieldCheck size={30} strokeWidth={2.2} color="white" />
            </div>
            <h1 style={{ fontSize: 22, margin: 0 }}>Crea tu contraseña</h1>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {user?.email ? <>Para <strong>{user.email}</strong>. </> : null}
              Esta será tu contraseña para entrar a partir de ahora.
            </p>

            <div style={{ display: "grid", gap: 10, textAlign: "left" }}>
              <label className="label">
                Nueva contraseña
                <div style={{ position: "relative" }}>
                  <input
                    type={showPwd ? "text" : "password"}
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    autoFocus
                    style={{ paddingRight: 38 }}
                    onKeyDown={(e) => e.key === "Enter" && document.getElementById("bv-pwd2")?.focus()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    aria-label={showPwd ? "Ocultar" : "Mostrar"}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                      color: "var(--muted)",
                      padding: 6,
                    }}
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {password.length > 0 ? (
                  <div style={{ display: "flex", gap: 4, marginTop: 6, alignItems: "center" }}>
                    {[1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        style={{
                          height: 4,
                          flex: 1,
                          borderRadius: 2,
                          background: score >= i ? scoreColor(score) : "color-mix(in srgb, var(--line) 60%, transparent)",
                          transition: "background 0.2s",
                        }}
                      />
                    ))}
                    <small style={{ fontSize: 10, fontFamily: "var(--mono)", color: scoreColor(score), marginLeft: 6 }}>{scoreLabel(score)}</small>
                  </div>
                ) : null}
              </label>
              <label className="label">
                Repite la contraseña
                <input
                  id="bv-pwd2"
                  type={showPwd ? "text" : "password"}
                  className="input"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Repite la misma"
                  onKeyDown={(e) => e.key === "Enter" && guardarPassword()}
                />
                {password2.length > 0 && password !== password2 ? (
                  <small style={{ color: "var(--bad)", fontSize: 11 }}>No coinciden</small>
                ) : null}
              </label>
            </div>

            {error ? <p role="alert" style={{ color: "var(--bad)", fontSize: 13, margin: 0 }}>{error}</p> : null}

            <button
              className="button"
              onClick={guardarPassword}
              disabled={phase === "saving" || password.length < 8 || password !== password2}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, position: "relative", overflow: "hidden" }}
            >
              {phase === "saving" ? (
                <>
                  <Sparkles size={14} className="bv-spin" /> Guardando…
                  <span className="bv-shimmer" aria-hidden="true" />
                </>
              ) : (
                <><Lock size={14} /> Guardar y entrar</>
              )}
            </button>
            <small className="muted" style={{ fontSize: 11 }}>
              Podrás cambiarla en cualquier momento desde Mi perfil → Seguridad.
            </small>
          </>
        ) : null}

        {phase === "done" ? (
          <>
            <div className="bv-icon-success" aria-hidden="true">
              <Check size={42} strokeWidth={3} color="white" />
            </div>
            <h1 style={{ fontSize: 22, margin: 0 }}>¡Listo!</h1>
            <p className="muted" style={{ fontSize: 13 }}>Entrando a tu panel…</p>
          </>
        ) : null}

        {phase === "error" ? (
          <>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "color-mix(in srgb, var(--bad) 14%, transparent)", display: "grid", placeItems: "center", margin: "0 auto" }}>
              <span style={{ fontSize: 28, color: "var(--bad)" }}>!</span>
            </div>
            <h1 style={{ fontSize: 22, margin: 0 }}>Enlace caducado</h1>
            <p className="muted" style={{ fontSize: 13 }}>{error}</p>
            <a className="button secondary" href="/login">Ir a inicio de sesión</a>
          </>
        ) : null}
      </article>

      <style jsx global>{`
        .bv-aurora {
          position: absolute;
          inset: -10%;
          background:
            radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--accent) 24%, transparent) 0%, transparent 45%),
            radial-gradient(circle at 80% 80%, color-mix(in srgb, var(--good) 22%, transparent) 0%, transparent 50%);
          filter: blur(60px);
          opacity: 0.7;
          pointer-events: none;
          animation: bv-float 14s ease-in-out infinite;
        }
        @keyframes bv-float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-20px, 30px); }
        }

        .bv-icon-loading {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: color-mix(in srgb, var(--accent) 14%, transparent);
          display: grid;
          place-items: center;
          margin: 0 auto;
          animation: bv-pulse 1.4s ease-in-out infinite;
        }
        @keyframes bv-pulse {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.08); opacity: 1; }
        }

        .bv-icon-success {
          width: 78px;
          height: 78px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--good) 0%, color-mix(in srgb, var(--good) 60%, var(--accent)) 100%);
          display: grid;
          place-items: center;
          margin: 0 auto;
          box-shadow: 0 12px 30px -8px color-mix(in srgb, var(--good) 50%, transparent);
          animation: bv-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes bv-pop {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); }
        }

        @keyframes bv-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .bv-spin { animation: bv-spin 1.2s linear infinite; }
        @keyframes bv-shimmer-anim { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .bv-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%);
          animation: bv-shimmer-anim 1.4s linear infinite;
          pointer-events: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .bv-aurora, .bv-icon-loading, .bv-spin, .bv-shimmer { animation: none; }
          .bv-icon-success { animation: none; }
        }
      `}</style>
    </div>
  );
}

function scorePassword(p: string): number {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^a-zA-Z0-9]/.test(p)) s++;
  return Math.min(4, s);
}
function scoreLabel(s: number): string {
  return ["—", "débil", "aceptable", "fuerte", "excelente"][s];
}
function scoreColor(s: number): string {
  return ["var(--muted)", "var(--bad)", "var(--warn)", "var(--good)", "var(--good)"][s];
}
