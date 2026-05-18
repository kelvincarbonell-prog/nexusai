"use client";

import { useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Eye, Trash2, Check, FileText, Plus } from "lucide-react";
import { InlineEdit } from "@/components/ui/inline-edit";
import { EmptyState } from "@/components/ui/empty-state";
import { usePersistedState } from "@/lib/hooks/use-persisted-state";
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
  irpf: number;
  origen_ocr: string | null;
  cuenta_pgc: string | null;
  estado: string;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function ClienteGastos({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const { confirm } = useConfirm();
  const [items, setItems] = useState<Linea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = usePersistedState<"todos" | "factura" | "gasto">(`gastos:filtro:${empresaId}`, "todos");
  const [filtroEstado, setFiltroEstado] = usePersistedState<"todos" | "pendiente" | "cobrada">(`gastos:estado:${empresaId}`, "todos");
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
        ...(facRes.data ?? []).map((f) => {
          const m = (f.metadata ?? {}) as Record<string, unknown>;
          return {
            id: f.id,
            origen: "factura" as const,
            fecha: f.fecha_emision ?? null,
            proveedor: f.contacto_nombre ?? null,
            concepto: (m.concepto as string | undefined) ?? null,
            nif: (m.contacto_nif as string | undefined) ?? null,
            numero: f.numero ?? null,
            base: Number(f.base ?? 0),
            iva: Number(f.iva ?? 0),
            total: Number(f.total ?? 0),
            irpf: Number((m.retencion_irpf as number | undefined) ?? 0),
            origen_ocr: (m.origen_ocr as string | undefined) ?? null,
            cuenta_pgc: (m.cuenta_pgc as string | undefined) ?? null,
            estado: f.estado ?? "borrador",
          };
        }),
        ...(gasRes.data ?? []).map((g) => {
          const m = (g.metadata ?? {}) as Record<string, unknown>;
          return {
            id: g.id,
            origen: "gasto" as const,
            fecha: g.fecha ?? null,
            proveedor: g.proveedor ?? null,
            concepto: g.concepto ?? null,
            nif: (m.proveedor_nif as string | undefined) ?? null,
            numero: null,
            base: Number(g.base ?? 0),
            iva: Number(g.iva ?? 0),
            total: Number(g.total ?? 0),
            irpf: Number((m.retencion_irpf as number | undefined) ?? 0),
            origen_ocr: (m.origen_ocr as string | undefined) ?? null,
            cuenta_pgc: (m.cuenta_pgc as string | undefined) ?? null,
            estado: g.estado ?? "pendiente",
          };
        }),
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

  async function patchGasto(gastoId: string, patch: Record<string, unknown>) {
    const { data: sess } = await supabase.auth.getSession();
    const tk = sess.session?.access_token ?? "";
    const res = await fetch(`/api/gastos/${gastoId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error ?? "Error");
    setItems((prev) => prev.map((it) => (it.id === gastoId && it.origen === "gasto" ? { ...it, ...patch } as Linea : it)));
  }

  async function marcarCobrada(gastoId: string) {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch(`/api/gastos/${gastoId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "cobrada" }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Error");
      // Refrescar la lista actualizando estado localmente
      setItems((prev) => prev.map((it) => (it.id === gastoId && it.origen === "gasto" ? { ...it, estado: "cobrada" } : it)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  async function verFactura(extraccionId: string) {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch(`/api/portal/extracciones/${extraccionId}/archivo`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const json = await res.json();
      if (!json.ok || !json.url) {
        setError(json.error ?? "Sin archivo");
        return;
      }
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  async function borrar(g: Linea) {
    if (!(await confirm({ title: `¿Borrar este ${g.origen}?`, message: "También se eliminará su asiento contable si lo tiene.", tone: "danger", confirmLabel: "Borrar" }))) return;
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const table = g.origen === "factura" ? "facturas" : "gastos";
      // Borra el asiento contable enlazado (si existe)
      const sourceType = g.origen === "factura" ? "factura_recibida" : "gasto";
      await supabase.from("journal_entries").delete().eq("empresa_id", empresaId).eq("source_type", sourceType).eq("source_id", g.id);
      // Borra la entrada principal
      const { error: err } = await supabase.from(table).delete().eq("id", g.id);
      if (err) throw err;
      void tk;
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (filtro !== "todos" && i.origen !== filtro) return false;
      if (filtroEstado === "pendiente" && (i.estado === "cobrada" || i.estado === "pagada" || i.estado === "registrada")) return false;
      if (filtroEstado === "cobrada" && !(i.estado === "cobrada" || i.estado === "pagada" || i.estado === "registrada")) return false;
      if (!q) return true;
      return (
        i.proveedor?.toLowerCase().includes(q) ||
        i.concepto?.toLowerCase().includes(q) ||
        i.nif?.toLowerCase().includes(q) ||
        i.numero?.toLowerCase().includes(q)
      );
    });
  }, [items, filtro, filtroEstado, search]);

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
          <span style={{ width: 12 }} />
          <button className={`button compact ${filtroEstado === "todos" ? "" : "secondary"}`} onClick={() => setFiltroEstado("todos")} title="Cualquier estado">Cualquiera</button>
          <button className={`button compact ${filtroEstado === "pendiente" ? "" : "secondary"}`} onClick={() => setFiltroEstado("pendiente")}>Pendientes</button>
          <button className={`button compact ${filtroEstado === "cobrada" ? "" : "secondary"}`} onClick={() => setFiltroEstado("cobrada")}>Cobradas</button>
        </div>

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
        {loading ? <p className="muted">Cargando…</p> : null}

        {filtered.length === 0 && !loading ? (
          <div style={{ marginTop: 16 }}>
            <EmptyState
              icon={<FileText size={36} strokeWidth={1.6} />}
              title={items.length === 0 ? "Aún no hay gastos ni facturas" : "Sin resultados para este filtro"}
              description={items.length === 0
                ? "Sube tu primer ticket o factura al lector OCR y aparecerá aquí automáticamente."
                : "Prueba a quitar filtros o ampliar el rango de búsqueda."}
              cta={items.length === 0
                ? { label: "Abrir lector OCR", href: `?tab=lector-gastos` }
                : { label: "Quitar filtros", onClick: () => { setFiltro("todos"); setFiltroEstado("todos"); setSearch(""); } }}
              secondary={items.length === 0 ? { label: "Importar CSV", href: `?tab=importaciones` } : undefined}
            />
          </div>
        ) : (
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Origen</th>
                <th>Proveedor</th>
                <th>NIF</th>
                <th>Concepto</th>
                <th>Cuenta</th>
                <th className="num">Base</th>
                <th className="num">IVA</th>
                <th className="num">IRPF</th>
                <th className="num">Total</th>
                <th>Estado</th>
                <th style={{ width: 90 }}></th>
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
                  <td style={{ fontSize: 13, maxWidth: 220 }}>
                    {g.origen === "gasto" ? (
                      <InlineEdit
                        value={g.concepto}
                        onSave={(v) => patchGasto(g.id, { concepto: v })}
                        type="text"
                        placeholder="añadir concepto"
                      />
                    ) : (
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{g.concepto ?? "—"}</span>
                    )}
                  </td>
                  <td>
                    {g.cuenta_pgc ? (
                      <span className="pill accent" style={{ fontSize: 10, fontFamily: "var(--mono)" }} title="Cuenta PGC asignada por IA">{g.cuenta_pgc}</span>
                    ) : (
                      <span className="muted" style={{ fontSize: 11 }}>—</span>
                    )}
                  </td>
                  <td className="num">{EUR(g.base)}</td>
                  <td className="num">{EUR(g.iva)}</td>
                  <td className="num" style={{ color: g.irpf > 0 ? "var(--accent)" : "var(--muted)" }}>
                    {g.irpf > 0 ? EUR(g.irpf) : "—"}
                  </td>
                  <td className="num" style={{ fontWeight: 600 }}>{EUR(g.total)}</td>
                  <td>
                    <span className={`status ${g.estado === "pagada" || g.estado === "cobrada" || g.estado === "registrada" ? "good" : ""}`}>
                      {g.estado === "pagada" || g.estado === "cobrada" || g.estado === "registrada" ? "cobrada" : "pendiente"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      {/* Toggle pendiente ↔ cobrada */}
                      {g.origen === "gasto" && g.estado !== "cobrada" && g.estado !== "pagada" && g.estado !== "registrada" && (
                        <button
                          className="icon-btn"
                          onClick={() => marcarCobrada(g.id)}
                          title="Marcar como cobrada / pagada"
                          aria-label="Marcar cobrada"
                          style={{ color: "#10b981" }}
                        >
                          <Check size={14} strokeWidth={2.2} />
                        </button>
                      )}
                      {g.origen_ocr ? (
                        <button
                          className="icon-btn"
                          onClick={() => verFactura(g.origen_ocr!)}
                          title="Ver factura"
                          aria-label="Ver factura"
                        >
                          <Eye size={14} strokeWidth={1.8} />
                        </button>
                      ) : null}
                      <button
                        className="icon-btn"
                        onClick={() => borrar(g)}
                        title={`Borrar ${g.origen}`}
                        aria-label="Borrar"
                        style={{ color: "var(--bad, #ef4444)" }}
                      >
                        <Trash2 size={14} strokeWidth={1.8} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </section>
  );
}
