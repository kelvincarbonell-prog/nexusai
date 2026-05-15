import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function SelfServeHomePage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/autonomos-empresas/login");

  const { data: profile } = await supabase.from("perfiles").select("id").eq("id", auth.user.id).maybeSingle();
  if (!profile) {
    await supabase.from("perfiles").insert({
      id: auth.user.id,
      email: auth.user.email ?? "",
      nombre: String(auth.user.user_metadata?.name ?? ""),
      rol: "portal_cliente",
    });
  }

  const { data: existingCompanies } = await supabase
    .from("empresas")
    .select("id")
    .eq("owner_user_id", auth.user.id)
    .limit(1);

  if ((existingCompanies ?? []).length === 0 && auth.user.user_metadata?.business_name) {
    await supabase.from("empresas").insert({
      owner_user_id: auth.user.id,
      razon_social: String(auth.user.user_metadata.business_name),
      nif: String(auth.user.user_metadata.nif ?? ""),
      account_type: String(auth.user.user_metadata.account_type ?? "empresa"),
      onboarding_source: "self_serve",
      estado: "activo",
    });
  }

  const { data: companies } = await supabase
    .from("empresas")
    .select("id,razon_social,nif,cliente_slug,account_type,onboarding_source,estado")
    .eq("owner_user_id", auth.user.id)
    .limit(10);

  return (
    <AppShell active="/autonomos-empresas">
      <header className="topbar">
        <div>
          <div className="eyebrow">Autónomos y empresas</div>
          <h1 className="title">Tu panel independiente</h1>
          <p className="subtitle">
            Vista inicial para usuarios que usan NexusAI directamente, sin depender de una gestoría.
          </p>
        </div>
        <Link href="/portal" className="button secondary">Ir al portal</Link>
      </header>
      <section className="grid">
        <article className="card span-12">
          <h2>Mis entidades</h2>
          <table className="table">
            <tbody>
              {(companies ?? []).map((company) => (
                <tr key={company.id}>
                  <td>{company.cliente_slug || company.id.slice(0, 8)}</td>
                  <td>{company.nif}</td>
                  <td>{company.account_type}</td>
                  <td><span className="status">{company.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      </section>
    </AppShell>
  );
}
