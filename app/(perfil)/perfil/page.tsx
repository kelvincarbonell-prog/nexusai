import { AppShell } from "@/components/app-shell";
import { PerfilForm } from "@/components/perfil/perfil-form";
import { EquipoPanel } from "@/components/perfil/equipo-panel";
import { SetupRequired } from "@/components/setup-required";
import { hasSupabaseConfig } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Mi perfil · Modelo 26" };

export default async function PerfilPage() {
  if (!hasSupabaseConfig()) {
    return <SetupRequired missing={["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter((v) => !process.env[v])} />;
  }

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id,email,nombre,apellidos,rol,nombre_gestoria,foto_url,metadata,created_at")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!perfil) {
    // Crea el perfil mínimo si no existe (primera entrada vía email-only signup)
    const stub = {
      id: auth.user.id,
      email: auth.user.email ?? "",
      nombre: null,
      apellidos: null,
      rol: "gestor",
      nombre_gestoria: null,
      foto_url: null,
      metadata: null,
      created_at: new Date().toISOString(),
    };
    return (
      <AppShell active="/perfil" showSuperAdmin={false} espacio={{ nombre: stub.email, tipo: "Mi perfil" }}>
        <header style={{ marginBottom: 8 }}>
          <span className="eyebrow">Perfil</span>
          <h1 className="title">
            Configura <span className="brand-text">tu perfil</span>.
          </h1>
          <p className="subtitle">
            Personaliza tu nombre, foto y nombre de despacho. Tus clientes verán esta identidad cuando firmes o emitas comunicaciones.
          </p>
        </header>
        <PerfilForm initial={stub} />
      </AppShell>
    );
  }

  const isAdmin = perfil.rol === "admin";

  return (
    <AppShell active="/perfil" showSuperAdmin={isAdmin} espacio={{ nombre: perfil.nombre ?? perfil.email, tipo: perfil.rol }}>
      <header style={{ marginBottom: 8 }}>
        <span className="eyebrow">Perfil</span>
        <h1 className="title">
          Configura <span className="brand-text">tu perfil</span>.
        </h1>
        <p className="subtitle">
          Personaliza tu nombre, foto y nombre de despacho. Tus clientes verán esta identidad cuando firmes o emitas comunicaciones.
        </p>
      </header>
      <PerfilForm initial={perfil} />
      {(perfil.rol === "admin" || perfil.rol === "gestor") ? (
        <div style={{ marginTop: 24 }}>
          <EquipoPanel />
        </div>
      ) : null}
    </AppShell>
  );
}
