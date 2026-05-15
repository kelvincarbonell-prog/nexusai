import { AppShell } from "@/components/app-shell";
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
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const params = searchParams ? await searchParams : {};
  const activeView = params.view ?? "panel";

  const [{ data: profile }, { count: companyCount }] = await Promise.all([
    supabase.from("perfiles").select("rol,nombre").eq("id", auth.user.id).maybeSingle(),
    supabase.from("empresas").select("*", { count: "exact", head: true }),
  ]);

  const empresasRes = await supabase
    .from("empresas")
    .select("id,nombre,nif,plan")
    .order("nombre")
    .limit(12);
  const empresas = empresasRes.data ?? [];
  const isAdmin = profile?.rol === "admin";

  return (
    <AppShell
      active="/dashboard"
      showSuperAdmin={isAdmin}
      espacio={{ nombre: "Gabinete M26", tipo: "despacho", personas: 4 }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 760 }}>
          <span className="eyebrow">Buenas noches{profile?.nombre ? `, ${profile.nombre}` : ""} · 0 cosas urgentes</span>
          <h1 className="display">
            Esta semana M26 te ha ahorrado <em>31 h 12 m</em>.
          </h1>
          <p className="subtitle">
            Tienes 5 cosas listas para firmar. Todo lo demás corre solo. Pulsa <span className="kbd">?</span> en cualquier
            tarjeta para ver el razonamiento.
          </p>
        </div>
        <div className="button-row" style={{ alignItems: "flex-start", marginTop: 24 }}>
          <button className="button secondary">Modo silencio</button>
          <button className="button">Firmar las 5 →</button>
        </div>
      </header>

      <section className="action-row">
        <article className="action-card">
          <div className="head"><span className="pill">IVA · 2T</span><span>99%</span></div>
          <strong>Innova Apps S.L.</strong>
          <small className="muted">Modelo 303</small>
          <div className="amount">€ 4.230</div>
          <div className="delta">+12% vs 1T</div>
          <button className="button compact" style={{ justifyContent: "center", marginTop: "auto" }}>Firmar</button>
        </article>
        <article className="action-card">
          <div className="head"><span className="pill">Nóminas</span><span>98%</span></div>
          <strong>Reditorial Iberia</strong>
          <small className="muted">Marzo · 12 emp.</small>
          <div className="amount">€ 38.420</div>
          <div className="delta">variables OK</div>
          <button className="button compact" style={{ justifyContent: "center", marginTop: "auto" }}>Firmar</button>
        </article>
        <article className="action-card">
          <div className="head"><span className="pill">IRPF</span><span>99%</span></div>
          <strong>J. Romero</strong>
          <small className="muted">Modelo 130 1T</small>
          <div className="amount">€ 912</div>
          <div className="delta">+18% vs 1T·25</div>
          <button className="button compact" style={{ justifyContent: "center", marginTop: "auto" }}>Firmar</button>
        </article>
        <article className="action-card">
          <div className="head"><span className="pill warn">Atención</span><span>—</span></div>
          <strong>Vertical Studio</strong>
          <small className="muted">M115 vencido</small>
          <div className="delta">hace 1 día</div>
          <button className="button secondary compact" style={{ justifyContent: "center", marginTop: "auto" }}>Resolver</button>
        </article>
        <article className="action-card">
          <div className="head"><span className="pill good">Propongo</span><span>auto</span></div>
          <strong>+2 nuevos clientes</strong>
          <small className="muted">desde Cl@ve</small>
          <div className="amount">+€840/mes</div>
          <div className="delta">onboarding listo</div>
          <button className="button secondary compact" style={{ justifyContent: "center", marginTop: "auto" }}>Revisar</button>
        </article>
      </section>

      <section className="grid">
        <article className="card span-7">
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
              <span className="card-eyebrow">Cartera</span>
              <strong style={{ fontSize: 18 }}>{companyCount ?? empresas.length} clientes</strong>
            </div>
            <div className="button-row">
              <span className="pill good">al día · 12</span>
              <span className="pill warn">atención · 3</span>
              <span className="pill bad">crítico · 1</span>
            </div>
          </div>
          <div className="client-grid">
            {empresas.length === 0
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="client-card">
                    <strong>—</strong>
                    <small>sin datos</small>
                    <div className="health">— <small>/100</small></div>
                  </div>
                ))
              : empresas.map((e) => (
                  <a key={e.id} href={`/clientes/${e.id}`} className="client-card">
                    <strong>{e.nombre}</strong>
                    <small>{e.nif ?? "—"}</small>
                    <div className="health">{Math.floor(Math.random() * 60 + 40)} <small>/100</small></div>
                  </a>
                ))}
          </div>
          {activeView !== "panel" ? (
            <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
              Vista activa: <strong>{activeView}</strong> — pulsa en un cliente para abrir su ficha.
            </p>
          ) : null}
        </article>
      </section>
    </AppShell>
  );
}
