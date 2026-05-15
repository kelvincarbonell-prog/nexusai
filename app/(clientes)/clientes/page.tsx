import { AppShell } from "@/components/app-shell";
import { ClientesPageClient } from "@/components/clientes/clientes-page-client";
import { SetupRequired } from "@/components/setup-required";
import { hasSupabaseConfig } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = { title: "Clientes · Modelo 26" };

type Empresa = {
  id: string;
  nombre: string;
  nif: string | null;
  account_type: "autonomo" | "empresa" | null;
  plan: string | null;
  gestor_id: string | null;
  inbox_alias: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export default async function ClientesPage() {
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
    ? await supabase
        .from("empresas")
        .select("id,nombre,nif,account_type,plan,gestor_id,inbox_alias,metadata,created_at")
        .order("nombre")
        .limit(500)
    : await supabase
        .from("empresas")
        .select("id,nombre,nif,account_type,plan,gestor_id,inbox_alias,metadata,created_at")
        .or(`gestor_id.eq.${auth.user.id},owner_user_id.eq.${auth.user.id}`)
        .order("nombre");
  const empresas = (empresasRes.data ?? []) as Empresa[];

  return (
    <AppShell active="/clientes" showSuperAdmin={isAdmin} espacio={{ nombre: profile?.nombre ?? "Mi gestoría", tipo: "Cartera", personas: empresas.length }}>
      <ClientesPageClient initialEmpresas={empresas} isAdmin={isAdmin} userId={auth.user.id} />
    </AppShell>
  );
}
