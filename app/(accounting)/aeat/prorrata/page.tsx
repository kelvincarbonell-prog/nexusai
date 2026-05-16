import { AppShell } from "@/components/app-shell";
import { ProrrataCalculator } from "@/components/aeat/prorrata-calculator";
import { createServerSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ProrrataPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("perfiles").select("rol,nombre").eq("id", auth.user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  return (
    <AppShell active="/aeat" showSuperAdmin={isAdmin} espacio={{ nombre: profile?.nombre ?? "Mi gestoría", tipo: "AEAT" }}>
      <header style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
        <div>
          <span className="eyebrow">Calculadora · Prorrata IVA</span>
          <h1 className="title">Cuánto IVA puedes deducirte</h1>
          <p className="subtitle">
            Cálculo automático de prorrata general y especial. Aplicable a sujetos con operaciones mixtas (con y sin
            derecho a deducir).
          </p>
        </div>
        <div className="button-row">
          <Link href="/aeat" className="button secondary">Volver a modelos</Link>
        </div>
      </header>
      <ProrrataCalculator />
    </AppShell>
  );
}
