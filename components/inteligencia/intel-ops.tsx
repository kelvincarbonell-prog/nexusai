"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  TrendingUp, TrendingDown, AlertOctagon, Eye, Flame, Sparkles, Building2, ShieldAlert, Banknote, ArrowUpRight,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Resp = {
  ok: boolean;
  vacio?: boolean;
  total_empresas?: number;
  top_facturacion: Array<{ empresa_id: string; nombre: string; facturacion: number }>;
  top_margen: Array<{ empresa_id: string; nombre: string; margen_pct: number; margen: number }>;
  top_crecimiento: Array<{ empresa_id: string; nombre: string; crecimiento_pct: number; prev: number; actual: number }>;
  top_riesgo: Array<{ empresa_id: string; nombre: string; score: number; alertas_danger: number; categoria: string }>;
  morosos_persistentes: Array<{ empresa_id: string; nombre: string; contacto: string; total: number; recordatorios: number }>;
  patrones_sospechosos: Array<{ empresa_id: string; nombre: string; total: number; fecha: string; razon: string }>;
  hot_zones: Array<{ empresa_id: string; nombre: string; alertas: number }>;
  oportunidades_upsell: Array<{ empresa_id: string; nombre: string; facturacion: number; plan_actual: string }>;
  mapa_sectores: Array<{ cnae: string; count: number }>;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function IntelOps() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/inteligencia/ops", { headers: { Authorization: `Bearer ${tk}` } });
      const j = await res.json();
      if (alive) {
        setData(j);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [supabase]);

  if (loading) {
    return <div className="card span-12" style={{ padding: 16, fontSize: 13, opacity: 0.7 }}>Cargando inteligencia de la cartera…</div>;
  }
  if (!data || data.vacio || data.total_empresas === 0) {
    return null;
  }

  return (
    <>
      {/* Header de mando */}
      <article className="card span-12" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, transparent), transparent)", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Sparkles size={20} color="var(--accent)" />
          <div>
            <span className="card-eyebrow">Centro de Inteligencia</span>
            <h2 style={{ margin: "2px 0 0", fontSize: 18 }}>Visión completa de tu cartera</h2>
          </div>
          <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.75 }}>{data.total_empresas} empresas analizadas</span>
        </div>
      </article>

      {/* Top facturación */}
      <Block icon={<TrendingUp size={14} />} eyebrow="Top facturación YTD" titulo="Tus mejores clientes por ingresos">
        <Lista items={data.top_facturacion.map((x) => ({
          id: x.empresa_id,
          nombre: x.nombre,
          right: EUR(x.facturacion),
          rightColor: "#10b981",
        }))} />
      </Block>

      {/* Top margen */}
      <Block icon={<Banknote size={14} />} eyebrow="Top margen" titulo="Quién más rentabilidad te trae">
        <Lista items={data.top_margen.map((x) => ({
          id: x.empresa_id,
          nombre: x.nombre,
          right: `${x.margen_pct}% · ${EUR(x.margen)}`,
          rightColor: x.margen_pct >= 0 ? "#10b981" : "#ef4444",
        }))} />
      </Block>

      {/* Top crecimiento */}
      <Block icon={<ArrowUpRight size={14} />} eyebrow="Top crecimiento" titulo="Clientes que más crecen vs año anterior">
        <Lista items={data.top_crecimiento.map((x) => ({
          id: x.empresa_id,
          nombre: x.nombre,
          right: `${x.crecimiento_pct > 0 ? "+" : ""}${x.crecimiento_pct}%`,
          rightColor: x.crecimiento_pct >= 0 ? "#10b981" : "#ef4444",
          sub: `${EUR(x.prev)} → ${EUR(x.actual)}`,
        }))} />
      </Block>

      {/* Top riesgo */}
      <Block icon={<ShieldAlert size={14} />} eyebrow="Alerta de inspección AEAT" titulo="Más vigilados ahora" tone="warn">
        {data.top_riesgo.length === 0
          ? <Vacio mensaje="Nadie en estado crítico ahora mismo." />
          : <Lista items={data.top_riesgo.map((x) => ({
              id: x.empresa_id,
              nombre: x.nombre,
              right: `${x.alertas_danger} alertas urgentes`,
              rightColor: "#ef4444",
              sub: `Score ${x.score}/100 · ${x.categoria}`,
            }))} />
        }
      </Block>

      {/* Morosos persistentes */}
      <Block icon={<AlertOctagon size={14} />} eyebrow="Morosos persistentes" titulo="3+ recordatorios sin pagar" tone="bad">
        {data.morosos_persistentes.length === 0
          ? <Vacio mensaje="Sin morosos persistentes. Buena disciplina de cobros." />
          : <Lista items={data.morosos_persistentes.slice(0, 6).map((x) => ({
              id: x.empresa_id,
              nombre: `${x.nombre} · ${x.contacto}`,
              right: EUR(x.total),
              rightColor: "#ef4444",
              sub: `${x.recordatorios} recordatorios sin éxito`,
            }))} />
        }
      </Block>

      {/* Patrones atípicos */}
      <Block icon={<Eye size={14} />} eyebrow="Patrones atípicos" titulo="Operaciones que merecen revisión" tone="warn">
        {data.patrones_sospechosos.length === 0
          ? <Vacio mensaje="Sin patrones inusuales detectados." />
          : <Lista items={data.patrones_sospechosos.slice(0, 6).map((x) => ({
              id: x.empresa_id,
              nombre: x.nombre,
              right: EUR(x.total),
              sub: x.razon,
            }))} />
        }
      </Block>

      {/* Hot zones */}
      <Block icon={<Flame size={14} />} eyebrow="Hot zones" titulo="Empresas con más alertas activas">
        {data.hot_zones.length === 0
          ? <Vacio mensaje="Todo bajo control." />
          : <Lista items={data.hot_zones.map((x) => ({
              id: x.empresa_id,
              nombre: x.nombre,
              right: `${x.alertas} alertas`,
              rightColor: "#f59e0b",
            }))} />
        }
      </Block>

      {/* Upsell */}
      <Block icon={<TrendingUp size={14} />} eyebrow="Oportunidades de upsell" titulo="En plan free con alta actividad" tone="ok">
        {data.oportunidades_upsell.length === 0
          ? <Vacio mensaje="Sin candidatos a upsell ahora mismo." />
          : <Lista items={data.oportunidades_upsell.map((x) => ({
              id: x.empresa_id,
              nombre: x.nombre,
              right: `${EUR(x.facturacion)} · plan ${x.plan_actual}`,
              rightColor: "#10b981",
              sub: "Sugerencia: ofrecer plan profesional.",
            }))} />
        }
      </Block>

      {/* Mapa sectores */}
      <Block icon={<Building2 size={14} />} eyebrow="Mapa por sector" titulo="Distribución de tu cartera por CNAE">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
          {data.mapa_sectores.map((s) => (
            <div key={s.cnae} style={{ padding: 8, borderRadius: 8, background: "color-mix(in srgb, currentColor 6%, transparent)", textAlign: "center" }}>
              <div style={{ fontFamily: "var(--mono, monospace)", fontSize: 12, opacity: 0.7 }}>CNAE {s.cnae}</div>
              <strong style={{ fontSize: 16 }}>{s.count}</strong>
            </div>
          ))}
        </div>
      </Block>
    </>
  );
}

function Block({ icon, eyebrow, titulo, tone, children }: { icon: React.ReactNode; eyebrow: string; titulo: string; tone?: "ok" | "warn" | "bad"; children: React.ReactNode }) {
  const border = tone === "warn" ? "color-mix(in srgb, #f59e0b 30%, transparent)" : tone === "bad" ? "color-mix(in srgb, #ef4444 30%, transparent)" : tone === "ok" ? "color-mix(in srgb, #10b981 30%, transparent)" : undefined;
  return (
    <article className="card span-6" style={border ? { borderColor: border } : undefined}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {icon}
        <span className="card-eyebrow">{eyebrow}</span>
      </div>
      <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>{titulo}</h3>
      {children}
    </article>
  );
}

function Vacio({ mensaje }: { mensaje: string }) {
  return <p style={{ margin: 0, fontSize: 12, opacity: 0.65 }}>{mensaje}</p>;
}

function Lista({ items }: { items: Array<{ id: string; nombre: string; right: string; rightColor?: string; sub?: string }> }) {
  if (items.length === 0) return <Vacio mensaje="Sin datos." />;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
      {items.map((it, i) => (
        <li key={`${it.id}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, background: "color-mix(in srgb, currentColor 4%, transparent)" }}>
          <Link href={`/clientes/${it.id}`} style={{ flex: 1, minWidth: 0, color: "inherit", textDecoration: "none" }}>
            <strong style={{ fontSize: 13, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.nombre}</strong>
            {it.sub && <small style={{ fontSize: 11, opacity: 0.65 }}>{it.sub}</small>}
          </Link>
          <span style={{ fontSize: 12, fontWeight: 700, color: it.rightColor ?? "inherit", whiteSpace: "nowrap" }}>{it.right}</span>
        </li>
      ))}
    </ul>
  );
}
