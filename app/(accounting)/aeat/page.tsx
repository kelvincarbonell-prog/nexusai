import { AppShell } from "@/components/app-shell";
import { Casillas303 } from "@/components/aeat/casillas-303";
import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function AeatPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("perfiles").select("rol,nombre").eq("id", auth.user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  const empresasRes = isAdmin
    ? await supabase.from("empresas").select("id,nombre,nif").order("nombre").limit(200)
    : await supabase
        .from("empresas")
        .select("id,nombre,nif")
        .or(`gestor_id.eq.${auth.user.id},owner_user_id.eq.${auth.user.id}`)
        .order("nombre");
  const empresas = empresasRes.data ?? [];

  return (
    <AppShell active="/contabilidad" showSuperAdmin={isAdmin} espacio={{ nombre: profile?.nombre ?? "Mi gestoría", tipo: "AEAT" }}>
      <header style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
        <div>
          <span className="eyebrow">Modelos AEAT</span>
          <h1 className="title">
            <span className="brand-text">Modelo 26</span> presenta por ti.
          </h1>
          <p className="subtitle">
            Cálculo en vivo del 303 a partir de tus facturas y gastos. Próximamente 390, 111, 115 y 130 — todos con
            exportación de fichero AEAT lista para sede.agenciatributaria.gob.es.
          </p>
        </div>
        <div className="button-row">
          <Link href="/contabilidad" className="button secondary">Volver a contabilidad</Link>
        </div>
      </header>

      {empresas.length === 0 ? (
        <div className="card span-12">
          <span className="card-eyebrow">Vacío</span>
          <h2 className="title" style={{ fontSize: 22, marginTop: 4 }}>Aún no tienes empresas</h2>
          <p className="muted" style={{ marginTop: 6 }}>Crea una desde el dashboard para empezar a usar los modelos AEAT.</p>
          <div className="button-row" style={{ marginTop: 12 }}>
            <Link href="/dashboard?view=clientes" className="button">+ Añadir empresa</Link>
          </div>
        </div>
      ) : (
        <Casillas303 empresas={empresas} />
      )}
    </AppShell>
  );
}
