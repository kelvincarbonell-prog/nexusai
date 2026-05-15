import { LoginForm } from "@/components/login-form";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-left">
        <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="sb-brand-mark" aria-hidden="true">N</span>
          <strong style={{ fontFamily: "var(--mono)", fontSize: 14 }}>Nexus</strong>
        </header>

        <div>
          <span className="eyebrow">Sistema fiscal certificado · Q2 2026</span>
          <h1 className="display" style={{ marginTop: 14 }}>
            Tu copiloto <em>fiscal</em>, en directo.
          </h1>
          <p className="subtitle" style={{ marginTop: 18 }}>
            La plataforma donde autónomos, empresas y gestorías cierran impuestos, nóminas y bancos en
            minutos — con auditoría AEAT nativa y firma electrónica integrada.
          </p>
        </div>

        <div>
          <div className="login-stats">
            <div className="login-stat"><strong>1.842</strong><small>gestorías activas</small></div>
            <div className="login-stat"><strong>€ 2,4 Bn</strong><small>facturado · Q2</small></div>
            <div className="login-stat"><strong>99,2 %</strong><small>automatizado · IA</small></div>
            <div className="login-stat"><strong>12 s</strong><small>cierre medio · IVA</small></div>
          </div>
          <div className="login-foot" style={{ marginTop: 18 }}>
            <span>AEAT · VERI*FACTU</span>
            <span>ISO 27001</span>
            <span>SOC 2 · TYPE II</span>
            <span>ENS · MEDIO</span>
            <span style={{ marginLeft: "auto" }}>BUILD · v3.2.046 — Valencia</span>
          </div>
        </div>
      </section>

      <section className="login-right">
        <div style={{ width: "min(100%, 420px)", marginInline: "auto", display: "grid", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="pill">Acceso seguro</span>
            <Link href="/autonomos-empresas/registro" className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
              ¿sin cuenta? <strong style={{ color: "var(--ink)" }}>solicitar acceso →</strong>
            </Link>
          </div>

          <div>
            <h2 className="title" style={{ fontSize: 30 }}>
              Hola de nuevo, <em>tú</em>.
            </h2>
            <p className="muted" style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 12 }}>
              TLS 1.3 · datos en UE
            </p>
          </div>

          <LoginForm />

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
