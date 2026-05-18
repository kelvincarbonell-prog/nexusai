import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { UpcomingObligations } from "@/components/dashboard/upcoming-obligations";
import { TareasWidget } from "@/components/dashboard/tareas-widget";
import { OnboardingWizard } from "@/components/dashboard/onboarding-wizard";
import { CarteraClientes } from "@/components/dashboard/cartera-clientes";
import { PendingActions } from "@/components/dashboard/pending-actions";
import { SetupRequired } from "@/components/setup-required";
import { hasSupabaseConfig } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type DashboardPageProps = {
  searchParams?: Promise<{ view?: string }>;
};

const TIMELINE = [
  { time: "20:08", text: "Concilié 47 movimientos SEPA · 8 clientes", tag: "auto" },
  { time: "19:42", text: "Detecté factura duplicada · Sastrería Pons #0094", tag: "flag" },
  { time: "18:30", text: "Envié recordatorio de cobro · Singular Bank #0228", tag: "auto" },
  { time: "17:15", text: "Generé borrador M303 · Reditorial", tag: "ready" },
  { time: "16:01", text: "Importé 23 facturas vía email · Innova Apps", tag: "auto" },
  { time: "14:22", text: "Tipo IVA inusual en 3 facturas · Globant", tag: "flag" },
  { time: "11:08", text: "Presenté M111 retenciones Q1 · AEAT confirmó", tag: "done" },
  { time: "09:30", text: "Onboardé «Marc López» desde su Cl@ve", tag: "auto" },
];

function tagPill(tag: string) {
  const cls = tag === "flag" ? "pill warn" : tag === "ready" ? "pill good" : tag === "done" ? "pill dark" : "pill";
  return <span className={cls}>{tag}</span>;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

function Sparkline({ values, color = "var(--ink)" }: { values: number[]; color?: string }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${100 - ((v - min) / range) * 100}`)
    .join(" ");
  return (
    <svg className="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" height={80}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} />
    </svg>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  if (!hasSupabaseConfig()) {
    const missing: string[] = [];
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    return <SetupRequired missing={missing} />;
  }
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const params = searchParams ? await searchParams : {};
  const activeView = params.view ?? "panel";

  // Paralelo: perfil + count empresas + 12 primeras empresas (todo en una sola tanda).
  const [{ data: profile }, { count: companyCount }, empresasRes] = await Promise.all([
    supabase.from("perfiles").select("rol,nombre,metadata").eq("id", auth.user.id).maybeSingle(),
    supabase.from("empresas").select("*", { count: "exact", head: true }),
    supabase.from("empresas").select("id,nombre,nif,plan,account_type").order("nombre").limit(12),
  ]);

  const onboardingDone = Boolean((profile?.metadata as Record<string, unknown> | null)?.onboarding_done);
  const showOnboarding = !onboardingDone && (companyCount ?? 0) === 0;

  // Clientes finales (rol portal_cliente) ven directamente su portal.
  if (profile?.rol === "portal_cliente") redirect("/portal");

  const empresas = empresasRes.data ?? [];
  const isAdmin = profile?.rol === "admin";
  const firstName = profile?.nombre?.split(" ")[0];

  return (
    <AppShell
      active="/dashboard"
      showSuperAdmin={isAdmin}
      espacio={{ nombre: profile?.nombre ?? "Mi despacho", tipo: isAdmin ? "super admin" : "despacho", personas: 4 }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 760 }}>
          <span className="eyebrow">
            {greeting()}{firstName ? `, ${firstName}` : ""}
          </span>
          <h1 className="display">
            Esta semana <span className="brand-text">M26</span> te ha ahorrado <em>31 h 12 m</em>.
          </h1>
          <p className="subtitle">
            Tienes 5 cosas listas para firmar. Todo lo demás corre solo. Pulsa <span className="kbd">?</span> en cualquier
            tarjeta para ver el razonamiento.
          </p>
        </div>
        <div className="button-row" style={{ alignItems: "flex-start", marginTop: 24 }}>
          <Link href="/aeat" className="button secondary">Modelos AEAT</Link>
          <Link href="/solicitudes" className="button">Bandeja de solicitudes →</Link>
        </div>
      </header>

      {showOnboarding ? (
        <section className="grid">
          <OnboardingWizard userName={profile?.nombre ?? undefined} />
        </section>
      ) : null}

      <PendingActions />

      <section className="grid">
        <UpcomingObligations empresas={empresas} />
        <TareasWidget />

        <article className="card span-5">
          <div className="topbar" style={{ border: 0, padding: 0, margin: 0 }}>
            <span className="card-eyebrow">Honorarios YTD</span>
            <div className="chart-tabs">
              <button className="active">3M</button>
              <button>YTD</button>
              <button>12M</button>
            </div>
          </div>
          <div className="metric">€ 84.620</div>
          <div className="metric-foot good">+14% vs 2025 &nbsp;·&nbsp; meta Q4 · € 180k</div>
          <Sparkline values={[40, 44, 50, 48, 55, 60, 64, 70, 73, 78, 80, 84]} />
        </article>

        <article className="card span-12">
          <div className="topbar" style={{ border: 0, padding: 0, margin: 0 }}>
            <div>
              <span className="card-eyebrow">Copiloto en vivo</span>
              <div className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>Acciones ejecutadas por la IA · 24h</div>
            </div>
            <button className="button ghost compact">ver todo</button>
          </div>
          <div className="timeline">
            {TIMELINE.map((row) => (
              <div className="timeline-row" key={row.time}>
                <span className="timeline-time">{row.time}</span>
                <span>{row.text}</span>
                {tagPill(row.tag)}
              </div>
            ))}
          </div>
        </article>

        <CarteraClientes initialCount={companyCount ?? empresas.length} />
        {activeView !== "panel" ? (
          <p className="muted span-12" style={{ marginTop: 0, fontSize: 13 }}>
            Vista activa: <strong>{activeView}</strong> — pulsa en un cliente para abrir su ficha.
          </p>
        ) : null}
      </section>
    </AppShell>
  );
}
