import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export default function SelfServeLoginPage() {
  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="brand">
          <span className="brand-mark">NX</span>
          <span>NexusAI</span>
        </div>
        <h1 className="title">Acceso para autónomos y empresas</h1>
        <p className="subtitle" style={{ color: "rgba(255,255,255,.78)" }}>
          Entra a tu espacio de facturas, documentos, obligaciones y automatizaciones aunque no trabajes con una gestoría.
        </p>
        <Link href="/autonomos-empresas/registro" className="button" style={{ width: "fit-content", marginTop: 24 }}>
          Crear cuenta independiente
        </Link>
      </section>
      <section className="login-panel">
        <LoginForm redirectTo="/autonomos-empresas" caption="Acceso independiente para autónomos y empresas." />
      </section>
    </main>
  );
}
