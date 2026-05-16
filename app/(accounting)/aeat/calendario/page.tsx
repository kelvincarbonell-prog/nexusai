import { AppShell } from "@/components/app-shell";
import { CalendarioFiscal } from "@/components/aeat/calendario-fiscal";
import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function CalendarioFiscalPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("perfiles").select("rol,nombre").eq("id", auth.user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  const empresasRes = isAdmin
    ? await supabase.from("empresas").select("id,nombre,account_type").order("nombre").limit(200)
    : await supabase
        .from("empresas")
        .select("id,nombre,account_type")
        .or(`gestor_id.eq.${auth.user.id},owner_user_id.eq.${auth.user.id}`)
        .order("nombre");
  const empresas = empresasRes.data ?? [];

  return (
    <AppShell active="/aeat" showSuperAdmin={isAdmin} espacio={{ nombre: profile?.nombre ?? "Mi gestoría", tipo: "AEAT" }}>
      <header style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
        <div>
          <span className="eyebrow">Calendario fiscal · AEAT</span>
          <h1 className="title">Vencimientos por mes</h1>
          <p className="subtitle">Vista anual con todas las obligaciones por modelo, estado y fecha límite.</p>
        </div>
        <div className="button-row">
          <Link href="/aeat" className="button secondary">Volver a modelos</Link>
        </div>
      </header>

      {empresas.length === 0 ? (
        <div className="card span-12">
          <p>No tienes empresas asignadas todavía.</p>
        </div>
      ) : (
        <CalendarioFiscal empresas={empresas} />
      )}
    </AppShell>
  );
}
