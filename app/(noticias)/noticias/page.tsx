import { AppShell } from "@/components/app-shell";
import { NoticiasList } from "@/components/noticias/noticias-list";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Noticias · Modelo 26" };

export default async function NoticiasPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("perfiles").select("rol,nombre").eq("id", auth.user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  return (
    <AppShell active="/noticias" showSuperAdmin={isAdmin}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <span className="eyebrow">Blog del gestor</span>
          <h1 className="title" style={{ fontSize: 28, margin: "4px 0 0" }}>Noticias del día</h1>
          <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
            Actualidad fiscal, contable, mercantil y laboral curada cada mañana desde fuentes oficiales (AEAT, BOE, TGSS, BORME, RMC, CIRCE, CNMV…).
          </p>
        </div>
      </header>

      <NoticiasList />
    </AppShell>
  );
}
