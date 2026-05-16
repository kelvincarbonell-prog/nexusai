"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Check, Sparkles, Send } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Linea = {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  iva_pct: number;
  descuento_pct: number;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function CrearFactura({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const today = new Date().toISOString().slice(0, 10);

  const [contacto, setContacto] = useState({ nombre: "", nif: "", email: "" });
  const [fechas, setFechas] = useState({ emision: today, vencimiento: "" });
  const [lineas, setLineas] = useState<Linea[]>([
    { descripcion: "", cantidad: 1, precio_unitario: 0, iva_pct: 21, descuento_pct: 0 },
  ]);
  const [irpfPct, setIrpfPct] = useState(0);
  const [notas, setNotas] = useState("");
  const [estado, setEstado] = useState<"borrador" | "emitida">("borrador");

  const [phase, setPhase] = useState<"idle" | "creando" | "creado">("idle");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ numero: string; total: number; id: string } | null>(null);

  const totales = useMemo(() => {
    let base = 0;
    let iva = 0;
    for (const l of lineas) {
      const sub = l.cantidad * l.precio_unitario * (1 - l.descuento_pct / 100);
      base += sub;
      iva += (sub * l.iva_pct) / 100;
    }
    const retencion = (base * irpfPct) / 100;
    return {
      base: Math.round(base * 100) / 100,
      iva: Math.round(iva * 100) / 100,
      retencion: Math.round(retencion * 100) / 100,
      total: Math.round((base + iva - retencion) * 100) / 100,
    };
  }, [lineas, irpfPct]);

  function addLinea() {
    setLineas((l) => [...l, { descripcion: "", cantidad: 1, precio_unitario: 0, iva_pct: 21, descuento_pct: 0 }]);
  }
  function removeLinea(i: number) {
    setLineas((l) => (l.length > 1 ? l.filter((_, idx) => idx !== i) : l));
  }
  function setLinea(i: number, patch: Partial<Linea>) {
    setLineas((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function crear() {
    setError(null);
    // Validación
    if (!contacto.nombre.trim()) return setError("El nombre del cliente es obligatorio.");
    if (lineas.length === 0 || lineas.every((l) => !l.descripcion.trim())) {
      return setError("Añade al menos una línea con descripción.");
    }
    if (totales.total <= 0) return setError("El total debe ser mayor que 0.");

    setPhase("creando");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/billing/facturas", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresaId,
          tipo: "emitida",
          contacto_nombre: contacto.nombre,
          contacto_nif: contacto.nif || undefined,
          contacto_email: contacto.email || undefined,
          fecha_emision: fechas.emision,
          fecha_vencimiento: fechas.vencimiento || undefined,
          lineas: lineas.filter((l) => l.descripcion.trim()),
          irpf_pct: irpfPct,
          notas: notas || undefined,
          estado,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setCreated({ numero: json.factura.numero, total: Number(json.factura.total), id: json.factura.id });
      setPhase("creado");
      setTimeout(() => {
        // Reset al cabo de 4s para crear otra
        setPhase("idle");
        setContacto({ nombre: "", nif: "", email: "" });
        setLineas([{ descripcion: "", cantidad: 1, precio_unitario: 0, iva_pct: 21, descuento_pct: 0 }]);
        setNotas("");
        setCreated(null);
      }, 4000);
    } catch (e: unknown) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <section className="grid">
      {/* Banner de éxito al crear */}
      {phase === "creado" && created ? (
        <article className="card span-12" style={{ background: "color-mix(in srgb, var(--good) 12%, transparent)", borderColor: "var(--good)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "var(--good)",
                color: "white",
                display: "grid",
                placeItems: "center",
                animation: "factura-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
                boxShadow: "0 6px 20px -4px color-mix(in srgb, var(--good) 50%, transparent)",
              }}
            >
              <Check size={22} strokeWidth={2.8} />
            </div>
            <div style={{ flex: 1 }}>
              <strong style={{ fontSize: 16, display: "block" }}>Factura {created.numero} creada con éxito</strong>
              <small className="muted" style={{ fontSize: 13 }}>
                Total {EUR(created.total)} · ya está visible en el listado de facturas.
              </small>
            </div>
          </div>
        </article>
      ) : null}

      <article className="card span-12">
        <span className="card-eyebrow">Crear factura nueva</span>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Los campos marcados con <span style={{ color: "var(--bad)" }}>*</span> son obligatorios. El número de
          factura se genera automáticamente con la serie configurada en «Plantilla facturas».
        </p>

        <span className="card-eyebrow" style={{ marginTop: 18 }}>Cliente <span style={{ color: "var(--bad)" }}>*</span></span>
        <div className="form three-cols" style={{ marginTop: 8 }}>
          <label className="label">
            Nombre / razón social <span style={{ color: "var(--bad)" }}>*</span>
            <input
              className="input"
              value={contacto.nombre}
              onChange={(e) => setContacto({ ...contacto, nombre: e.target.value })}
              placeholder="Cliente S.L."
              required
            />
          </label>
          <label className="label">
            NIF / CIF
            <input
              className="input"
              value={contacto.nif}
              onChange={(e) => setContacto({ ...contacto, nif: e.target.value.toUpperCase() })}
              style={{ fontFamily: "var(--mono)" }}
              placeholder="B12345678"
            />
          </label>
          <label className="label">
            Email
            <input
              type="email"
              className="input"
              value={contacto.email}
              onChange={(e) => setContacto({ ...contacto, email: e.target.value })}
              placeholder="cliente@empresa.com"
            />
          </label>
        </div>

        <span className="card-eyebrow" style={{ marginTop: 18 }}>Fechas</span>
        <div className="form three-cols" style={{ marginTop: 8 }}>
          <label className="label">
            Fecha de emisión <span style={{ color: "var(--bad)" }}>*</span>
            <input type="date" className="input" value={fechas.emision} onChange={(e) => setFechas({ ...fechas, emision: e.target.value })} required />
          </label>
          <label className="label">
            Vencimiento (opcional)
            <input type="date" className="input" value={fechas.vencimiento} onChange={(e) => setFechas({ ...fechas, vencimiento: e.target.value })} />
          </label>
          <label className="label">
            Estado inicial
            <select className="input" value={estado} onChange={(e) => setEstado(e.target.value as "borrador" | "emitida")}>
              <option value="borrador">Borrador</option>
              <option value="emitida">Emitida</option>
            </select>
          </label>
        </div>

        <span className="card-eyebrow" style={{ marginTop: 18 }}>Conceptos <span style={{ color: "var(--bad)" }}>*</span></span>
        <table className="table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th style={{ width: "45%" }}>Descripción</th>
              <th style={{ width: 70 }}>Cant.</th>
              <th style={{ width: 110 }}>Precio</th>
              <th style={{ width: 70 }}>Dto %</th>
              <th style={{ width: 70 }}>IVA %</th>
              <th className="num">Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, i) => {
              const sub = l.cantidad * l.precio_unitario * (1 - l.descuento_pct / 100);
              return (
                <tr key={i}>
                  <td>
                    <input
                      className="input compact"
                      value={l.descripcion}
                      onChange={(e) => setLinea(i, { descripcion: e.target.value })}
                      placeholder="Servicio prestado…"
                    />
                  </td>
                  <td><input type="number" min={0} step="0.01" className="input compact" value={l.cantidad} onChange={(e) => setLinea(i, { cantidad: Number(e.target.value) })} /></td>
                  <td><input type="number" min={0} step="0.01" className="input compact" value={l.precio_unitario} onChange={(e) => setLinea(i, { precio_unitario: Number(e.target.value) })} /></td>
                  <td><input type="number" min={0} max={100} step="1" className="input compact" value={l.descuento_pct} onChange={(e) => setLinea(i, { descuento_pct: Number(e.target.value) })} /></td>
                  <td>
                    <select className="input compact" value={l.iva_pct} onChange={(e) => setLinea(i, { iva_pct: Number(e.target.value) })}>
                      <option value={0}>0%</option>
                      <option value={4}>4%</option>
                      <option value={10}>10%</option>
                      <option value={21}>21%</option>
                    </select>
                  </td>
                  <td className="num" style={{ fontWeight: 600 }}>{EUR(Math.round(sub * 100) / 100)}</td>
                  <td>
                    <button
                      className="button ghost compact"
                      onClick={() => removeLinea(i)}
                      disabled={lineas.length <= 1}
                      title="Borrar línea"
                      style={{ padding: "4px 8px", color: lineas.length > 1 ? "var(--bad)" : "var(--muted)" }}
                    >
                      <Trash2 size={14} strokeWidth={1.8} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ marginTop: 8 }}>
          <button className="button secondary compact" onClick={addLinea}>
            <Plus size={13} strokeWidth={2} /> Añadir línea
          </button>
        </div>

        <span className="card-eyebrow" style={{ marginTop: 18 }}>Ajustes</span>
        <div className="form three-cols" style={{ marginTop: 8 }}>
          <label className="label">
            Retención IRPF (%)
            <input type="number" min={0} max={50} step="1" className="input" value={irpfPct} onChange={(e) => setIrpfPct(Number(e.target.value))} />
            <small className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>0 para no aplicar (profesionales: 7 o 15)</small>
          </label>
          <label className="label span-form" style={{ gridColumn: "span 2" }}>
            Notas (opcional)
            <textarea
              className="input textarea"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Condiciones de pago, observaciones…"
              style={{ minHeight: 80 }}
            />
          </label>
        </div>
      </article>

      <article className="card span-12">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <span className="card-eyebrow">Resumen</span>
            <div style={{ display: "flex", gap: 18, marginTop: 6, flexWrap: "wrap" }}>
              <small>Base: <strong>{EUR(totales.base)}</strong></small>
              <small>IVA: <strong>{EUR(totales.iva)}</strong></small>
              {totales.retencion > 0 ? <small>Retención: <strong>−{EUR(totales.retencion)}</strong></small> : null}
              <strong style={{ fontSize: 18 }}>Total: {EUR(totales.total)}</strong>
            </div>
          </div>
          <div>
            {error ? <small style={{ color: "var(--bad)", display: "block", marginBottom: 8 }}>{error}</small> : null}
            <button
              className="button"
              onClick={crear}
              disabled={phase !== "idle"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                minWidth: 200,
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {phase === "creando" ? (
                <>
                  <Sparkles size={15} strokeWidth={1.8} className="factura-spin" />
                  Creando factura…
                </>
              ) : phase === "creado" ? (
                <>
                  <Check size={15} strokeWidth={2.4} />
                  Creada con éxito
                </>
              ) : (
                <>
                  <Send size={15} strokeWidth={1.8} />
                  Crear factura
                </>
              )}
              {phase === "creando" ? <span className="factura-shimmer" aria-hidden="true" /> : null}
            </button>
          </div>
        </div>
      </article>

      <style jsx global>{`
        @keyframes factura-pop {
          0% { transform: scale(0); }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes factura-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .factura-spin { animation: factura-spin 1.4s linear infinite; }
        @keyframes factura-shimmer-anim {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .factura-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%);
          animation: factura-shimmer-anim 1.4s linear infinite;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .factura-spin, .factura-shimmer { animation: none; }
        }
      `}</style>
    </section>
  );
}
