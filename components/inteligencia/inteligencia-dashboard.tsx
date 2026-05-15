"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type KPIs = {
  total_clientes: number;
  autonomos: number;
  empresas: number;
  ingresos_ytd: number;
  gastos_ytd: number;
  pendiente_cobro: number;
  acciones_30d: number;
};
type TopCliente = { id: string; nombre: string; facturado: number; account_type: string | null; plan: string | null };
type Tiempo = { empresa_id: string; nombre: string; num_acciones: number; minutos_estimados: number };
type Alerta = { tipo: string; severidad: "info" | "warn" | "bad"; mensaje: string };
type DistPlan = { plan: string; count: number };

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function InteligenciaDashboard() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [top, setTop] = useState<TopCliente[]>([]);
  const [tiempo, setTiempo] = useState<Tiempo[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [distPlan, setDistPlan] = useState<DistPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const tk = session.session?.access_token ?? "";
        const res = await fetch("/api/inteligencia", { headers: { Authorization: `Bearer ${tk}` } });
        const json = await res.json();
        if (json.ok) {
          setKpis(json.kpis);
          setTop(json.top_clientes ?? []);
          setTiempo(json.tiempo_por_cliente ?? []);
          setAlertas(json.alertas ?? []);
          setDistPlan(json.distribucion_plan ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p className="muted">Calculando inteligencia de tu cartera…</p>;
  if (!kpis) return <p className="muted">Sin datos todavía.</p>;

  const totalTiempo = tiempo.reduce((s, t) => s + t.minutos_estimados, 0);
  const maxTiempo = Math.max(1, ...tiempo.map((t) => t.minutos_estimados));
  const maxFacturado = Math.max(1, ...top.map((t) => t.facturado));

  return (
    <section className="grid">
      <article className="card span-3 intel-kpi" style={{ animationDelay: "0ms" }}>
        <span className="card-eyebrow">Cartera</span>
        <div className="metric">{kpis.total_clientes}</div>
        <div className="metric-foot plain">{kpis.autonomos} autónomos · {kpis.empresas} empresas</div>
      </article>
      <article className="card span-3 intel-kpi" style={{ animationDelay: "80ms" }}>
        <span className="card-eyebrow">Ingresos YTD</span>
        <div className="metric accent">{EUR(kpis.ingresos_ytd)}</div>
        <div className="metric-foot accent">{kpis.acciones_30d} acciones IA · 30d</div>
      </article>
      <article className="card span-3 intel-kpi" style={{ animationDelay: "160ms" }}>
        <span className="card-eyebrow">Pendiente cobro</span>
        <div className="metric" style={{ color: kpis.pendiente_cobro > 0 ? "var(--warn)" : "var(--muted)" }}>
          {EUR(kpis.pendiente_cobro)}
        </div>
        <div className="metric-foot warn">a perseguir</div>
      </article>
      <article className="card span-3 intel-kpi" style={{ animationDelay: "240ms" }}>
        <span className="card-eyebrow">Gastos YTD</span>
        <div className="metric">{EUR(kpis.gastos_ytd)}</div>
        <div className="metric-foot plain">margen bruto: {EUR(kpis.ingresos_ytd - kpis.gastos_ytd)}</div>
      </article>

      {/* Alertas */}
      {alertas.length > 0 ? (
        <article className="card span-12 intel-alertas" style={{ animationDelay: "320ms" }}>
          <span className="card-eyebrow">🚨 Necesitan tu atención</span>
          <div className="alertas-grid" style={{ marginTop: 8 }}>
            {alertas.map((a, i) => (
              <div key={i} className={`alerta-card alerta-${a.severidad}`}>
                <span className="pulse-dot" style={{ background: a.severidad === "bad" ? "var(--bad)" : a.severidad === "warn" ? "var(--warn)" : "var(--accent)" }} />
                <span>{a.mensaje}</span>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {/* Top clientes por valor */}
      <article className="card span-7 intel-block" style={{ animationDelay: "400ms" }}>
        <span className="card-eyebrow">Top clientes por facturación</span>
        <div className="intel-bars" style={{ marginTop: 12 }}>
          {top.length === 0 ? <p className="muted">Sin facturas todavía.</p> : top.map((c, i) => (
            <div key={c.id} className="intel-bar-row" style={{ animationDelay: `${i * 50 + 500}ms` }}>
              <div className="intel-bar-label">
                <strong>{c.nombre}</strong>
                <small className="muted">{c.account_type === "autonomo" ? "Autónomo" : "Empresa"} · {c.plan ?? "negocio"}</small>
              </div>
              <div className="intel-bar-track">
                <span style={{ width: `${(c.facturado / maxFacturado) * 100}%` }} />
              </div>
              <div className="intel-bar-value">{EUR(c.facturado)}</div>
            </div>
          ))}
        </div>
      </article>

      {/* Tiempo por cliente */}
      <article className="card span-5 intel-block" style={{ animationDelay: "480ms" }}>
        <span className="card-eyebrow">Tiempo dedicado · últimos 30 días</span>
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Estimado de acciones del gestor + IA. Total: <strong style={{ color: "var(--ink)" }}>{Math.floor(totalTiempo / 60)}h {totalTiempo % 60}m</strong>
        </p>
        <div className="intel-bars" style={{ marginTop: 12 }}>
          {tiempo.length === 0 ? <p className="muted">Sin actividad registrada.</p> : tiempo.slice(0, 8).map((t, i) => (
            <div key={t.empresa_id} className="intel-bar-row" style={{ animationDelay: `${i * 50 + 600}ms` }}>
              <div className="intel-bar-label">
                <strong>{t.nombre}</strong>
                <small className="muted">{t.num_acciones} acciones</small>
              </div>
              <div className="intel-bar-track">
                <span style={{ width: `${(t.minutos_estimados / maxTiempo) * 100}%`, background: "linear-gradient(90deg, #b794f4, #67e8f9)" }} />
              </div>
              <div className="intel-bar-value">{t.minutos_estimados} min</div>
            </div>
          ))}
        </div>
      </article>

      {/* Distribución por plan */}
      <article className="card span-12 intel-block" style={{ animationDelay: "560ms" }}>
        <span className="card-eyebrow">Distribución por plan</span>
        <div className="intel-pills" style={{ marginTop: 12 }}>
          {distPlan.map((d) => (
            <span key={d.plan} className="pill" style={{ fontSize: 13, padding: "8px 14px" }}>
              <strong style={{ fontSize: 16, marginRight: 8 }}>{d.count}</strong> {d.plan}
            </span>
          ))}
        </div>
      </article>

      {/* Resumen IA */}
      <article className="card span-12 glow-border intel-block" style={{ animationDelay: "640ms" }}>
        <span className="card-eyebrow">🧠 Análisis del agente</span>
        <h3 style={{ marginTop: 8, fontSize: 18 }}>
          {kpis.pendiente_cobro > kpis.ingresos_ytd * 0.2
            ? "Tu ratio de cobro está por debajo de lo óptimo."
            : kpis.acciones_30d < kpis.total_clientes * 2
              ? "Algunos clientes llevan tiempo sin actividad."
              : "Cartera saludable. Buen ritmo."}
        </h3>
        <p style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: "var(--ink-soft)" }}>
          {kpis.pendiente_cobro > kpis.ingresos_ytd * 0.2 ? (
            <>Tienes <strong>{EUR(kpis.pendiente_cobro)}</strong> pendiente de cobro sobre <strong>{EUR(kpis.ingresos_ytd)}</strong> facturados. Considera activar recordatorios automáticos y revisar las facturas vencidas.</>
          ) : kpis.acciones_30d < kpis.total_clientes * 2 ? (
            <>De tus <strong>{kpis.total_clientes}</strong> clientes, solo <strong>{tiempo.filter((t) => t.num_acciones > 0).length}</strong> han tenido actividad en los últimos 30 días. Reactiva los inactivos con un email o llamada.</>
          ) : (
            <>Has hecho <strong>{kpis.acciones_30d}</strong> acciones en 30 días sobre <strong>{kpis.total_clientes}</strong> clientes activos. Ingresos YTD <strong>{EUR(kpis.ingresos_ytd)}</strong>, margen bruto <strong>{EUR(kpis.ingresos_ytd - kpis.gastos_ytd)}</strong>.</>
          )}
        </p>
      </article>
    </section>
  );
}
