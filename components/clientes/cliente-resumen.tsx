"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ScanLine, ListChecks } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Declaracion = {
  modelo: string;
  periodo: string;
  ejercicio: number;
  status: string;
  resultado: number | null;
  updated_at: string;
};

type Resumen = {
  ejercicio: number;
  facturado: number;
  facturado_count: number;
  recibido: number;
  recibido_count: number;
  gastos: number;
  gastos_count: number;
  resultado_estimado: number;
  pendiente_cobro: number;
  tareas_pendientes: number;
  ocr_pendientes: number;
  declaraciones: Declaracion[];
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function ClienteResumen({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [data, setData] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const tk = sess.session?.access_token ?? "";
        const res = await fetch(`/api/portal/resumen?empresa_id=${empresaId}`, {
          headers: { Authorization: `Bearer ${tk}` },
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "Error");
        setData(json);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [empresaId, supabase]);

  if (loading) return <p className="muted">Cargando resumen…</p>;
  if (error) return <p role="alert" style={{ color: "var(--bad)" }}>{error}</p>;
  if (!data) return null;

  const metricStyle: React.CSSProperties = {
    fontSize: "clamp(20px, 2.3vw, 30px)",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    minWidth: 0,
    lineHeight: 1.1,
  };
  const cardStyle: React.CSSProperties = { minWidth: 0, overflow: "hidden" };

  return (
    <section className="grid">
      <article className="card span-3" style={cardStyle}>
        <span className="card-eyebrow">Facturado · {data.ejercicio}</span>
        <div className="metric" style={metricStyle}>{EUR(data.facturado)}</div>
        <div className="metric-foot good">{data.facturado_count} facturas emitidas</div>
      </article>
      <article className="card span-3" style={cardStyle}>
        <span className="card-eyebrow">Gastos</span>
        <div className="metric" style={metricStyle}>{EUR(data.gastos + data.recibido)}</div>
        <div className="metric-foot warn">{data.gastos_count + data.recibido_count} apuntes</div>
      </article>
      <article className="card span-3" style={{ ...cardStyle, borderColor: data.resultado_estimado >= 0 ? "var(--accent)" : "var(--bad)" }}>
        <span className="card-eyebrow">Resultado estimado</span>
        <div className={`metric ${data.resultado_estimado >= 0 ? "accent" : ""}`} style={metricStyle}>{EUR(data.resultado_estimado)}</div>
        <div className={`metric-foot ${data.resultado_estimado >= 0 ? "good" : "bad"}`}>
          {data.resultado_estimado >= 0 ? "Beneficio antes de impuestos" : "Pérdida"}
        </div>
      </article>
      <article className="card span-3" style={cardStyle}>
        <span className="card-eyebrow">Pendiente de cobro</span>
        <div className="metric" style={metricStyle}>{EUR(data.pendiente_cobro)}</div>
        <div className="metric-foot warn">facturas no cobradas</div>
      </article>

      <article className="card span-6">
        <span className="card-eyebrow">Atención requerida</span>
        <ul style={{ margin: "12px 0 0", paddingLeft: 0, listStyle: "none", display: "grid", gap: 8 }}>
          <li style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, background: data.ocr_pendientes > 0 ? "color-mix(in srgb, var(--warn) 14%, transparent)" : "var(--accent-soft)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <ScanLine size={15} strokeWidth={1.8} aria-hidden="true" style={{ color: "var(--muted)" }} />
              Facturas en OCR sin revisar
            </span>
            <span className="pill warn">{data.ocr_pendientes}</span>
          </li>
          <li style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, background: data.tareas_pendientes > 0 ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "var(--accent-soft)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <ListChecks size={15} strokeWidth={1.8} aria-hidden="true" style={{ color: "var(--muted)" }} />
              Tareas pendientes
            </span>
            <span className="pill accent">{data.tareas_pendientes}</span>
          </li>
        </ul>
      </article>

      <article className="card span-6">
        <span className="card-eyebrow">Últimas declaraciones AEAT</span>
        {data.declaraciones.length === 0 ? (
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
            Sin declaraciones todavía. <Link href="/aeat" className="link">Genera la primera →</Link>
          </p>
        ) : (
          <table className="table" style={{ marginTop: 8 }}>
            <thead><tr><th>Modelo</th><th>Periodo</th><th>Estado</th><th className="num">Resultado</th></tr></thead>
            <tbody>
              {data.declaraciones.map((d, i) => (
                <tr key={i}>
                  <td><strong>{d.modelo}</strong></td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{d.periodo} · {d.ejercicio}</td>
                  <td>
                    <span className={`pill ${d.status === "presentado" ? "good" : d.status === "revisado" ? "accent" : "warn"}`}>{d.status}</span>
                  </td>
                  <td className="num">{d.resultado != null ? EUR(Number(d.resultado)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </section>
  );
}
