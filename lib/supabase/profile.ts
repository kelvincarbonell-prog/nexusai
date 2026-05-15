import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

export type NexusRole = "admin" | "gestor" | "asesor" | "portal_cliente";

export async function getCurrentProfile() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { user: null, profile: null, supabase };

  const { data: profile } = await supabase
    .from("perfiles")
    .select("id,email,nombre,apellidos,rol,nombre_gestoria")
    .eq("id", auth.user.id)
    .maybeSingle();

  return { user: auth.user, profile, supabase };
}

export function isSuperAdmin(profile: { rol?: string | null } | null) {
  return profile?.rol === "admin";
}

export async function requireSuperAdminFromUser(user: User | null) {
  if (!user) return false;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  return data?.rol === "admin";
}
