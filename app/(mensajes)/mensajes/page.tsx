import { AppShell } from "@/components/app-shell";
import { BandejaGestor } from "@/components/mensajes/bandeja-gestor";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Mensajes · Modelo 26" };

export default async function MensajesPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("perfiles").select("rol,nombre").eq("id", auth.user.id).maybeSingle();
  if (profile?.rol === "portal_cliente") redirect("/portal");
  const isAdmin = profile?.rol === "admin";

  return (
    <AppShell active="/mensajes" showSuperAdmin={isAdmin} espacio={{ nombre: profile?.nombre ?? "Mi gestoría", tipo: "Mensajes" }}>
      <header style={{ marginBottom: 16 }}>
        <span className="eyebrow">Comunicación con clientes</span>
        <h1 className="title">
          Bandeja de <span className="brand-text">mensajes</span>.
        </h1>
        <p className="subtitle">
          Conversaciones con tus clientes — agrupadas por empresa, con contador de no leídos y enlace directo a su ficha.
        </p>
      </header>
      <BandejaGestor />
    </AppShell>
  );
}
