import { ClienteWorkspace } from "@/components/clientes/cliente-workspace";
import { TimeTracker } from "@/components/tracking/time-tracker";
import { createServerSupabase } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function ClienteDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id,nombre,nif,account_type,plan,inbox_alias,metadata,gestor_id,owner_user_id")
    .eq("id", id)
    .maybeSingle();
  if (!empresa) notFound();

  const { data: profile } = await supabase.from("perfiles").select("rol").eq("id", auth.user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";
  const canAccess =
    isAdmin ||
    empresa.gestor_id === auth.user.id ||
    empresa.owner_user_id === auth.user.id;
  if (!canAccess) {
    const { data: pa } = await supabase
      .from("portal_accesos")
      .select("id")
      .eq("empresa_id", id)
      .eq("user_id", auth.user.id)
      .eq("estado", "activo")
      .maybeSingle();
    if (!pa) notFound();
  }

  const workspaceEmpresa = {
    id: empresa.id,
    nombre: empresa.nombre,
    nif: empresa.nif ?? null,
    account_type: empresa.account_type ?? null,
    plan: empresa.plan ?? null,
    inbox_alias: empresa.inbox_alias ?? null,
    metadata: (empresa.metadata ?? {}) as Record<string, unknown>,
  };

  return (
    <>
      <TimeTracker empresaId={id} />
      <ClienteWorkspace empresa={workspaceEmpresa} />
    </>
  );
}
