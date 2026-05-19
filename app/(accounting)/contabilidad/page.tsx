import Link from "next/link";
import { redirect } from "next/navigation";
import { Scale, ArrowDown, ArrowUp, TrendingUp, Building2, FileCheck2, BookOpen } from "lucide-react";
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

  const cuadra = Math.abs(data.totals.debit - data.totals.credit) < 0.01;
  const resultadoTono: "ok" | "bad" | "neutral" = data.totals.result > 0 ? "ok" : data.totals.result < 0 ? "bad" : "neutral";

  return (
    <AppShell active="/contabilidad" showSuperAdmin={isAdmin}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "baseline" }}>
        <div>
          <span className="eyebrow">Plan General Contable</span>
          <h1 className="title" style={{ fontSize: 28, margin: "4px 0 0" }}>Contabilidad 360</h1>
          <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
            Diario, mayor, balances, libro IVA, conciliación y cierre · todos los clientes en un solo sitio.
          </p>
        </div>
        <div className="button-row" style={{ alignItems: "center" }}>
          <Link href="/aeat" className="button secondary compact">Modelos AEAT</Link>
          <Link href="/aeat/calendario" className="button compact">Calendario fiscal →</Link>
        </div>
      </header>

      <section className="grid">
        <StatCard
          label="Debe"
          value={eur(data.totals.debit)}
          hint={cuadra ? "Cuadra con haber ✓" : "⚠ No cuadra con haber"}
          Icon={ArrowDown}
          tono={cuadra ? "neutral" : "warn"}
        />
        <StatCard
          label="Haber"
          value={eur(data.totals.credit)}
          hint={cuadra ? "Asientos balanceados" : "Revisa los asientos"}
          Icon={ArrowUp}
          tono={cuadra ? "neutral" : "warn"}
        />
        <StatCard
          label="Resultado"
          value={eur(data.totals.result)}
          hint={data.totals.result >= 0 ? "Ingresos > gastos" : "Pérdidas en el ejercicio"}
          Icon={TrendingUp}
          tono={resultadoTono}
        />
        <StatCard
          label="Clientes"
          value={String(empresas.length)}
          hint="Con contabilidad activa"
          Icon={Building2}
          tono="neutral"
        />
      </section>

      {!data.selectedCompany || empresas.length === 0 ? (
        <section className="grid">
          <article className="card span-12" style={{ display: "grid", gap: 10, placeItems: "center", textAlign: "center", padding: 32 }}>
            <BookOpen size={36} strokeWidth={1.5} color="var(--muted)" />
            <h2 style={{ margin: 0, fontSize: 18 }}>No hay empresa seleccionable</h2>
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Crea una empresa o autónomo antes de activar el módulo contable.
            </p>
            <Link href="/dashboard" className="button compact" style={{ marginTop: 6 }}>
              Ir al dashboard →
            </Link>
          </article>
        </section>
      ) : (
        <>
          <ContabilidadMulti empresas={empresas} initialId={data.selectedCompany.id} />
          <article className="card" style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileCheck2 size={16} color="var(--accent)" />
              <span className="card-eyebrow" style={{ margin: 0 }}>Nuevo asiento manual</span>
            </div>
            <JournalEntryForm empresaId={data.selectedCompany.id} accounts={data.accounts} />
          </article>
        </>
      )}
    </AppShell>
  );
}
