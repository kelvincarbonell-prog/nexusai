import { AppShell } from "@/components/app-shell";
import { EquipoPanel } from "@/components/perfil/equipo-panel";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Equipo · Modelo 26" };

export default async function EquipoPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("perfiles")
    .select("rol,nombre,nombre_gestoria")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profile?.rol === "portal_cliente") redirect("/portal");

  const isAdmin = profile?.rol === "admin";
  const isGestor = profile?.rol === "admin" || profile?.rol === "gestor";

  return (
    <AppShell active="/equipo" showSuperAdmin={isAdmin} espacio={{ nombre: profile?.nombre_gestoria ?? profile?.nombre ?? "Mi gestoría", tipo: "Equipo" }}>
      <header style={{ marginBottom: 8 }}>
        <span className="eyebrow">Equipo de la gestoría</span>
        <h1 className="title">
          Tus <span className="brand-text">asesores</span> y permisos.
        </h1>
        <p className="subtitle">
          Invita a otros asesores a tu despacho. Comparten los clientes asignados a la gestoría y pueden ejecutar
          los modelos AEAT, nóminas y demás herramientas.
        </p>
      </header>

      {isGestor ? (
        <EquipoPanel />
      ) : (
        <article className="card span-12">
          <p className="muted">
            Solo los roles admin o gestor pueden gestionar el equipo. Si necesitas añadir asesores, pide acceso al
            administrador de tu despacho.
          </p>
        </article>
      )}
    </AppShell>
  );
}
