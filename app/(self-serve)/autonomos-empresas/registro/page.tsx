import Link from "next/link";
import { SelfServeRegisterForm } from "@/components/auth/self-serve-register-form";

export const metadata = {
  title: "Empieza gratis · Modelo 26",
  description:
    "Crea tu cuenta de autónomo o empresa en menos de un minuto. Sin tarjeta, 14 días gratis, cancelas en un clic.",
};

export default function SelfServeRegisterPage() {
  return (
    <main className="login-page register-page">
      <section className="login-left">
        <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="sb-brand-mark m26-mark" aria-hidden="true">M26</span>
          <strong style={{ fontFamily: "var(--mono)", fontSize: 14 }}>Modelo 26</strong>
        </header>

        <div>
          <span className="eyebrow">Empezar gratis</span>
          <h1 className="display" style={{ fontSize: "clamp(38px, 5vw, 64px)", marginTop: 14 }}>
            <span className="brand-text">Cierra el trimestre</span>
            <br />
            <em>antes de que llegue.</em>
          </h1>
          <p className="subtitle" style={{ marginTop: 18, fontSize: 16 }}>
            En menos de un minuto tienes una cuenta lista, un buzón de email único para tus facturas y la IA
            categorizando tus gastos. Sin tarjeta, sin permanencia.
          </p>
        </div>

        <ul className="register-perks">
          <li>
            <span className="register-perk-icon" aria-hidden="true">✓</span>
            <div>
              <strong>14 días gratis</strong>
              <small>Acceso completo. Sin tarjeta para empezar.</small>
            </div>
          </li>
          <li>
            <span className="register-perk-icon" aria-hidden="true">✓</span>
            <div>
              <strong>Migración asistida</strong>
              <small>Traemos tus datos de A3, Sage, Holded o Quipu sin coste.</small>
            </div>
          </li>
          <li>
            <span className="register-perk-icon" aria-hidden="true">✓</span>
            <div>
              <strong>Cancelas en un clic</strong>
              <small>Sin permanencias ni letra pequeña. Tus datos siempre exportables.</small>
            </div>
          </li>
          <li>
            <span className="register-perk-icon" aria-hidden="true">✓</span>
            <div>
              <strong>Soporte humano en español</strong>
              <small>Asesores reales, no chatbots. Respuesta en menos de 4 horas.</small>
            </div>
          </li>
        </ul>

        <div className="login-foot">
          <span>AEAT · VERI*FACTU</span>
          <span>ISO 27001</span>
          <span>SOC 2 · TYPE II</span>
          <span>ENS · MEDIO</span>
        </div>
      </section>

      <section className="login-right">
        <div style={{ width: "min(100%, 460px)", marginInline: "auto", display: "grid", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span className="pill">Registro seguro</span>
            <Link href="/login" className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
              ¿ya tienes cuenta? <strong style={{ color: "var(--ink)" }}>entrar →</strong>
            </Link>
          </div>

          <SelfServeRegisterForm />

          <div className="login-foot-right" style={{ justifyContent: "center" }}>
            <span>ENCRIPTADO</span>
            <span>TLS 1.3</span>
            <span>DATOS EN UE</span>
          </div>
        </div>
      </section>
    </main>
  );
}
