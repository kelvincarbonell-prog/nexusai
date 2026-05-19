import { createServerSupabase } from "@/lib/supabase/server";
import { defaultModulos, mergeWithDefaults, type Alcance } from "@/lib/vista-config/catalogo";

/**
 * Carga la config de módulos activos para la gestoría del usuario actual.
 *
 * - alcance=asesor: usa la especialidad del propio asesor (perfiles.especialidad).
 *   Si no la tiene, asume «generalista».
 * - alcance=cliente: única config por gestoría (especialidad = null).
 *
 * Si no hay usuario / gestoría / la tabla aún no existe, devuelve los
 * defaults del catálogo sin romper la página.
 */
export async function loadVistaConfigForCurrentUser(alcance: Alcance): Promise<Record<string, boolean>> {
  try {
    const supabase = await createServerSupabase();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return defaultModulos(alcance);

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre_gestoria,especialidad")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (!perfil?.nombre_gestoria) return defaultModulos(alcance);

    const esp = alcance === "asesor" ? ((perfil.especialidad as string | null) ?? "generalista") : null;

    const baseQ = supabase
      .from("vista_config")
      .select("modulos")
      .eq("nombre_gestoria", perfil.nombre_gestoria)
      .eq("alcance", alcance);
    const filteredQ = esp ? baseQ.eq("especialidad", esp) : baseQ.is("especialidad", null);
    const { data: row } = await filteredQ.maybeSingle();

    return mergeWithDefaults(alcance, (row?.modulos ?? null) as Record<string, boolean> | null);
  } catch {
    return defaultModulos(alcance);
  }
}
