import { createSupabaseAdmin } from "@/lib/supabase/admin";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;

export async function canAccessAccountingCompany(admin: SupabaseAdmin, userId: string, empresaId: string) {
  const [{ data: profile }, { data: company }, { data: portalAccess }] = await Promise.all([
    admin.from("perfiles").select("rol").eq("id", userId).maybeSingle(),
    admin.from("empresas").select("id,gestor_id,owner_user_id").eq("id", empresaId).maybeSingle(),
    admin
      .from("portal_accesos")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("user_id", userId)
      .eq("estado", "activo")
      .maybeSingle(),
  ]);

  return (
    profile?.rol === "admin" ||
    company?.gestor_id === userId ||
    company?.owner_user_id === userId ||
    Boolean(portalAccess)
  );
}
