import { AppShell } from "@/components/app-shell";
import { AeatWorkspace } from "@/components/aeat/aeat-workspace";
import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

type Props = { searchParams?: Promise<{ modelo?: string }> };

export default async function AeatPage({ searchParams }: Props) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const params = searchParams ? await searchParams : {};
  const modelo = (params.modelo ?? "303") as "303" | "111" | "115" | "130";

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
    <AppShell active="/aeat" showSuperAdmin={isAdmin} espacio={{ nombre: profile?.nombre ?? "Mi gestoría", tipo: "AEAT" }}>
      <header style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
        <div>
          <span className="eyebrow">Modelos AEAT</span>
          <h1 className="title">
            <span className="brand-text">M26</span> presenta por ti.
          </h1>
          <p className="subtitle">
            Cálculo en vivo a partir de tus facturas, gastos y nóminas. Borradores, fichero AEAT y trazabilidad
            completa de cada presentación.
          </p>
        </div>
        <div className="button-row">
          <Link href="/aeat/calendario" className="button secondary">Calendario fiscal</Link>
          <Link href="/aeat/prorrata" className="button secondary">Prorrata IVA</Link>
          <Link href="/contabilidad" className="button secondary">Contabilidad</Link>
        </div>
      </header>

      {empresas.length === 0 ? (
        <div className="card span-12">
          <span className="card-eyebrow">Vacío</span>
          <h2 className="title" style={{ fontSize: 22, marginTop: 4 }}>Aún no tienes empresas</h2>
          <p className="muted" style={{ marginTop: 6 }}>Crea una desde el dashboard para empezar.</p>
          <div className="button-row" style={{ marginTop: 12 }}>
            <Link href="/dashboard?view=clientes" className="button">+ Añadir empresa</Link>
          </div>
        </div>
      ) : (
        <AeatWorkspace empresas={empresas} initialModelo={modelo} />
      )}
    </AppShell>
  );
}
