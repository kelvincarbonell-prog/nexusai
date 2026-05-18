import { AppShell } from "@/components/app-shell";
import { InteligenciaDashboard } from "@/components/inteligencia/inteligencia-dashboard";
import { IntelOps } from "@/components/inteligencia/intel-ops";
import { AgentRunsHistory } from "@/components/inteligencia/agent-runs-history";
import { SetupRequired } from "@/components/setup-required";
import { hasSupabaseConfig } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Inteligencia · Modelo 26" };

export default async function InteligenciaPage() {
  if (!hasSupabaseConfig()) {
    return <SetupRequired missing={["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter((v) => !process.env[v])} />;
  }

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("perfiles").select("rol,nombre").eq("id", auth.user.id).maybeSingle();
  if (profile?.rol === "portal_cliente") redirect("/portal");
  const isAdmin = profile?.rol === "admin";

  const empresasRes = isAdmin
    ? await supabase.from("empresas").select("id,nombre").order("nombre").limit(50)
    : await supabase.from("empresas").select("id,nombre").or(`gestor_id.eq.${auth.user.id},owner_user_id.eq.${auth.user.id}`).order("nombre");
  const empresas = empresasRes.data ?? [];

  return (
    <AppShell active="/inteligencia" showSuperAdmin={isAdmin} espacio={{ nombre: profile?.nombre ?? "Mi gestoría", tipo: "Inteligencia" }}>
      <header style={{ marginBottom: 8 }}>
        <span className="eyebrow">Agente de inteligencia</span>
        <h1 className="title">
          Tu cartera, <span className="brand-text">en cifras</span>.
        </h1>
        <p className="subtitle">
          KPIs en vivo, tiempo dedicado por cliente, alertas y un análisis automático que detecta lo que merece tu atención esta semana.
        </p>
      </header>
      <InteligenciaDashboard />

      <section className="grid" style={{ marginTop: 24 }}>
        <IntelOps />
      </section>

      {empresas.length > 0 ? (
        <section className="grid" style={{ marginTop: 24 }}>
          <AgentRunsHistory empresas={empresas} />
        </section>
      ) : null}
    </AppShell>
  );
}
