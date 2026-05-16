import { createSupabaseAdmin } from "@/lib/supabase/admin";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;

export type PortalEmpresa = {
  id: string;
  nombre: string;
  nif: string | null;
  account_type: string | null;
  plan: string | null;
  inbox_alias: string | null;
  metadata: Record<string, unknown>;
};

/**
 * Returns every empresa the current user can access as a client. Includes
 * empresas they own (owner_user_id), are gestor of (raro, pero por completitud),
 * and any empresa they have an active portal_acceso for.
 */
export async function listPortalEmpresas(admin: SupabaseAdmin, userId: string): Promise<PortalEmpresa[]> {
  const [ownedRes, accesosRes] = await Promise.all([
    admin
      .from("empresas")
      .select("id,nombre,nif,account_type,plan,inbox_alias,metadata")
      .or(`owner_user_id.eq.${userId},gestor_id.eq.${userId}`),
    admin
      .from("portal_accesos")
      .select("empresa_id")
      .eq("user_id", userId)
      .eq("estado", "activo"),
  ]);

  const empresas = new Map<string, PortalEmpresa>();
  for (const e of ownedRes.data ?? []) {
    empresas.set(e.id, {
      id: e.id,
      nombre: e.nombre,
      nif: e.nif ?? null,
      account_type: e.account_type ?? null,
      plan: e.plan ?? null,
      inbox_alias: e.inbox_alias ?? null,
      metadata: (e.metadata ?? {}) as Record<string, unknown>,
    });
  }

  const accesoIds = (accesosRes.data ?? []).map((a) => a.empresa_id).filter((id) => !empresas.has(id));
  if (accesoIds.length > 0) {
    const { data: extras } = await admin
      .from("empresas")
      .select("id,nombre,nif,account_type,plan,inbox_alias,metadata")
      .in("id", accesoIds);
    for (const e of extras ?? []) {
      empresas.set(e.id, {
        id: e.id,
        nombre: e.nombre,
        nif: e.nif ?? null,
        account_type: e.account_type ?? null,
        plan: e.plan ?? null,
        inbox_alias: e.inbox_alias ?? null,
        metadata: (e.metadata ?? {}) as Record<string, unknown>,
      });
    }
  }

  return Array.from(empresas.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function ensurePortalAccess(
  admin: SupabaseAdmin,
  userId: string,
  empresaId: string,
): Promise<boolean> {
  const [{ data: profile }, { data: empresa }, { data: acceso }] = await Promise.all([
    admin.from("perfiles").select("rol").eq("id", userId).maybeSingle(),
    admin.from("empresas").select("id,owner_user_id,gestor_id").eq("id", empresaId).maybeSingle(),
    admin
      .from("portal_accesos")
      .select("id")
      .eq("user_id", userId)
      .eq("empresa_id", empresaId)
      .eq("estado", "activo")
      .maybeSingle(),
  ]);

  if (profile?.rol === "admin") return true;
  if (empresa?.owner_user_id === userId) return true;
  if (empresa?.gestor_id === userId) return true;
  return Boolean(acceso);
}
