import { createServerSupabase } from "@/lib/supabase/server";
import { defaultModulos, mergeWithDefaults, type Alcance } from "@/lib/vista-config/catalogo";

/**
 * Carga la config de módulos activos para la gestoría del usuario actual.
 * Si no hay usuario o gestoría, devuelve los defaults del catálogo.
 *
 * Pensado para ser llamado desde Server Components (AppShell, layouts).
 */
export async function loadVistaConfigForCurrentUser(alcance: Alcance): Promise<Record<string, boolean>> {
  try {
    const supabase = await createServerSupabase();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return defaultModulos(alcance);

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre_gestoria")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (!perfil?.nombre_gestoria) return defaultModulos(alcance);

    const { data: row } = await supabase
      .from("vista_config")
      .select("modulos")
      .eq("nombre_gestoria", perfil.nombre_gestoria)
      .eq("alcance", alcance)
      .maybeSingle();
    return mergeWithDefaults(alcance, (row?.modulos ?? null) as Record<string, boolean> | null);
  } catch {
    return defaultModulos(alcance);
  }
}
