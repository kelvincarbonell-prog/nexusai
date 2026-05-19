"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { History, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Item = {
  id: string;
  empresa_id: string;
  trabajador_id: string;
  fecha_efecto: string;
  bruto_anual: number;
  bruto_anual_anterior: number | null;
  delta_anual: number | null;
  motivo: string | null;
  convenio_codigo: string | null;
  empresa: { id: string; nombre: string | null; nif: string | null } | null;
  trabajador: { id: string; nombre: string | null; apellidos: string | null } | null;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/**
 * Lista los últimos cambios salariales del despacho — solo visible al gestor.
 * Agrupados por cliente, click lleva a la ficha laboral de ese cliente.
 */
export function HistoricoSalarialWidget() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const tk = sess.session?.access_token ?? "";
        const res = await fetch("/api/laboral/salario-historico/recientes?limit=15", {
          headers: { Authorization: `Bearer ${tk}` },
        });
        const j = await res.json();
        if (j.ok) setItems(j.items ?? []);
        else throw new Error(j.error ?? "Error");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  // Agrupar por empresa
  const porEmpresa = useMemo(() => {
    const m = new Map<string, { empresa: Item["empresa"]; cambios: Item[] }>();
    for (const it of items) {
      const key = it.empresa_id;
      if (!m.has(key)) m.set(key, { empresa: it.empresa, cambios: [] });
      m.get(key)!.cambios.push(it);
    }
    return Array.from(m.values());
  }, [items]);

  if (loading) {
    return (
      <article className="card span-12">
        <span className="card-eyebrow"><History size={12} style={{ verticalAlign: "middle" }} /> Histórico salarial</span>
        <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Cargando últimos cambios…</p>
      </article>
    );
  }

  return (
    <article className="card span-12" style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <span className="card-eyebrow"><History size={12} style={{ verticalAlign: "middle" }} /> Histórico salarial</span>
          <strong style={{ fontSize: 16, display: "block", marginTop: 2 }}>
            Últimos cambios de salario por cliente
          </strong>
        </div>
        <span className="muted" style={{ fontSize: 11 }}>{items.length} cambio{items.length === 1 ? "" : "s"}</span>
      </div>

      {error && (
        <p role="alert" style={{ color: "var(--bad)", fontSize: 13 }}>{error}</p>
      )}

      {!error && porEmpresa.length === 0 && (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Sin cambios de salario registrados todavía. Cuando subas un sueldo desde la ficha de un trabajador, aparecerá aquí.
        </p>
      )}

      {porEmpresa.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {porEmpresa.map((g) => (
            <div key={g.empresa?.id ?? "x"} style={{ border: "1px solid var(--line, #e5e7eb)", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14 }}>
                  {g.empresa?.nombre ?? "(sin nombre)"} {g.empresa?.nif ? <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· {g.empresa.nif}</span> : null}
                </strong>
                {g.empresa?.id && (
                  <Link
                    href={`/clientes/${g.empresa.id}`}
                    style={{ fontSize: 12, textDecoration: "none", color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    Ver ficha <ArrowRight size={10} />
                  </Link>
                )}
              </div>
              <table className="table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Trabajador</th>
                    <th className="num">Antes</th>
                    <th className="num">Después</th>
                    <th className="num">Δ</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {g.cambios.map((c) => {
                    const up = (c.delta_anual ?? 0) > 0;
                    const down = (c.delta_anual ?? 0) < 0;
                    const trabNombre = c.trabajador
                      ? c.trabajador.apellidos
                        ? `${c.trabajador.apellidos}, ${c.trabajador.nombre}`
                        : c.trabajador.nombre
                      : "(eliminado)";
                    return (
                      <tr key={c.id}>
                        <td style={{ fontFamily: "var(--mono, monospace)" }}>{c.fecha_efecto}</td>
                        <td>{trabNombre}</td>
                        <td className="num">{c.bruto_anual_anterior != null ? EUR(c.bruto_anual_anterior) : "—"}</td>
                        <td className="num"><strong>{EUR(c.bruto_anual)}</strong></td>
                        <td className="num" style={{ color: up ? "var(--good)" : down ? "var(--bad)" : "var(--muted)", fontWeight: 600 }}>
                          {c.delta_anual != null ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                              {up && <TrendingUp size={11} />}{down && <TrendingDown size={11} />}
                              {EUR(c.delta_anual)}
                            </span>
                          ) : "—"}
                        </td>
                        <td>{c.motivo ?? "—"}{c.convenio_codigo ? <span className="muted" style={{ fontSize: 10, marginLeft: 4 }}>· {c.convenio_codigo}</span> : null}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
