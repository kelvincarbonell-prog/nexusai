import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { AgentConfig, defaultAgentConfigs } from "@/lib/agents/defaults";

export type SuperAdminMetrics = {
  gestores: number;
  clientes: number;
  independientes: number;
  facturas: number;
  documentos: number;
  firmas: number;
  agentes: number;
};

export async function getSuperAdminMetrics(): Promise<SuperAdminMetrics> {
  const admin = createSupabaseAdmin();
  const [
    perfiles,
    empresas,
    independientes,
    facturas,
    documentos,
    firmas,
    agentes,
  ] = await Promise.all([
    admin.from("perfiles").select("*", { count: "exact", head: true }).in("rol", ["gestor", "asesor"]),
    admin.from("empresas").select("*", { count: "exact", head: true }),
    admin.from("empresas").select("*", { count: "exact", head: true }).eq("onboarding_source", "self_serve"),
    admin.from("facturas").select("*", { count: "exact", head: true }),
    admin.from("documentos").select("*", { count: "exact", head: true }),
    admin.from("firma_docs").select("*", { count: "exact", head: true }),
    admin.from("agent_configs").select("*", { count: "exact", head: true }),
  ]);

  return {
    gestores: perfiles.count ?? 0,
    clientes: empresas.count ?? 0,
    independientes: independientes.count ?? 0,
    facturas: facturas.count ?? 0,
    documentos: documentos.count ?? 0,
    firmas: firmas.count ?? 0,
    agentes: agentes.count ?? defaultAgentConfigs().length,
  };
}

export async function getAgentConfigs(): Promise<AgentConfig[]> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("agent_configs")
    .select("id,name,category,enabled,priority,mission,rules_do,rules_dont,order_prompt")
    .order("priority", { ascending: true });

  if (error || !data || data.length === 0) return defaultAgentConfigs();
  return data as AgentConfig[];
}

export async function getSuperAdminDirectory() {
  const admin = createSupabaseAdmin();
  const [profiles, companies, settings] = await Promise.all([
    admin
      .from("perfiles")
      .select("id,email,nombre,apellidos,rol,nombre_gestoria,gestoria_slug,created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("empresas")
      .select("id,nombre,nif,estado,account_type,onboarding_source,plan,cliente_slug,gestor_id,owner_user_id,created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("super_admin_settings")
      .select("key,value,description")
      .order("key", { ascending: true }),
  ]);

  return {
    profiles: profiles.data ?? [],
    companies: companies.data ?? [],
    settings: settings.data ?? [],
  };
}
