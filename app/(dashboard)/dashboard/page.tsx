import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { createServerSupabase } from "@/lib/supabase/server";
import { FileSignature, Plus, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [{ count: companyCount }, { count: invoiceCount }, { count: signatureCount }] = await Promise.all([
    supabase.from("empresas").select("*", { count: "exact", head: true }),
    supabase.from("facturas").select("*", { count: "exact", head: true }),
    supabase.from("firma_docs").select("*", { count: "exact", head: true }),
  ]);

  return (
    <AppShell active="/dashboard">
      <header className="topbar">
        <div>
          <div className="eyebrow">Centro de operaciones</div>
          <h1 className="title">Panel gestoría</h1>
          <p className="subtitle">
            Primera versión migrada a Next.js. Desde aquí iremos portando clientes, facturas, documentos, IA y firma con
            permisos reales en Supabase.
          </p>
        </div>
        <button className="button">
          <Plus size={17} />
          Nuevo cliente
        </button>
      </header>

      <section className="grid">
        <StatCard label="Clientes" value={String(companyCount ?? 0)} hint="Empresas visibles por RLS" />
        <StatCard label="Facturas" value={String(invoiceCount ?? 0)} hint="Emitidas y recibidas" />
        <StatCard label="Firmas" value={String(signatureCount ?? 0)} hint="Documentos registrados" />
        <StatCard label="Seguridad" value="RLS" hint="Permisos en base de datos" />

        <article className="card span-8">
          <div className="topbar">
            <div>
              <div className="eyebrow">Migración</div>
              <h2>Prioridades técnicas</h2>
            </div>
            <span className="status">Base lista</span>
          </div>
          <table className="table">
            <tbody>
              <tr>
                <td>Autenticación</td>
                <td>Supabase Auth con cookies SSR</td>
                <td><span className="status">Preparado</span></td>
              </tr>
              <tr>
                <td>Documentos</td>
                <td>Storage privado + rutas firmadas</td>
                <td><span className="status">Preparado</span></td>
              </tr>
              <tr>
                <td>IA</td>
                <td>API route server-side, sin claves en navegador</td>
                <td><span className="status">Preparado</span></td>
              </tr>
            </tbody>
          </table>
        </article>

        <article className="card span-4">
          <ShieldCheck size={28} color="#145c4a" />
          <h2>Nuevo criterio</h2>
          <p className="muted">
            Todo dato sensible debe pasar por Supabase RLS, API routes o Edge Functions. El frontend ya no guarda claves
            privadas ni decide permisos críticos.
          </p>
          <button className="button secondary">
            <FileSignature size={16} />
            Ver flujo de firma
          </button>
        </article>
      </section>
    </AppShell>
  );
}
