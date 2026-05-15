import { AppShell } from "@/components/app-shell";
import { LeadsBoard } from "@/components/crm/leads-board";
import { SetupRequired } from "@/components/setup-required";
import { hasSupabaseConfig } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "CRM · Modelo 26" };

export default async function CRMPage() {
  if (!hasSupabaseConfig()) {
    return <SetupRequired missing={["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter((v) => !process.env[v])} />;
  }

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("perfiles").select("rol,nombre").eq("id", auth.user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  return (
    <AppShell active="/crm" showSuperAdmin={isAdmin} espacio={{ nombre: profile?.nombre ?? "Mi gestoría", tipo: "CRM" }}>
      <header style={{ marginBottom: 8 }}>
        <span className="eyebrow">Captación</span>
        <h1 className="title">
          <span className="brand-text">Pipeline</span> de oportunidades.
        </h1>
        <p className="subtitle">
          Lleva el control de leads, oportunidades en curso y conversiones. Cada lead que ganes se convierte
          en cliente con un clic.
        </p>
      </header>
      <LeadsBoard />
    </AppShell>
  );
}
