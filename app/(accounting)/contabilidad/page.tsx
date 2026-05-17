import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { JournalEntryForm } from "@/components/accounting/journal-entry-form";
import { CierreAperturaPanel } from "@/components/accounting/cierre-apertura-panel";
import { AutoAsientosPanel } from "@/components/accounting/auto-asientos-panel";
import { StatCard } from "@/components/stat-card";
import { getAccountingOverview } from "@/lib/accounting/queries";
import { getCurrentProfile, isSuperAdmin } from "@/lib/supabase/profile";
import { BookOpen, Landmark, Scale } from "lucide-react";

function eur(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

export default async function AccountingPage() {
  const { user, profile } = await getCurrentProfile();
  if (!user) redirect("/login");

  const data = await getAccountingOverview(user.id);

  return (
    <AppShell active="/contabilidad" showSuperAdmin={isSuperAdmin(profile)}>
      <header className="topbar">
        <div>
          <div className="eyebrow">Plan General Contable</div>
          <h1 className="title">Contabilidad 360</h1>
          <p className="subtitle">
            Plan de cuentas, diario, mayor, sumas y saldos, pérdidas y ganancias, balance, conciliación bancaria,
            inmovilizado, amortizaciones y libros de IVA.
          </p>
        </div>
      </header>

      <section className="grid">
        <StatCard label="Debe" value={eur(data.totals.debit)} hint="Total registrado en diario" />
        <StatCard label="Haber" value={eur(data.totals.credit)} hint="Debe cuadrar con el debe" />
        <StatCard label="Resultado" value={eur(data.totals.result)} hint="Ingresos menos gastos" />
        <StatCard label="Cuentas" value={String(data.accounts.length)} hint="PGC base + personalizadas" />

        {!data.selectedCompany ? (
          <article className="card span-12">
            <h2>No hay empresa seleccionable</h2>
            <p className="muted">Crea una empresa o autónomo antes de activar el módulo contable.</p>
          </article>
        ) : (
          <>
            <JournalEntryForm empresaId={data.selectedCompany.id} accounts={data.accounts} />

            <article className="card span-6">
              <div className="topbar">
                <div>
                  <div className="eyebrow">Diario</div>
                  <h2>Últimos asientos</h2>
                </div>
                <BookOpen size={20} aria-hidden="true" />
              </div>
              <table className="table">
                <caption className="sr-only">Últimos asientos contables</caption>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.length === 0 ? (
                    <tr>
                      <td colSpan={3}>Todavía no hay asientos registrados.</td>
                    </tr>
                  ) : data.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.entry_date}</td>
                      <td>{entry.description}</td>
                      <td><span className="status">{entry.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>

            <article className="card span-6">
              <div className="topbar">
                <div>
                  <div className="eyebrow">Balance</div>
                  <h2>Sumas y saldos</h2>
                </div>
                <Scale size={20} aria-hidden="true" />
              </div>
              <table className="table">
                <caption className="sr-only">Balance de sumas y saldos</caption>
                <thead>
                  <tr>
                    <th>Cuenta</th>
                    <th>Nombre</th>
                    <th>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trialBalance.length === 0 ? (
                    <tr>
                      <td colSpan={3}>Sin saldos contables todavía.</td>
                    </tr>
                  ) : data.trialBalance.slice(0, 12).map((row) => (
                    <tr key={row.code}>
                      <td>{row.code}</td>
                      <td>{row.name}</td>
                      <td>{eur(row.debit - row.credit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>

            <article className="card span-4">
              <Landmark size={26} color="#145c4a" aria-hidden="true" />
              <h2>Conciliación bancaria</h2>
              <p className="muted">Base preparada para importar Norma 43, CAMT.053 o CSV y casar movimientos con asientos.</p>
            </article>
            <AutoAsientosPanel empresaId={data.selectedCompany.id} />
            <CierreAperturaPanel empresaId={data.selectedCompany.id} defaultEjercicio={new Date().getUTCFullYear() - 1} />
            <article className="card span-4">
              <BookOpen size={26} color="#145c4a" aria-hidden="true" />
              <h2>Libros de IVA</h2>
              <p className="muted">Estructura preparada para IVA soportado, repercutido y modelos tributarios.</p>
            </article>
          </>
        )}
      </section>
    </AppShell>
  );
}
