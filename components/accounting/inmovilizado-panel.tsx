"use client";

import { useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Building, Plus, Trash2, X, Loader2, AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Item = {
  id: string;
  descripcion: string;
  tipo: string;
  precio_adquisicion: number;
  valor_residual: number;
  fecha_alta: string;
  vida_util_anyos: number;
  metodo: "lineal" | "degresivo";
  porcentaje_degresivo: number | null;
  proveedor: string | null;
  ubicacion: string | null;
  estado: string;
  amortizacion_acumulada_hoy?: number;
  valor_neto_contable_hoy?: number;
};

const TIPOS: Array<{ key: string; label: string; coef: number; anyos: number }> = [
  { key: "mobiliario", label: "Mobiliario", coef: 10, anyos: 20 },
  { key: "equipo_informatico", label: "Equipo informático", coef: 25, anyos: 8 },
  { key: "software", label: "Software / aplicaciones", coef: 33, anyos: 6 },
  { key: "vehiculo_turismo", label: "Vehículo turismo", coef: 16, anyos: 14 },
  { key: "vehiculo_transporte", label: "Vehículo transporte", coef: 20, anyos: 10 },
  { key: "maquinaria", label: "Maquinaria", coef: 12, anyos: 18 },
  { key: "construccion", label: "Construcción (s/suelo)", coef: 3, anyos: 68 },
  { key: "instalacion_tecnica", label: "Instalación técnica", coef: 10, anyos: 20 },
  { key: "otro", label: "Otro", coef: 10, anyos: 20 },
];

const EUR = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function InmovilizadoPanel({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const { confirm } = useConfirm();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [cuadroId, setCuadroId] = useState<string | null>(null);
  const [cuadroData, setCuadroData] = useState<Array<{ anyo: number; cuota: number; amortizacion_acumulada: number; valor_neto_contable: number }>>([]);

  const [draft, setDraft] = useState({
    descripcion: "",
    tipo: "mobiliario",
    precio_adquisicion: 0,
    valor_residual: 0,
    fecha_alta: new Date().toISOString().slice(0, 10),
    vida_util_anyos: 10,
    metodo: "lineal" as "lineal" | "degresivo",
    proveedor: "",
    ubicacion: "",
  });

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    setLoading(true);
    try {
      const tk = await token();
      const res = await fetch(`/api/accounting/inmovilizado?empresa_id=${empresaId}`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const j = await res.json();
      if (j.ok) setItems(j.items ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [empresaId]);

  function onTipoChange(key: string) {
    const t = TIPOS.find((x) => x.key === key);
    setDraft((d) => ({
      ...d,
      tipo: key,
      vida_util_anyos: t?.anyos ?? d.vida_util_anyos,
    }));
  }

  async function crear() {
    setError(null); setAviso(null);
    try {
      const tk = await token();
      const res = await fetch("/api/accounting/inmovilizado", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          empresa_id: empresaId,
          descripcion: draft.descripcion,
          tipo: draft.tipo,
          precio_adquisicion: Number(draft.precio_adquisicion),
          valor_residual: Number(draft.valor_residual),
          fecha_alta: draft.fecha_alta,
          vida_util_anyos: Number(draft.vida_util_anyos),
          metodo: draft.metodo,
          proveedor: draft.proveedor || undefined,
          ubicacion: draft.ubicacion || undefined,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Error");
      if (j.aviso) setAviso(j.aviso);
      setOpen(false);
      setDraft({ descripcion: "", tipo: "mobiliario", precio_adquisicion: 0, valor_residual: 0, fecha_alta: new Date().toISOString().slice(0, 10), vida_util_anyos: 10, metodo: "lineal", proveedor: "", ubicacion: "" });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  async function borrar(id: string) {
    if (!(await confirm({ title: "¿Eliminar este elemento del inmovilizado? Se perderá su cuadro de amortización.", tone: "danger", confirmLabel: "Confirmar" }))) return;
    const tk = await token();
    await fetch(`/api/accounting/inmovilizado?id=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${tk}` } });
    await load();
  }

  async function verCuadro(id: string) {
    setCuadroId(id);
    const tk = await token();
    const res = await fetch(`/api/accounting/inmovilizado?id=${id}`, { headers: { Authorization: `Bearer ${tk}` } });
    const j = await res.json();
    if (j.ok) setCuadroData(j.cuadro_amortizacion ?? []);
  }

  const totales = items.reduce(
    (acc, x) => ({
      coste: acc.coste + Number(x.precio_adquisicion ?? 0),
      acum: acc.acum + Number(x.amortizacion_acumulada_hoy ?? 0),
      vnc: acc.vnc + Number(x.valor_neto_contable_hoy ?? 0),
    }),
    { coste: 0, acum: 0, vnc: 0 },
  );

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Building size={18} />
        <h3 style={{ margin: 0 }}>Inmovilizado</h3>
        <button onClick={() => setOpen(true)} className="button compact" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={13} /> Alta de elemento
        </button>
      </header>

      <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>
        Gestión de activos amortizables. Tablas oficiales AEAT (RD 1777/2004) por tipo. Cuadro de amortización lineal o degresivo.
      </p>

      {error && <div style={alert("error")}><AlertTriangle size={13} /> {error}</div>}
      {aviso && <div style={alert("warn")}><AlertTriangle size={13} /> {aviso}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        <Mini titulo="Elementos" valor={String(items.length)} />
        <Mini titulo="Coste total" valor={EUR(totales.coste)} />
        <Mini titulo="Amort. acumulada" valor={EUR(totales.acum)} tono="warn" />
        <Mini titulo="Valor neto contable" valor={EUR(totales.vnc)} tono="ok" />
      </div>

      {loading ? (
        <span style={{ fontSize: 13, opacity: 0.7, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={14} className="animate-spin" /> Cargando…
        </span>
      ) : items.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, opacity: 0.65 }}>Sin elementos. Pulsa "Alta" para añadir el primero.</p>
      ) : (
        <div style={{ overflow: "auto", border: "1px solid color-mix(in srgb, currentColor 12%, transparent)", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "color-mix(in srgb, currentColor 5%, transparent)", textAlign: "left" }}>
                <th style={th}>Elemento</th>
                <th style={th}>Tipo</th>
                <th style={th}>Alta</th>
                <th style={thNum}>Coste</th>
                <th style={thNum}>Vida útil</th>
                <th style={thNum}>Amort. acum.</th>
                <th style={thNum}>VNC hoy</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((x) => (
                <tr key={x.id} style={{ borderTop: "1px solid color-mix(in srgb, currentColor 10%, transparent)" }}>
                  <td style={td}>
                    <strong>{x.descripcion}</strong>
                    {x.ubicacion && <div style={{ fontSize: 11, opacity: 0.6 }}>{x.ubicacion}</div>}
                  </td>
                  <td style={td}>{TIPOS.find((t) => t.key === x.tipo)?.label ?? x.tipo}</td>
                  <td style={td}>{x.fecha_alta}</td>
                  <td style={tdNum}>{EUR(Number(x.precio_adquisicion))}</td>
                  <td style={tdNum}>{x.vida_util_anyos} años</td>
                  <td style={tdNum}>{EUR(Number(x.amortizacion_acumulada_hoy ?? 0))}</td>
                  <td style={{ ...tdNum, fontWeight: 700 }}>{EUR(Number(x.valor_neto_contable_hoy ?? 0))}</td>
                  <td style={td}>
                    <button onClick={() => verCuadro(x.id)} className="button ghost compact" title="Ver cuadro de amortización" style={{ marginRight: 4 }}>
                      <TrendingDown size={12} />
                    </button>
                    <button onClick={() => borrar(x.id)} className="button ghost compact" title="Borrar" style={{ color: "var(--bad, #ef4444)" }}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal alta */}
      {open && (
        <div role="dialog" aria-modal="true" onClick={() => setOpen(false)} style={overlay}>
          <div onClick={(e) => e.stopPropagation()} style={dialog}>
            <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Building size={16} />
              <strong style={{ fontSize: 14 }}>Alta de elemento</strong>
              <button onClick={() => setOpen(false)} aria-label="Cerrar" style={iconBtn}><X size={14} /></button>
            </header>
            <div style={grid}>
              <Field label="Descripción" full><input value={draft.descripcion} onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })} style={input} placeholder="Mesa de oficina, MacBook Pro, etc." /></Field>
              <Field label="Tipo">
                <select value={draft.tipo} onChange={(e) => onTipoChange(e.target.value)} style={input}>
                  {TIPOS.map((t) => <option key={t.key} value={t.key}>{t.label} ({t.coef}% / {t.anyos}a)</option>)}
                </select>
              </Field>
              <Field label="Fecha de alta"><input type="date" value={draft.fecha_alta} onChange={(e) => setDraft({ ...draft, fecha_alta: e.target.value })} style={input} /></Field>
              <Field label="Precio adquisición (€)"><input type="number" step="0.01" value={draft.precio_adquisicion} onChange={(e) => setDraft({ ...draft, precio_adquisicion: Number(e.target.value) })} style={input} /></Field>
              <Field label="Valor residual (€)"><input type="number" step="0.01" value={draft.valor_residual} onChange={(e) => setDraft({ ...draft, valor_residual: Number(e.target.value) })} style={input} /></Field>
              <Field label="Vida útil (años)"><input type="number" value={draft.vida_util_anyos} onChange={(e) => setDraft({ ...draft, vida_util_anyos: Number(e.target.value) })} style={input} /></Field>
              <Field label="Método">
                <select value={draft.metodo} onChange={(e) => setDraft({ ...draft, metodo: e.target.value as "lineal" | "degresivo" })} style={input}>
                  <option value="lineal">Lineal (estándar)</option>
                  <option value="degresivo">Degresivo</option>
                </select>
              </Field>
              <Field label="Proveedor (opc.)"><input value={draft.proveedor} onChange={(e) => setDraft({ ...draft, proveedor: e.target.value })} style={input} /></Field>
              <Field label="Ubicación (opc.)" full><input value={draft.ubicacion} onChange={(e) => setDraft({ ...draft, ubicacion: e.target.value })} style={input} placeholder="Oficina Madrid · sala 2" /></Field>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setOpen(false)} className="button ghost compact">Cancelar</button>
              <button onClick={crear} className="button" disabled={!draft.descripcion || draft.precio_adquisicion <= 0}>
                <CheckCircle2 size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cuadro amortización */}
      {cuadroId && (
        <div role="dialog" aria-modal="true" onClick={() => setCuadroId(null)} style={overlay}>
          <div onClick={(e) => e.stopPropagation()} style={{ ...dialog, width: "min(640px, 100%)" }}>
            <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TrendingDown size={16} />
              <strong style={{ fontSize: 14 }}>Cuadro de amortización</strong>
              <button onClick={() => setCuadroId(null)} aria-label="Cerrar" style={iconBtn}><X size={14} /></button>
            </header>
            <div style={{ overflow: "auto", maxHeight: 400 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "color-mix(in srgb, currentColor 5%, transparent)" }}>
                    <th style={th}>Año</th>
                    <th style={thNum}>Cuota anual</th>
                    <th style={thNum}>Amort. acumulada</th>
                    <th style={thNum}>VNC final</th>
                  </tr>
                </thead>
                <tbody>
                  {cuadroData.map((row) => (
                    <tr key={row.anyo} style={{ borderTop: "1px solid color-mix(in srgb, currentColor 10%, transparent)" }}>
                      <td style={td}><strong>{row.anyo}</strong></td>
                      <td style={tdNum}>{EUR(row.cuota)}</td>
                      <td style={tdNum}>{EUR(row.amortizacion_acumulada)}</td>
                      <td style={{ ...tdNum, fontWeight: 700 }}>{EUR(row.valor_neto_contable)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Mini({ titulo, valor, tono }: { titulo: string; valor: string; tono?: "ok" | "warn" }) {
  const border = tono === "ok" ? "#10b98155" : tono === "warn" ? "#f59e0b55" : "color-mix(in srgb, currentColor 14%, transparent)";
  const bg = tono === "ok" ? "#10b98108" : tono === "warn" ? "#f59e0b08" : "color-mix(in srgb, currentColor 4%, transparent)";
  return (
    <div style={{ padding: 12, borderRadius: 10, border: `1px solid ${border}`, background: bg, display: "grid", gap: 2 }}>
      <span style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.4 }}>{titulo}</span>
      <strong style={{ fontSize: 17 }}>{valor}</strong>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4, fontSize: 12, gridColumn: full ? "span 2" : undefined }}>
      <span style={{ opacity: 0.75 }}>{label}</span>
      {children}
    </label>
  );
}

function alert(tone: "error" | "warn"): React.CSSProperties {
  const bg = tone === "error" ? "#ef444412" : "#f59e0b12";
  const border = tone === "error" ? "#ef444455" : "#f59e0b55";
  const color = tone === "error" ? "#ef4444" : "#f59e0b";
  return { padding: 10, borderRadius: 8, background: bg, border: `1px solid ${border}`, color, fontSize: 13, display: "flex", alignItems: "center", gap: 6 };
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", padding: 16, zIndex: 1000 };
const dialog: React.CSSProperties = { width: "min(560px, 100%)", maxHeight: "90vh", overflow: "auto", background: "var(--card, #fff)", borderRadius: 14, border: "1px solid var(--border, #e5e7eb)", padding: 18, display: "grid", gap: 12 };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };
const input: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid color-mix(in srgb, currentColor 16%, transparent)", background: "color-mix(in srgb, currentColor 4%, transparent)", color: "inherit", fontSize: 13, width: "100%", boxSizing: "border-box" };
const iconBtn: React.CSSProperties = { marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer", padding: 4, color: "inherit" };
const th: React.CSSProperties = { padding: "10px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, opacity: 0.7 };
const thNum: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "10px 12px" };
const tdNum: React.CSSProperties = { ...td, textAlign: "right", fontFamily: "var(--mono, monospace)" };
