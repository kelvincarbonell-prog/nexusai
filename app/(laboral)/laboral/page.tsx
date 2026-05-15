import { AppShell } from "@/components/app-shell";
import { WorkerManager } from "@/components/laboral/worker-manager";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LaboralPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("perfiles").select("rol").eq("id", auth.user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  const empresasRes = isAdmin
    ? await supabase.from("empresas").select("id,nombre,nif").order("nombre").limit(200)
    : await supabase.from("empresas").select("id,nombre,nif").or(`gestor_id.eq.${auth.user.id},owner_user_id.eq.${auth.user.id}`).order("nombre");

  const empresas = empresasRes.data ?? [];

  return (
    <AppShell active="/laboral" showSuperAdmin={isAdmin}>
      <header className="topbar">
        <div>
          <span className="eyebrow">Módulo Laboral</span>
          <h1 className="title">Personas, contratos y registro horario</h1>
          <p className="subtitle">Alta y baja de trabajadores, contratos, vacaciones, partes IT, fichaje obligatorio (RD 8/2019) y nóminas.</p>
        </div>
      </header>

      {empresas.length === 0 ? (
        <div className="card span-12">
          <p>No tienes empresas asignadas todavía. Ve a <a className="button compact" href="/dashboard?view=clientes">Clientes</a> para crear la primera.</p>
        </div>
      ) : (
        <div className="grid">
          <WorkerManager empresas={empresas} />
        </div>
      )}
    </AppShell>
  );
}
