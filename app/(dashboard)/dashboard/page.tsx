import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { createServerSupabase } from "@/lib/supabase/server";
import { FileSignature, Plus, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

type DashboardPageProps = {
  searchParams?: Promise<{ view?: string }>;
};

const viewCopy: Record<string, { eyebrow: string; title: string; body: string }> = {
  clientes: {
    eyebrow: "Clientes",
    title: "Gestión de clientes",
    body: "Acceso rápido a autónomos, empresas, portal cliente y altas independientes. El CRUD completo de gestoría será el siguiente bloque funcional.",
  },
  facturas: {
    eyebrow: "Facturas",
    title: "Facturación y gastos",
    body: "Resumen de facturas emitidas, recibidas y preparación para automatizar asientos contables, IVA y modelos fiscales.",
  },
  firma: {
    eyebrow: "Firmas",
    title: "Firma documental",
    body: "Flujo preparado para documentos privados, descarga segura y trazabilidad de firma.",
  },
  equipo: {
    eyebrow: "Equipo",
    title: "Equipo gestor",
    body: "Vista de trabajo para asesores, permisos, roles y reparto de tareas dentro de la gestoría.",
  },
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const params = searchParams ? await searchParams : {};
  const activeView = params.view && viewCopy[params.view] ? params.view : "panel";
  const view = activeView === "panel" ? null : viewCopy[activeView];

  const [{ count: companyCount }, { count: invoiceCount }, { count: signatureCount }] = await Promise.all([
    supabase.from("empresas").select("*", { count: "exact", head: true }),
    supabase.from("facturas").select("*", { count: "exact", head: true }),
    supabase.from("firma_docs").select("*", { count: "exact", head: true }),
  ]);

  return (
    <AppShell active={activeView === "panel" ? "/dashboard" : `/dashboard?view=${activeView}`}>
      <header className="topbar">
        <div>
          <div className="eyebrow">Centro de operaciones</div>
          <h1 className="title">Panel gestoría</h1>
          <p className="subtitle">
            Primera versión migrada a Next.js. Desde aquí iremos portando clientes, facturas, documentos, IA y firma con
            permisos reales en Supabase.
          </p>
        </div>
        <Link className="button" href="/autonomos-empresas/registro">
          <Plus size={17} aria-hidden="true" />
          Nuevo cliente
        </Link>
      </header>

      <section className="grid">
        <StatCard label="Clientes" value={String(companyCount ?? 0)} hint="Empresas visibles por RLS" />
        <StatCard label="Facturas" value={String(invoiceCount ?? 0)} hint="Emitidas y recibidas" />
        <StatCard label="Firmas" value={String(signatureCount ?? 0)} hint="Documentos registrados" />
        <StatCard label="Seguridad" value="RLS" hint="Permisos en base de datos" />

        {view ? (
          <article className="card span-12" id={activeView}>
            <div className="eyebrow">{view.eyebrow}</div>
            <h2>{view.title}</h2>
            <p className="muted">{view.body}</p>
            <div className="button-row">
              <Link className="button secondary" href="/contabilidad">Ir a contabilidad</Link>
              <Link className="button secondary" href="/portal">Abrir portal cliente</Link>
            </div>
          </article>
        ) : null}

        <article className="card span-8">
          <div className="topbar">
            <div>
              <div className="eyebrow">Migración</div>
              <h2>Prioridades técnicas</h2>
            </div>
            <span className="status">Base lista</span>
          </div>
          <table className="table">
            <caption className="sr-only">Prioridades técnicas de migración</caption>
            <thead>
              <tr>
                <th>Área</th>
                <th>Estado técnico</th>
                <th>Preparación</th>
              </tr>
            </thead>
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
          <ShieldCheck size={28} color="#145c4a" aria-hidden="true" />
          <h2>Nuevo criterio</h2>
          <p className="muted">
            Todo dato sensible debe pasar por Supabase RLS, API routes o Edge Functions. El frontend ya no guarda claves
            privadas ni decide permisos críticos.
          </p>
          <Link className="button secondary" href="/dashboard?view=firma">
            <FileSignature size={16} aria-hidden="true" />
            Ver flujo de firma
          </Link>
        </article>
      </section>
    </AppShell>
  );
}
