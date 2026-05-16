import { AppShell } from "@/components/app-shell";
import { TareasList } from "@/components/tareas/tareas-list";
import { SetupRequired } from "@/components/setup-required";
import { hasSupabaseConfig } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Tareas · Modelo 26" };

export default async function TareasPage() {
  if (!hasSupabaseConfig()) {
    return <SetupRequired missing={["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter((v) => !process.env[v])} />;
  }
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: profile } = await supabase.from("perfiles").select("rol,nombre").eq("id", auth.user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  return (
    <AppShell active="/tareas" showSuperAdmin={isAdmin} espacio={{ nombre: profile?.nombre ?? "Mi gestoría", tipo: "Tareas" }}>
      <header style={{ marginBottom: 8 }}>
        <span className="eyebrow">Hoy</span>
        <h1 className="title">
          <span className="brand-text">Tareas</span> de tu día.
        </h1>
        <p className="subtitle">
          Tu lista de pendientes con prioridad y fecha límite. Marca completadas con un clic.
        </p>
      </header>
      <TareasList />
    </AppShell>
  );
}
