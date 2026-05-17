"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Item = {
  id: string;
  nombre: string | null;
  nif: string | null;
  plan: string | null;
  account_type: string | null;
  score: number | null;
  categoria: "al_dia" | "atencion" | "critico" | null;
  alertas_total: number;
  alertas_danger: number;
};

type Resumen = { total: number; al_dia: number; atencion: number; critico: number };

export function CarteraClientes({ initialCount }: { initialCount?: number }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [items, setItems] = useState<Item[]>([]);
  const [resumen, setResumen] = useState<Resumen>({ total: 0, al_dia: 0, atencion: 0, critico: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/dashboard/cartera", { headers: { Authorization: `Bearer ${tk}` } });
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
  }, [supabase]);

  return (
    <article className="card span-12">
      <div className="topbar" style={{ border: 0, padding: 0, margin: 0 }}>
        <div>
          <span className="card-eyebrow">Cartera</span>
          <strong style={{ fontSize: 18 }}>
            {loading ? (initialCount ?? "—") : resumen.total} clientes
          </strong>
        </div>
        <div className="button-row">
          <span className="pill good">al día · {resumen.al_dia}</span>
          <span className="pill warn">atención · {resumen.atencion}</span>
          <span className="pill bad">crítico · {resumen.critico}</span>
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
            return (
              <Link key={e.id} href={`/clientes/${e.id}`} className="client-card">
                <strong>{e.nombre ?? "Sin nombre"}</strong>
                <small>{e.nif ?? "—"}</small>
                <div className="health">
                  {e.score ?? "—"} <small>/100</small>
                </div>
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
