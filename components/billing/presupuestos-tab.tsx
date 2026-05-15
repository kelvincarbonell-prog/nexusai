"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Empresa = { id: string; nombre: string };
type Linea = { descripcion: string; cantidad: number; precio_unitario: number; iva_pct: number; descuento_pct: number };
type Presupuesto = {
  id: string;
  numero: string;
  estado: string;
  cliente_nombre: string;
  fecha_emision: string;
  base: number;
  iva: number;
  total: number;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

const EMPTY_LINEA: Linea = { descripcion: "", cantidad: 1, precio_unitario: 0, iva_pct: 21, descuento_pct: 0 };

export function PresupuestosTab({ empresas }: { empresas: Empresa[] }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [items, setItems] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [draft, setDraft] = useState({
    cliente_nombre: "",
    cliente_nif: "",
    cliente_email: "",
    fecha_validez: "",
    notas: "",
  });
  const [lineas, setLineas] = useState<Linea[]>([{ ...EMPTY_LINEA }]);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const tk = await token();
      const res = await fetch(`/api/billing/presupuestos?empresa_id=${empresaId}`, { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setItems(json.items ?? []);
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

  function addLinea() {
    setLineas([...lineas, { ...EMPTY_LINEA }]);
  }
  function removeLinea(i: number) {
    setLineas(lineas.filter((_, idx) => idx !== i));
  }
  function updateLinea(i: number, key: keyof Linea, value: string | number) {
    const next = [...lineas];
    next[i] = { ...next[i], [key]: value };
    setLineas(next);
  }

  const totales = useMemo(() => {
    let base = 0, iva = 0;
    for (const l of lineas) {
      const b = l.cantidad * l.precio_unitario * (1 - l.descuento_pct / 100);
      base += b;
      iva += b * (l.iva_pct / 100);
    }
    return { base, iva, total: base + iva };
  }, [lineas]);

  async function crear() {
    if (!empresaId) return;
    if (!draft.cliente_nombre) {
      setError("Indica el cliente.");
      return;
    }
    if (lineas.length === 0 || lineas.every((l) => !l.descripcion)) {
      setError("Añade al menos una línea con descripción.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const tk = await token();
      const res = await fetch("/api/billing/presupuestos", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresaId,
          cliente_nombre: draft.cliente_nombre,
          cliente_nif: draft.cliente_nif || undefined,
          cliente_email: draft.cliente_email || undefined,
          fecha_validez: draft.fecha_validez || undefined,
          notas: draft.notas || undefined,
          lineas: lineas.filter((l) => l.descripcion),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setCreating(false);
      setDraft({ cliente_nombre: "", cliente_nif: "", cliente_email: "", fecha_validez: "", notas: "" });
      setLineas([{ ...EMPTY_LINEA }]);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function cambiarEstado(id: string, estado: string) {
    const tk = await token();
    const res = await fetch("/api/billing/presupuestos", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, estado }),
    });
    const json = await res.json();
    if (json.ok) load();
    else setError(json.error ?? "Error");
  }

  return (
    <section className="grid">
      <div className="card span-12" style={{ display: "grid", gap: 12 }}>
        <div className="topbar" style={{ border: 0, padding: 0, margin: 0, alignItems: "flex-end" }}>
          <div>
            <span className="card-eyebrow">Presupuestos</span>
            <h2 className="title" style={{ fontSize: 24, marginTop: 4 }}>Estimaciones y propuestas</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Crea presupuestos con varias líneas, envíalos al cliente y conviértelos en factura cuando los acepte.
            </p>
          </div>
          <div className="button-row">
            <select className="input" style={{ maxWidth: 280 }} value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            <button className="button" onClick={() => setCreating(!creating)}>
              {creating ? "Cancelar" : "+ Nuevo presupuesto"}
            </button>
          </div>
        </div>

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}

        {creating ? (
          <div className="setting-box" style={{ padding: 16, borderRadius: 8, display: "grid", gap: 12 }}>
            <span className="card-eyebrow">Nuevo presupuesto</span>
            <div className="form three-cols">
              <label className="label">
                Cliente
                <input className="input" value={draft.cliente_nombre} onChange={(e) => setDraft({ ...draft, cliente_nombre: e.target.value })} placeholder="Empresa o nombre" />
              </label>
              <label className="label">
                NIF / CIF
                <input className="input" value={draft.cliente_nif} onChange={(e) => setDraft({ ...draft, cliente_nif: e.target.value.toUpperCase() })} style={{ fontFamily: "var(--mono)" }} />
              </label>
              <label className="label">
                Email
                <input className="input" type="email" value={draft.cliente_email} onChange={(e) => setDraft({ ...draft, cliente_email: e.target.value })} />
              </label>
              <label className="label">
                Válido hasta
                <input className="input" type="date" value={draft.fecha_validez} onChange={(e) => setDraft({ ...draft, fecha_validez: e.target.value })} />
              </label>
            </div>

            <strong style={{ fontSize: 13, marginTop: 8 }}>Líneas</strong>
            <div style={{ display: "grid", gap: 6, overflowX: "auto" }}>
              {lineas.map((l, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(180px, 2fr) 70px 100px 70px 60px 30px", gap: 6, alignItems: "center", minWidth: 600 }}>
                  <input className="input" placeholder="Descripción" value={l.descripcion} onChange={(e) => updateLinea(i, "descripcion", e.target.value)} />
                  <input className="input" type="number" min={0} value={l.cantidad} onChange={(e) => updateLinea(i, "cantidad", Number(e.target.value))} title="Cantidad" />
                  <input className="input" type="number" min={0} step={0.01} value={l.precio_unitario} onChange={(e) => updateLinea(i, "precio_unitario", Number(e.target.value))} title="Precio" />
                  <input className="input" type="number" min={0} max={30} value={l.iva_pct} onChange={(e) => updateLinea(i, "iva_pct", Number(e.target.value))} title="IVA %" />
                  <input className="input" type="number" min={0} max={100} value={l.descuento_pct} onChange={(e) => updateLinea(i, "descuento_pct", Number(e.target.value))} title="Desc %" />
                  <button type="button" onClick={() => removeLinea(i)} disabled={lineas.length === 1} className="button ghost compact" style={{ padding: 4 }}>×</button>
                </div>
              ))}
            </div>
            <button type="button" className="button secondary compact" onClick={addLinea} style={{ width: "fit-content" }}>+ línea</button>

            <label className="label">
              Notas
              <textarea className="input textarea" value={draft.notas} onChange={(e) => setDraft({ ...draft, notas: e.target.value })} placeholder="Condiciones, observaciones…" />
            </label>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--muted)" }}>
                Base {EUR(totales.base)} · IVA {EUR(totales.iva)} · <strong style={{ color: "var(--accent)", fontSize: 16 }}>{EUR(totales.total)}</strong>
              </div>
              <button className="button" onClick={crear} disabled={loading}>
                {loading ? "Creando…" : "Crear presupuesto"}
              </button>
            </div>
          </div>
        ) : null}

        <table className="table">
          <thead>
            <tr>
              <th>Nº</th><th>Cliente</th><th>Fecha</th><th>Estado</th><th className="num">Total</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 24 }}>Sin presupuestos todavía.</td></tr>
            ) : items.map((p) => (
              <tr key={p.id}>
                <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{p.numero}</td>
                <td><strong>{p.cliente_nombre}</strong></td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{new Date(p.fecha_emision + "T00:00:00").toLocaleDateString("es-ES")}</td>
                <td><span className={`status ${p.estado === "aceptado" || p.estado === "facturado" ? "good" : p.estado === "rechazado" || p.estado === "expirado" ? "bad" : ""}`}>{p.estado}</span></td>
                <td className="num" style={{ fontWeight: 700 }}>{EUR(Number(p.total))}</td>
                <td>
                  {p.estado === "borrador" ? <button className="button compact" onClick={() => cambiarEstado(p.id, "enviado")}>Enviar</button> : null}
                  {p.estado === "enviado" ? (
                    <span style={{ display: "inline-flex", gap: 4 }}>
                      <button className="button compact" onClick={() => cambiarEstado(p.id, "aceptado")}>Aceptado</button>
                      <button className="button secondary compact" onClick={() => cambiarEstado(p.id, "rechazado")}>Rechazado</button>
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
