import { AppShell } from "@/components/app-shell";
import { SolicitudesGestorPanel } from "@/components/dashboard/solicitudes-gestor-panel";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Solicitudes · Modelo 26" };

export default async function SolicitudesPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("perfiles")
    .select("rol,nombre")
    .eq("id", auth.user.id)
    .maybeSingle();

  // Clientes finales no entran aquí (envían desde su portal)
  if (profile?.rol === "portal_cliente") redirect("/portal");

  const isAdmin = profile?.rol === "admin";

  return (
    <AppShell
      active="/solicitudes"
      showSuperAdmin={isAdmin}
      espacio={{ nombre: profile?.nombre ?? "Mi gestoría", tipo: "Solicitudes" }}
    >
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">Lo que te piden tus clientes</span>
        <h1 className="title">
          Bandeja de <span className="brand-text">solicitudes</span>.
        </h1>
        <p className="subtitle">
          Todas las peticiones de laboral, fiscal y consultas generales que llegan desde el portal del
          cliente. Cambia el estado en un clic y queda registrado en su histórico.
        </p>
      </header>

      <section className="grid">
        <SolicitudesGestorPanel />
      </section>
    </AppShell>
  );
}
