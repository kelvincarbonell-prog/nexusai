"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Linea = {
  id: string;
  origen: "factura" | "gasto";
  fecha: string | null;
  proveedor: string | null;
  concepto: string | null;
  nif: string | null;
  numero: string | null;
  base: number;
  iva: number;
  total: number;
  estado: string;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function ClienteGastos({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [items, setItems] = useState<Linea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "factura" | "gasto">("todos");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const headers = { Authorization: `Bearer ${tk}` };
      // Facturas recibidas + gastos en paralelo, luego unimos
      const year = new Date().getUTCFullYear();
      const from = `${year - 1}-01-01`;
      const [facRes, gasRes] = await Promise.all([
        supabase
          .from("facturas")
          .select("id,numero,contacto_nombre,fecha_emision,base,iva,total,estado,metadata")
          .eq("empresa_id", empresaId)
          .eq("tipo", "recibida")
          .gte("fecha_emision", from)
          .order("fecha_emision", { ascending: false })
          .limit(120),
        supabase
          .from("gastos")
          .select("id,proveedor,concepto,fecha,base,iva,total,estado,metadata")
          .eq("empresa_id", empresaId)
          .gte("fecha", from)
          .order("fecha", { ascending: false })
          .limit(120),
      ]);
      void headers;
      if (facRes.error) throw facRes.error;
      if (gasRes.error) throw gasRes.error;
      const lineas: Linea[] = [
        ...(facRes.data ?? []).map((f) => ({
          id: f.id,
          origen: "factura" as const,
          fecha: f.fecha_emision ?? null,
          proveedor: f.contacto_nombre ?? null,
          concepto: ((f.metadata ?? {}) as Record<string, unknown>).concepto as string | null ?? null,
          nif: ((f.metadata ?? {}) as Record<string, unknown>).contacto_nif as string | null ?? null,
          numero: f.numero ?? null,
          base: Number(f.base ?? 0),
          iva: Number(f.iva ?? 0),
          total: Number(f.total ?? 0),
          estado: f.estado ?? "borrador",
        })),
        ...(gasRes.data ?? []).map((g) => ({
          id: g.id,
          origen: "gasto" as const,
          fecha: g.fecha ?? null,
          proveedor: g.proveedor ?? null,
          concepto: g.concepto ?? null,
          nif: ((g.metadata ?? {}) as Record<string, unknown>).proveedor_nif as string | null ?? null,
          numero: null,
          base: Number(g.base ?? 0),
          iva: Number(g.iva ?? 0),
          total: Number(g.total ?? 0),
          estado: g.estado ?? "pendiente",
        })),
      ];
      lineas.sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
      setItems(lineas);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (filtro !== "todos" && i.origen !== filtro) return false;
      if (!q) return true;
      return (
        i.proveedor?.toLowerCase().includes(q) ||
        i.concepto?.toLowerCase().includes(q) ||
        i.nif?.toLowerCase().includes(q) ||
        i.numero?.toLowerCase().includes(q)
      );
    });
  }, [items, filtro, search]);

  const totales = useMemo(() => ({
    base: filtered.reduce((s, i) => s + i.base, 0),
    iva: filtered.reduce((s, i) => s + i.iva, 0),
    total: filtered.reduce((s, i) => s + i.total, 0),
    n: filtered.length,
  }), [filtered]);

  return (
    <section className="grid">
      <article className="card span-12">
        <div className="topbar" style={{ border: 0, padding: 0, margin: 0, alignItems: "flex-end" }}>
          <div>
            <span className="card-eyebrow">Gastos · facturas recibidas + gastos</span>
            <h2 className="title" style={{ fontSize: 22, marginTop: 4 }}>
              {totales.n} apuntes · {EUR(totales.total)}
            </h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Base {EUR(totales.base)} · IVA soportado {EUR(totales.iva)}
            </p>
          </div>
        </div>

        <div className="form" style={{ gridTemplateColumns: "minmax(220px, 1fr) auto auto auto", gap: 8, marginTop: 12 }}>
          <input className="input" placeholder="🔍 Buscar proveedor, NIF, concepto…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className={`button compact ${filtro === "todos" ? "" : "secondary"}`} onClick={() => setFiltro("todos")}>Todos</button>
          <button className={`button compact ${filtro === "factura" ? "" : "secondary"}`} onClick={() => setFiltro("factura")}>Facturas</button>
          <button className={`button compact ${filtro === "gasto" ? "" : "secondary"}`} onClick={() => setFiltro("gasto")}>Gastos</button>
        </div>

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
        {loading ? <p className="muted">Cargando…</p> : null}

        {filtered.length === 0 && !loading ? (
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
            Sin gastos para mostrar. Usa el «Lector gastos» para subir facturas o «Importaciones» para CSV.
          </p>
        ) : (
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Origen</th>
                <th>Proveedor</th>
                <th>NIF</th>
                <th>Concepto</th>
                <th className="num">Base</th>
                <th className="num">IVA</th>
                <th className="num">Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={`${g.origen}-${g.id}`}>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                    {g.fecha ? new Date(g.fecha + "T00:00:00").toLocaleDateString("es-ES") : "—"}
                  </td>
                  <td><span className={`pill ${g.origen === "factura" ? "plain" : "warn"}`} style={{ fontSize: 11 }}>{g.origen === "factura" ? "F" : "G"}</span></td>
                  <td>{g.proveedor ?? "—"}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{g.nif ?? "—"}</td>
                  <td style={{ fontSize: 13 }}>{g.concepto ?? "—"}</td>
                  <td className="num">{EUR(g.base)}</td>
                  <td className="num">{EUR(g.iva)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{EUR(g.total)}</td>
                  <td><span className={`status ${g.estado === "pagada" || g.estado === "registrada" ? "good" : ""}`}>{g.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </section>
  );
}
