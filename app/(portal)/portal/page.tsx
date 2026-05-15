import { AppShell } from "@/components/app-shell";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PortalPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { count: documentsCount } = await supabase.from("documentos").select("*", { count: "exact", head: true });

  return (
    <AppShell active="/portal">
      <header>
        <div className="eyebrow">Portal cliente</div>
        <h1 className="title">Tu espacio de cliente</h1>
        <p className="subtitle">
          Esta pantalla sustituirá progresivamente `legacy/portalclientes`. La base ya consulta Supabase desde servidor.
        </p>
      </header>
      <section className="grid">
        <article className="card span-4">
          <div className="eyebrow">Documentos</div>
          <div className="metric">{documentsCount ?? 0}</div>
          <p className="muted">Documentos visibles para el cliente autenticado.</p>
        </article>
        <article className="card span-8">
          <h2>Próximo bloque a migrar</h2>
          <p className="muted">
            Facturas, solicitudes, documentos y chat se moverán a componentes separados con consultas tipadas y políticas
            RLS por empresa.
          </p>
        </article>
      </section>
    </AppShell>
  );
}
