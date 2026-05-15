import { redirect } from "next/navigation";
import Link from "next/link";
import { Bot, FileText, Settings, Shield } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { AgentManager } from "@/components/super-admin/agent-manager";
import { DirectoryManager } from "@/components/super-admin/directory-manager";
import { SettingsManager } from "@/components/super-admin/settings-manager";
import { getAgentConfigs, getSuperAdminDirectory, getSuperAdminMetrics } from "@/lib/super-admin";
import { getCurrentProfile, isSuperAdmin } from "@/lib/supabase/profile";

export default async function SuperAdminPage() {
  const { user, profile } = await getCurrentProfile();
  if (!user) redirect("/login");
  if (!isSuperAdmin(profile)) redirect("/dashboard");

  const [metrics, agents, directory] = await Promise.all([
    getSuperAdminMetrics(),
    getAgentConfigs(),
    getSuperAdminDirectory(),
  ]);

  return (
    <AppShell active="/super-admin" showSuperAdmin>
      <header className="topbar">
        <div>
          <div className="eyebrow">Super Admin</div>
          <h1 className="title">Centro de control NexusAI</h1>
          <p className="subtitle">
            Control global de gestores, clientes, autónomos, empresas independientes, agentes, configuración y métricas.
          </p>
        </div>
        <Link className="button" href="#settings">
          <Settings size={17} aria-hidden="true" />
          Configuración
        </Link>
      </header>

      <section className="grid">
        <StatCard label="Gestores" value={String(metrics.gestores)} hint="Usuarios gestores y asesores" />
        <StatCard label="Clientes" value={String(metrics.clientes)} hint="Autónomos y empresas totales" />
        <StatCard label="Independientes" value={String(metrics.independientes)} hint="Sin gestoría vinculada" />
        <StatCard label="Agentes" value={String(metrics.agentes)} hint="Normas configurables" />

        <article className="card span-4">
          <Shield size={28} color="#145c4a" aria-hidden="true" />
          <h2>Configuraciones críticas</h2>
          <p className="muted">
            Revisa RLS, Storage privado, claves IA, dominios, onboarding independiente, límites de uso y auditoría.
          </p>
        </article>
        <article className="card span-4">
          <FileText size={28} color="#145c4a" aria-hidden="true" />
          <h2>Documentos y firma</h2>
          <p className="muted">
            Métricas actuales: {metrics.documentos} documentos y {metrics.firmas} firmas registradas.
          </p>
        </article>
        <article className="card span-4">
          <Bot size={28} color="#145c4a" aria-hidden="true" />
          <h2>Agentes operativos</h2>
          <p className="muted">Fiscal, laboral, seguridad, QA, SEO, UX, performance, DevOps y Supabase/RLS.</p>
        </article>

        <AgentManager initialAgents={agents} />

        <SettingsManager settings={directory.settings} />
        <DirectoryManager profiles={directory.profiles} companies={directory.companies} />
      </section>
    </AppShell>
  );
}
