"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Empresa = { id: string; nombre: string; account_type?: string | null };

type Obligacion = {
  modelo: string;
  label: string;
  periodo: string;
  ejercicio: number;
  fecha_limite: string;
  dias_restantes: number;
  esta_presentada: boolean;
  recurrencia: string;
};

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function urgencyClass(o: Obligacion): "good" | "warn" | "bad" {
  if (o.esta_presentada) return "good";
  if (o.dias_restantes < 0) return "bad";
  if (o.dias_restantes <= 7) return "bad";
  if (o.dias_restantes <= 21) return "warn";
  return "good";
}

export function CalendarioFiscal({ empresas }: { empresas: Empresa[] }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [obligaciones, setObligaciones] = useState<Obligacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch(`/api/aeat/calendario?empresa_id=${empresaId}`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setObligaciones(json.obligaciones ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  const porMes = useMemo(() => {
    const buckets = new Map<number, Obligacion[]>();
    for (const o of obligaciones) {
      const mes = Number(o.fecha_limite.slice(5, 7));
      const arr = buckets.get(mes) ?? [];
      arr.push(o);
      buckets.set(mes, arr);
    }
    for (const arr of buckets.values()) {
      arr.sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite));
    }
    return buckets;
  }, [obligaciones]);

  const pendientes = obligaciones.filter((o) => !o.esta_presentada);
  const criticas = pendientes.filter((o) => o.dias_restantes <= 7);

  return (
    <section className="grid">
      <header className="card span-12" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <span className="card-eyebrow">Próximos 60 días</span>
            <h2 className="title" style={{ fontSize: 24, marginTop: 4 }}>Obligaciones fiscales por mes</h2>
          </div>
          <div className="button-row">
            <span className="pill bad">{criticas.length} críticas</span>
            <span className="pill warn">{pendientes.length} pendientes</span>
          </div>
        </div>

        <label className="label" style={{ maxWidth: 360 }}>
          Empresa
          <select className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </label>

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
        {loading ? <p className="muted">Calculando…</p> : null}
      </header>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {MESES.map((nombre, idx) => {
          const mes = idx + 1;
          const items = porMes.get(mes) ?? [];
          return (
            <article key={mes} className="card" style={{ display: "grid", gap: 8, alignContent: "start" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <strong style={{ fontSize: 14 }}>{nombre}</strong>
                {items.length > 0 ? <span className="pill accent" style={{ fontSize: 11 }}>{items.length}</span> : null}
              </div>
              {items.length === 0 ? (
                <small className="muted" style={{ fontSize: 12 }}>—</small>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                  {items.map((o, i) => {
                    const u = urgencyClass(o);
                    return (
                      <li key={`${o.modelo}-${o.periodo}-${o.ejercicio}-${i}`}>
                        <Link
                          href={`/aeat?modelo=${o.modelo}`}
                          className={`status ${u}`}
                          style={{ textDecoration: "none", display: "flex", justifyContent: "space-between", padding: "6px 8px", borderRadius: 6 }}
                        >
                          <span>
                            <strong>{o.modelo}</strong>{" "}
                            <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{o.periodo}</span>
                          </span>
                          <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                            {o.fecha_limite.slice(8, 10)}/{o.fecha_limite.slice(5, 7)}
                            {o.esta_presentada ? " ✓" : o.dias_restantes < 0 ? " ✕" : ""}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
