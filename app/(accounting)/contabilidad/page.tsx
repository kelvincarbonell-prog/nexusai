import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { JournalEntryForm } from "@/components/accounting/journal-entry-form";
import { ContabilidadMulti } from "@/components/accounting/contabilidad-multi";
import { StatCard } from "@/components/stat-card";
import { getAccountingOverview } from "@/lib/accounting/queries";
import { getCurrentProfile, isSuperAdmin } from "@/lib/supabase/profile";
import { createServerSupabase } from "@/lib/supabase/server";

function eur(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

export default async function AccountingPage() {
  const { user, profile } = await getCurrentProfile();
  if (!user) redirect("/login");

  const data = await getAccountingOverview(user.id);

  // Lista completa de empresas que el gestor puede ver, para el selector.
  const supabase = await createServerSupabase();
  const isAdmin = isSuperAdmin(profile);
  const empresasRes = isAdmin
    ? await supabase.from("empresas").select("id,nombre,nif").order("nombre").limit(500)
    : await supabase
        .from("empresas")
        .select("id,nombre,nif")
        .or(`gestor_id.eq.${user.id},owner_user_id.eq.${user.id}`)
        .order("nombre");
  const empresas = empresasRes.data ?? [];

  return (
    <AppShell active="/contabilidad" showSuperAdmin={isAdmin}>
      <header className="topbar">
        <div>
          <div className="eyebrow">Plan General Contable · todos los clientes</div>
          <h1 className="title">Contabilidad 360</h1>
          <p className="subtitle">
            Selecciona el cliente y trabaja su diario, mayor, sumas y saldos, PyG, balance, libro de IVA,
            asientos automáticos y cierre. Todo por empresa, no compartido.
          </p>
        </div>
      </header>

      <section className="grid">
        <StatCard label="Debe" value={eur(data.totals.debit)} hint="Total registrado en diario (primer cliente)" />
        <StatCard label="Haber" value={eur(data.totals.credit)} hint="Debe cuadrar con el debe" />
        <StatCard label="Resultado" value={eur(data.totals.result)} hint="Ingresos menos gastos" />
        <StatCard label="Clientes" value={String(empresas.length)} hint="Total con contabilidad activa" />

        {!data.selectedCompany || empresas.length === 0 ? (
          <article className="card span-12">
            <h2>No hay empresa seleccionable</h2>
            <p className="muted">Crea una empresa o autónomo antes de activar el módulo contable.</p>
          </article>
        ) : (
          <article className="card span-12" style={{ display: "grid", gap: 16 }}>
            <ContabilidadMulti empresas={empresas} initialId={data.selectedCompany.id} />
            <JournalEntryForm empresaId={data.selectedCompany.id} accounts={data.accounts} />
          </article>
        )}
      </section>
    </AppShell>
  );
}
