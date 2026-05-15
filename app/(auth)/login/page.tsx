import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="brand">
          <span className="brand-mark">NX</span>
          <span>NexusAI</span>
        </div>
        <h1 className="title">Gestión fiscal, documentos y clientes en una sola consola.</h1>
        <p className="subtitle" style={{ color: "rgba(255,255,255,.78)" }}>
          Nueva base en Next.js preparada para Vercel, Supabase Auth y permisos de producción.
        </p>
      </section>
      <section className="login-panel">
        <LoginForm />
      </section>
    </main>
  );
}
