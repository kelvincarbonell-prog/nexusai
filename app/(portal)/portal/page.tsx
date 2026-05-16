import { AppShell } from "@/components/app-shell";
import { ClienteWorkspace } from "@/components/clientes/cliente-workspace";
import { SetupRequired } from "@/components/setup-required";
import { hasSupabaseConfig } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { listPortalEmpresas } from "@/lib/portal/access";
import { redirect } from "next/navigation";
import Link from "next/link";

type Props = { searchParams?: Promise<{ empresa?: string }> };

export default async function PortalPage({ searchParams }: Props) {
  if (!hasSupabaseConfig()) {
    return <SetupRequired missing={["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter((v) => !process.env[v])} />;
  }
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("perfiles").select("rol,nombre").eq("id", auth.user.id).maybeSingle();

  const admin = createSupabaseAdmin();
  const empresas = await listPortalEmpresas(admin, auth.user.id);

  if (empresas.length === 0) {
    return (
      <AppShell active="/portal" espacio={{ nombre: profile?.nombre ?? "Mi portal", tipo: "Cliente" }}>
        <header style={{ marginBottom: 20 }}>
          <span className="eyebrow">Portal cliente</span>
          <h1 className="title">Aún no tienes empresa asignada</h1>
          <p className="subtitle">Tu asesor todavía no te ha dado acceso a ninguna empresa.</p>
        </header>
        <article className="card span-12">
          <p style={{ marginTop: 12 }}>
            Si tienes dudas, contacta con tu gestoría. Cuando te asignen una empresa podrás:
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 20, fontSize: 14, lineHeight: 1.7 }}>
            <li>Subir facturas y procesarlas con OCR automático.</li>
            <li>Ver tus modelos AEAT, IVA y resultados estimados.</li>
            <li>Consultar nóminas, contratos y tu calendario laboral.</li>
            <li>Descargar todos los PDF firmados (Modelo 145, finiquitos, contratos).</li>
          </ul>
        </article>
      </AppShell>
    );
  }

  const sp = searchParams ? await searchParams : {};
  const empresaIdParam = sp.empresa;
  const empresa = empresas.find((e) => e.id === empresaIdParam) ?? empresas[0];

  return (
    <AppShell
      active="/portal"
      espacio={{ nombre: profile?.nombre ?? empresa.nombre, tipo: "Mi portal" }}
    >
      {empresas.length > 1 ? (
        <div className="card span-12" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <span className="card-eyebrow">Tienes acceso a {empresas.length} empresas</span>
            <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {empresas.map((e) => (
                <Link
                  key={e.id}
                  href={`/portal?empresa=${e.id}`}
                  className={`button compact ${e.id === empresa.id ? "" : "secondary"}`}
                >
                  {e.nombre}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <ClienteWorkspace empresa={empresa} />
    </AppShell>
  );
}
