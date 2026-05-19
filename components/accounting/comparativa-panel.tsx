"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, ArrowRight, BarChart3, Users, Building2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Top = { nombre: string; total: number };
type Metricas = {
  label: string;
  facturado: number;
  gastos: number;
  iva_repercutido: number;
  iva_soportado: number;
  iva_neto: number;
  margen: number;
  margen_pct: number;
  n_facturas: number;
  n_recibidas: number;
  top_clientes: Top[];
  top_proveedores: Top[];
};
type Delta = { abs: number; pct: number | null };
type Comparativa = {
  ok: boolean;
  periodo: "mes" | "trimestre" | "anyo";
  actual: Metricas;
  anterior: Metricas;
  yoy: Metricas;
  deltas: {
    facturado_vs_prev: Delta;
    facturado_vs_yoy: Delta;
    gastos_vs_prev: Delta;
    gastos_vs_yoy: Delta;
    margen_vs_prev: Delta;
    margen_vs_yoy: Delta;
  };
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const EUR2 = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function ComparativaPanel({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const today = new Date();
  const defaultRef = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;

  const [periodo, setPeriodo] = useState<"mes" | "trimestre" | "anyo">("mes");
  const [ref, setRef] = useState(defaultRef);
  const [data, setData] = useState<Comparativa | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const tk = sess.session?.access_token ?? "";
        const url = `/api/accounting/informes/comparativa?empresa_id=${empresaId}&periodo=${periodo}&ref=${encodeURIComponent(ref)}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "Error");
        if (alive) setData(json as Comparativa);
      } catch (e: unknown) {
        if (alive) setError(e instanceof Error ? e.message : "Error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [empresaId, periodo, ref, supabase]);

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <BarChart3 size={18} />
        <h3 style={{ margin: 0 }}>Informe comparativo</h3>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as "mes" | "trimestre" | "anyo")}
            style={selectStyle}
          >
            <option value="mes">Mes</option>
            <option value="trimestre">Trimestre</option>
            <option value="anyo">Año</option>
          </select>
          <input
            type="month"
            value={ref}
            onChange={(e) => setRef(e.target.value || defaultRef)}
            style={selectStyle}
            aria-label="Periodo de referencia"
          />
        </div>
      </header>

      {loading && <div style={{ fontSize: 13, opacity: 0.7 }}>Cargando comparativa…</div>}
      {error && (
        <div style={{ padding: 10, borderRadius: 8, background: "#ef444412", border: "1px solid #ef444455", color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <KpiCard
              titulo="Facturado"
              actual={data.actual.facturado}
              labelActual={data.actual.label}
              vsPrev={data.deltas.facturado_vs_prev}
              vsYoy={data.deltas.facturado_vs_yoy}
              labelPrev={data.anterior.label}
              labelYoy={data.yoy.label}
            />
            <KpiCard
              titulo="Gastos"
              actual={data.actual.gastos}
              labelActual={data.actual.label}
              vsPrev={data.deltas.gastos_vs_prev}
              vsYoy={data.deltas.gastos_vs_yoy}
              labelPrev={data.anterior.label}
              labelYoy={data.yoy.label}
              invertColors
            />
            <KpiCard
              titulo={`Margen (${data.actual.margen_pct}%)`}
              actual={data.actual.margen}
              labelActual={data.actual.label}
              vsPrev={data.deltas.margen_vs_prev}
              vsYoy={data.deltas.margen_vs_yoy}
              labelPrev={data.anterior.label}
              labelYoy={data.yoy.label}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <MiniCard titulo="IVA repercutido" valor={EUR2(data.actual.iva_repercutido)} />
            <MiniCard titulo="IVA soportado" valor={EUR2(data.actual.iva_soportado)} />
            <MiniCard
              titulo="IVA neto"
              valor={EUR2(data.actual.iva_neto)}
              tono={data.actual.iva_neto > 0 ? "warning" : "ok"}
              sub={data.actual.iva_neto > 0 ? "a ingresar" : "a compensar/devolver"}
            />
            <MiniCard titulo="Nº facturas emitidas" valor={String(data.actual.n_facturas)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            <TopList icon={<Users size={14} />} titulo="Top 5 clientes" items={data.actual.top_clientes} />
            <TopList icon={<Building2 size={14} />} titulo="Top 5 proveedores" items={data.actual.top_proveedores} />
          </div>
        </>
      )}
    </section>
  );
}

function KpiCard({
  titulo,
  actual,
  labelActual,
  vsPrev,
  vsYoy,
  labelPrev,
  labelYoy,
  invertColors,
}: {
  titulo: string;
  actual: number;
  labelActual: string;
  vsPrev: Delta;
  vsYoy: Delta;
  labelPrev: string;
  labelYoy: string;
  invertColors?: boolean;
}) {
  return (
    <div style={{ padding: 14, borderRadius: 12, border: "1px solid var(--line, #e5e7eb)", background: "var(--panel, #fff)", display: "grid", gap: 8 }}>
      <span style={{ fontSize: 12, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.5 }}>{titulo}</span>
      <strong style={{ fontSize: 22 }}>{EUR(actual)}</strong>
      <span style={{ fontSize: 11, opacity: 0.6 }}>{labelActual}</span>
      <DeltaRow label={`vs ${labelPrev}`} delta={vsPrev} invertColors={invertColors} />
      <DeltaRow label={`vs ${labelYoy}`} delta={vsYoy} invertColors={invertColors} />
    </div>
  );
}

function DeltaRow({ label, delta, invertColors }: { label: string; delta: Delta; invertColors?: boolean }) {
  const positive = delta.abs >= 0;
  const isGood = invertColors ? !positive : positive;
  const color = delta.abs === 0 ? "var(--muted, #6b7280)" : isGood ? "#10b981" : "#ef4444";
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
      <span style={{ opacity: 0.6, minWidth: 90 }}>{label}</span>
      <Icon size={12} color={color} />
      <span style={{ color, fontWeight: 600 }}>
        {delta.pct === null ? "—" : `${delta.pct > 0 ? "+" : ""}${delta.pct.toFixed(1)}%`}
      </span>
      <span style={{ opacity: 0.5 }}>({EUR(delta.abs)})</span>
    </div>
  );
}

function MiniCard({ titulo, valor, tono, sub }: { titulo: string; valor: string; tono?: "ok" | "warning"; sub?: string }) {
  const borderColor = tono === "warning" ? "#f59e0b55" : tono === "ok" ? "#10b98155" : "var(--line, #e5e7eb)";
  const bg = tono === "warning" ? "#f59e0b08" : tono === "ok" ? "#10b98108" : "var(--panel, #fff)";
  return (
    <div style={{ padding: 12, borderRadius: 10, border: `1px solid ${borderColor}`, background: bg, display: "grid", gap: 4 }}>
      <span style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.5 }}>{titulo}</span>
      <strong style={{ fontSize: 17 }}>{valor}</strong>
      {sub && <span style={{ fontSize: 11, opacity: 0.6 }}>{sub}</span>}
    </div>
  );
}

function TopList({ icon, titulo, items }: { icon: React.ReactNode; titulo: string; items: Top[] }) {
  return (
    <div style={{ padding: 14, borderRadius: 12, border: "1px solid var(--line, #e5e7eb)", background: "var(--panel, #fff)", display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {icon}
        <strong style={{ fontSize: 13 }}>{titulo}</strong>
      </div>
      {items.length === 0 ? (
        <span style={{ fontSize: 12, opacity: 0.6 }}>Sin datos del periodo.</span>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
          {items.map((it, i) => (
            <li key={`${it.nombre}-${i}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span style={{ width: 18, fontSize: 11, opacity: 0.6 }}>{i + 1}.</span>
              <ArrowRight size={12} opacity={0.5} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.nombre}</span>
              <strong>{EUR(it.total)}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid var(--line, #e5e7eb)",
  background: "var(--panel, #fff)",
  fontSize: 13,
};
