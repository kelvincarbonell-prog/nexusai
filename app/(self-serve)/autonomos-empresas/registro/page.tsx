import Link from "next/link";
import { SelfServeRegisterForm } from "@/components/auth/self-serve-register-form";

export default function SelfServeRegisterPage() {
  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="brand">
          <span className="brand-mark">NX</span>
          <span>NexusAI</span>
        </div>
        <h1 className="title">Crea tu cuenta NexusAI</h1>
        <p className="subtitle" style={{ color: "rgba(255,255,255,.78)" }}>
          Registro directo para autónomos y empresas que quieren usar la plataforma sin una gestoría intermediaria.
        </p>
        <Link href="/autonomos-empresas/login" className="button secondary" style={{ width: "fit-content", marginTop: 24 }}>
          Ya tengo cuenta
        </Link>
      </section>
      <section className="login-panel">
        <SelfServeRegisterForm />
      </section>
    </main>
  );
}
