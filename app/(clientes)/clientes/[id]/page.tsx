import { createServerSupabase } from "@/lib/supabase/server";
import { TimeTracker } from "@/components/tracking/time-tracker";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${100 - ((v - min) / range) * 100}`)
    .join(" ");
  const lastX = 100;
  const lastY = 100 - ((values[values.length - 1] - min) / range) * 100;
  return (
    <svg className="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" height={220}>
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a0a0a" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0a0a0a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="url(#g)" stroke="none" points={`0,100 ${pts} 100,100`} />
      <polyline fill="none" stroke="var(--ink)" strokeWidth="1.4" points={pts} />
      <line x1="0" y1="60" x2="100" y2="60" stroke="var(--line)" strokeDasharray="1 2" strokeWidth="0.4" />
      <circle cx={lastX} cy={lastY} r="1.6" fill="var(--ink)" />
    </svg>
  );
}

const SIDE_NAV = [
  { id: "resumen", label: "Resumen" },
  { id: "facturacion", label: "Facturación" },
  { id: "iva", label: "IVA & modelos" },
  { id: "nominas", label: "Nóminas" },
  { id: "bancos", label: "Bancos" },
  { id: "contratos", label: "Contratos" },
  { id: "documentos", label: "Documentos" },
  { id: "firmas", label: "Cl@ve & firmas" },
  { id: "auditoria", label: "Auditoría" },
];

const OBLIGACIONES = [
  { code: "M303", name: "IVA · 2T 2026", state: "Borrador listo", when: "20·07·2026 (en 65d)", progress: 100, amount: "€ 4.230", ready: true },
  { code: "M111", name: "Retenciones · 2T", state: "Sincronizando", when: "20·07·2026 (en 65d)", progress: 60, amount: "€ 1.840", ready: false },
  { code: "M115", name: "Retenciones alquileres", state: "Sin movimientos", when: "20·07·2026 (en 65d)", progress: 30, amount: "€ 0", ready: false },
  { code: "M232", name: "Operaciones vinculadas", state: "Programado", when: "30·11·2026 (en 198d)", progress: 10, amount: "—", ready: false },
];

export default async function ClienteDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: empresa } = await supabase.from("empresas").select("*").eq("id", id).maybeSingle();
  if (!empresa) notFound();

  const sidebar = (
    <aside className="sidebar">
      <Link href="/dashboard" className="sb-brand" aria-label="Inicio">
        <span className="sb-brand-mark">N</span>
        <span>M26</span>
      </Link>

      <div className="sb-section">
        <span className="sb-eyebrow">Viendo</span>
        <div className="sb-card">
          <div className="sb-card-title">
            <span className="avatar" aria-hidden="true">{empresa.nombre?.[0]?.toUpperCase() ?? "C"}</span>
            <div style={{ display: "grid", gap: 2 }}>
              <span>{empresa.nombre}</span>
              <small>{empresa.nif ?? "—"} · {empresa.account_type === "autonomo" ? "Autónomo" : "Empresa"}</small>
            </div>
          </div>
          <div className="sb-card-meta">
            <span className="pill warn">33/100</span>
            <span className="pill plain">Carlos R.</span>
          </div>
        </div>
      </div>

      <nav className="sb-nav">
        {SIDE_NAV.map((item, i) => (
          <a key={item.id} href={`#${item.id}`} className={i === 0 ? "active" : undefined}>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      <div className="sb-foot">
        <span className="sb-eyebrow">Bancos</span>
        <span>● Santander · <strong>4m</strong></span>
        <span>● BBVA · <strong>4m</strong></span>
        <span>● Holvi · <strong>reauth</strong></span>
      </div>
    </aside>
  );

  const main = (
    <main className="main">
      <div className="topbar" style={{ alignItems: "flex-start" }}>
        <div className="crumbs">
          <span>despacho</span><span>/</span><span>clientes</span><span>/</span><strong>{empresa.nombre}</strong>
        </div>
        <div className="button-row">
          <button className="button secondary">Chat cliente</button>
          <button className="button secondary">↓ Q2 PDF</button>
          <button className="button">+ Nueva factura</button>
        </div>
      </div>

      <header style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
        <div className="sb-brand-mark" aria-hidden="true" style={{ width: 64, height: 64, borderRadius: 12, fontSize: 22 }}>
          {empresa.nombre?.[0]?.toUpperCase() ?? "C"}
        </div>
        <div style={{ display: "grid", gap: 12, flex: 1 }}>
          <h1 className="title" style={{ fontSize: 44 }}>
            {empresa.nombre} <em>{empresa.account_type === "autonomo" ? "Autónomo" : "S.L."}</em>
          </h1>
          <div className="button-row">
            <span className="pill warn">salud 33 · C</span>
            <span className="pill plain">CNAE 6201 · software</span>
            <span className="pill plain">alta {empresa.created_at ? new Date(empresa.created_at).toLocaleDateString("es-ES") : "—"}</span>
            <span className="pill dark">plan {empresa.plan ?? "negocio +"}</span>
          </div>
        </div>
      </header>

      <section className="grid" id="resumen">
        <article className="card span-3">
          <span className="card-eyebrow">Saldo SEPA</span>
          <div className="metric"><span className="sym">€</span>47.821</div>
          <div className="metric-foot good">+€12.340 · 90d</div>
        </article>
        <article className="card span-3">
          <span className="card-eyebrow">Pendiente cobro</span>
          <div className="metric"><span className="sym">€</span>23.405</div>
          <div className="metric-foot warn">4 facturas · 1 vencida</div>
        </article>
        <article className="card span-3">
          <span className="card-eyebrow">Facturado YTD</span>
          <div className="metric"><span className="sym">€</span>184.520</div>
          <div className="metric-foot plain"><span className="pill dark">meta 320k · 58%</span></div>
        </article>
        <article className="card span-3">
          <span className="card-eyebrow">IS estimado</span>
          <div className="metric"><span className="sym">€</span>10.322</div>
          <div className="metric-foot plain">sobre resultado 41.290</div>
        </article>
      </section>

      <section className="chart-wrap" id="cashflow">
        <div className="chart-head">
          <div>
            <strong style={{ fontSize: 16 }}>Pulso del negocio</strong>
            <div className="muted" style={{ fontFamily: "var(--mono)", fontSize: 12, marginTop: 4 }}>Cashflow real + predicción IA · 90d</div>
          </div>
          <div className="chart-tabs">
            <button className="active">cashflow</button>
            <button>runway</button>
            <button>margen</button>
          </div>
        </div>
        <Sparkline values={[20, 22, 26, 30, 32, 34, 38, 40, 42, 44, 46, 47]} />
        <div className="chart-legend">
          <span>— real</span>
          <span>— predicción · 30d</span>
          <span style={{ marginLeft: "auto", fontFamily: "var(--mono)" }}>€ 47.821 hoy</span>
        </div>
      </section>

      <section className="card" id="iva">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <strong style={{ fontSize: 16 }}>Modelos y obligaciones · Q2</strong>
          <span className="pill plain">3 en curso · 1 listo</span>
        </div>
        <div>
          {OBLIGACIONES.map((o) => (
            <div key={o.code} className="obli-row">
              <span className="code">{o.code}</span>
              <div className="name">
                <strong>{o.name}</strong>
                <small>{o.state}</small>
              </div>
              <span className="when">{o.when}</span>
              <div className="bar"><span style={{ ["--p" as never]: `${o.progress}%` } as React.CSSProperties} /></div>
              <span className="num">{o.amount}</span>
              <button className="button compact" aria-label={`Acción ${o.code}`} style={{ padding: "6px 10px" }}>
                {o.ready ? "✓" : "→"}
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );

  const copilot = (
    <aside className="copilot" aria-label="Copiloto IA">
      <div className="copilot-head">
        <div>
          <strong style={{ fontFamily: "var(--mono)", fontSize: 13 }}>Copiloto · {empresa.nombre?.split(" ")[0]}</strong>
          <div className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>conoce 412 docs · 24 facturas</div>
        </div>
        <span className="pill dark">activo</span>
      </div>

      <div className="copilot-card strong">
        <span className="card-eyebrow bad">Riesgo detectado</span>
        <p>3 facturas con IVA inusual vs. patrón histórico. Probable reverse charge mal aplicado en Globant.</p>
        <div className="button-row">
          <button className="button compact">Revisar las 3</button>
          <button className="button secondary compact">Ignorar</button>
        </div>
      </div>

      <div className="copilot-card">
        <span className="card-eyebrow">Sugiero redactar</span>
        <p>Email de reclamación a Singular Bank — factura <strong>#0228</strong> vencida 32 días.</p>
        <div className="copilot-quote">«Hola Daniel, te recuerdo el cobro de la factura #0228 (3.180 €), vencida desde el 14·04. ¿Quedamos en pago esta semana? Gracias.»</div>
        <div className="button-row">
          <button className="button compact">Enviar</button>
          <button className="button secondary compact">Editar</button>
        </div>
      </div>

      <div className="copilot-card">
        <span className="card-eyebrow">Pregunta · cliente</span>
        <div className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>Carlos en WhatsApp · martes</div>
        <p style={{ fontStyle: "italic" }}>«¿Puedo deducir la cena con el inversor de Barcelona?»</p>
        <p><strong>Mi respuesta:</strong> sí, deducible parcialmente como atención (Art. 14 LIS). Necesita factura + nota explicativa adjunta.</p>
        <div className="button-row">
          <button className="button compact">Responder</button>
          <button className="button secondary compact">Pedir factura</button>
        </div>
      </div>

      <div className="copilot-input">
        <div className="copilot-chips">
          <span className="pill plain">¿deducciones perdidas?</span>
          <span className="pill plain">previsión Q3</span>
        </div>
        <input className="input" placeholder="Pregunta o pide algo… ⌘ + ⏎ para ejecutar" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="button ghost compact">+ archivo</button>
            <button className="button ghost compact">● voz</button>
          </div>
          <button className="button compact">Ejecutar ⌘↵</button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="shell with-copilot">
      <TimeTracker empresaId={id} />
      {sidebar}
      {main}
      {copilot}
    </div>
  );
}
