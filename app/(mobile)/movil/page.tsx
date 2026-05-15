import { MobileHome } from "@/components/mobile/mobile-home";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function MovilPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("perfiles").select("rol").eq("id", auth.user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  let empresas: { id: string; nombre: string; nif?: string; inbox_alias?: string }[] = [];
  if (isAdmin) {
    const { data } = await supabase.from("empresas").select("id,nombre,nif,inbox_alias").order("nombre").limit(50);
    empresas = data ?? [];
  } else {
    const [{ data: managed }, { data: owned }, { data: portal }] = await Promise.all([
      supabase.from("empresas").select("id,nombre,nif,inbox_alias").eq("gestor_id", auth.user.id),
      supabase.from("empresas").select("id,nombre,nif,inbox_alias").eq("owner_user_id", auth.user.id),
      supabase
        .from("portal_accesos")
        .select("empresas(id,nombre,nif,inbox_alias)")
        .eq("user_id", auth.user.id)
        .eq("estado", "activo"),
    ]);
    const map = new Map<string, { id: string; nombre: string; nif?: string; inbox_alias?: string }>();
    for (const list of [managed ?? [], owned ?? []]) for (const r of list) map.set(r.id, r);
    for (const entry of portal ?? []) {
      const emp = (entry as { empresas?: { id: string; nombre: string; nif?: string; inbox_alias?: string } | { id: string; nombre: string; nif?: string; inbox_alias?: string }[] }).empresas;
      const c = Array.isArray(emp) ? emp[0] : emp;
      if (c && "id" in c) map.set(c.id, c);
    }
    empresas = [...map.values()];
  }

  return <MobileHome empresas={empresas} />;
}
