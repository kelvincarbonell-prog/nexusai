import { AppShell } from "@/components/app-shell";
import { BillingWorkspace } from "@/components/billing/billing-workspace";
import { SetupRequired } from "@/components/setup-required";
import { hasSupabaseConfig } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

type Props = { searchParams?: Promise<{ tab?: string }> };

export const metadata = { title: "Facturación · Modelo 26" };

export default async function FacturacionPage({ searchParams }: Props) {
  if (!hasSupabaseConfig()) {
    return <SetupRequired missing={["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter((v) => !process.env[v])} />;
  }

  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const params = searchParams ? await searchParams : {};
  const initial = (params.tab as "facturas" | "presupuestos" | "recurrentes" | undefined) ?? "facturas";

  const { data: profile } = await supabase.from("perfiles").select("rol,nombre").eq("id", auth.user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  const empresasRes = isAdmin
    ? await supabase.from("empresas").select("id,nombre").order("nombre").limit(200)
    : await supabase
        .from("empresas")
        .select("id,nombre")
        .or(`gestor_id.eq.${auth.user.id},owner_user_id.eq.${auth.user.id}`)
        .order("nombre");
  const empresas = empresasRes.data ?? [];

  return (
    <AppShell active="/facturacion" showSuperAdmin={isAdmin} espacio={{ nombre: profile?.nombre ?? "Mi gestoría", tipo: "Facturación" }}>
      <header style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
        <div>
          <span className="eyebrow">Facturación</span>
          <h1 className="title">
            Cobros, <span className="brand-text">presupuestos</span> y recurrentes.
          </h1>
          <p className="subtitle">
            Genera presupuestos, conviértelos en factura, automatiza cuotas mensuales y cobra con un enlace Stripe Checkout.
          </p>
        </div>
        <div className="button-row">
          <Link href="/aeat" className="button secondary">Modelos AEAT</Link>
          <Link href="/contabilidad" className="button secondary">Contabilidad</Link>
        </div>
      </header>

      {empresas.length === 0 ? (
        <div className="card span-12">
          <span className="card-eyebrow">Vacío</span>
          <h2 className="title" style={{ fontSize: 22, marginTop: 4 }}>Aún no tienes empresas</h2>
          <p className="muted" style={{ marginTop: 6 }}>Crea una desde el dashboard para empezar a facturar.</p>
          <div className="button-row" style={{ marginTop: 12 }}>
            <Link href="/dashboard" className="button">+ Añadir empresa</Link>
          </div>
        </div>
      ) : (
        <BillingWorkspace empresas={empresas} initial={initial} />
      )}
    </AppShell>
  );
}
