"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Orden = "nombre" | "facturacion" | "margen" | "crecimiento" | "riesgo";

type Item = {
  id: string;
  nombre: string | null;
  nif: string | null;
  plan: string | null;
  account_type: string | null;
  score: number | null;
  categoria: "al_dia" | "atencion" | "critico" | null;
  alertas_total: number;
  facturacion_ytd?: number;
  gastos_ytd?: number;
  margen?: number;
  margen_pct?: number;
  crecimiento_pct?: number | null;
  alertas_danger: number;
};

type Resumen = { total: number; al_dia: number; atencion: number; critico: number };

export function CarteraClientes({ initialCount }: { initialCount?: number }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [items, setItems] = useState<Item[]>([]);
  const [resumen, setResumen] = useState<Resumen>({ total: 0, al_dia: 0, atencion: 0, critico: 0 });
  const [loading, setLoading] = useState(true);
  const [orden, setOrden] = useState<Orden>("nombre");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch(`/api/dashboard/cartera?orden=${orden}`, { headers: { Authorization: `Bearer ${tk}` } });
      const j = await res.json();
      if (alive && j.ok) {
        setItems(j.empresas);
        setResumen(j.resumen);
        setLoading(false);
      } else if (alive) {
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [supabase, orden]);

  return (
    <article className="card span-12">
      <div className="topbar" style={{ border: 0, padding: 0, margin: 0 }}>
        <div>
          <span className="card-eyebrow">Cartera</span>
          <strong style={{ fontSize: 18 }}>
            {loading ? (initialCount ?? "—") : resumen.total} clientes
          </strong>
        </div>
        <div className="button-row" suppressHydrationWarning>
          {!loading ? (
            <>
              {resumen.al_dia > 0 && <span className="pill good">al día · {resumen.al_dia}</span>}
              {resumen.atencion > 0 && <span className="pill warn">atención · {resumen.atencion}</span>}
              {resumen.critico > 0 && <span className="pill bad">crítico · {resumen.critico}</span>}
              {resumen.total > 0 && resumen.al_dia === resumen.total && (
                <span className="pill good">todo al día</span>
              )}
            </>
          ) : (
            <span className="pill" style={{ opacity: 0.5 }}>calculando…</span>
          )}
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as Orden)}
            aria-label="Ordenar cartera"
            style={{
              marginLeft: "auto",
              padding: "4px 10px",
              borderRadius: 8,
              border: "1px solid color-mix(in srgb, currentColor 16%, transparent)",
              background: "color-mix(in srgb, currentColor 4%, transparent)",
              color: "inherit",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <option value="nombre">Orden: A-Z</option>
            <option value="facturacion">Más facturación</option>
            <option value="margen">Más margen</option>
            <option value="crecimiento">Más crecimiento</option>
            <option value="riesgo">Más riesgo</option>
          </select>
        </div>
      </div>
      <div className="client-grid">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="client-card">
              <strong>—</strong>
              <small>cargando…</small>
              <div className="health">—<small>/100</small></div>
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="client-card">
            <strong>Sin clientes</strong>
            <small>Crea tu primera empresa</small>
            <div className="health">—<small>/100</small></div>
          </div>
        ) : (
          items.map((e) => {
            const pillCls =
              e.categoria === "al_dia"
                ? "pill good"
                : e.categoria === "atencion"
                ? "pill warn"
                : e.categoria === "critico"
                ? "pill bad"
                : "pill";
            const fmtEUR = (n: number) =>
              new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
            return (
              <Link key={e.id} href={`/clientes/${e.id}`} prefetch className="client-card">
                <strong>{e.nombre ?? "Sin nombre"}</strong>
                <small>{e.nif ?? "—"}</small>
                <div className="health">
                  {e.score ?? "—"} <small>/100</small>
                </div>
                {e.facturacion_ytd != null && e.facturacion_ytd > 0 && (
                  <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4, display: "grid", gap: 1 }}>
                    <span>Fact. YTD: <strong>{fmtEUR(e.facturacion_ytd)}</strong></span>
                    {e.margen != null && (
                      <span style={{ color: e.margen >= 0 ? "#10b981" : "#ef4444" }}>
                        Margen: {fmtEUR(e.margen)}{e.margen_pct != null ? ` (${e.margen_pct}%)` : ""}
                      </span>
                    )}
                    {e.crecimiento_pct != null && (
                      <span style={{ color: e.crecimiento_pct >= 0 ? "#10b981" : "#ef4444" }}>
                        Crec.: {e.crecimiento_pct > 0 ? "+" : ""}{e.crecimiento_pct}% YoY
                      </span>
                    )}
                  </div>
                )}
                {e.alertas_total > 0 && (
                  <span className={pillCls} style={{ alignSelf: "flex-start", marginTop: 6 }}>
                    {e.alertas_danger > 0
                      ? `${e.alertas_danger} urgente${e.alertas_danger === 1 ? "" : "s"}`
                      : `${e.alertas_total} aviso${e.alertas_total === 1 ? "" : "s"}`}
                  </span>
                )}
              </Link>
            );
          })
        )}
      </div>
    </article>
  );
}
