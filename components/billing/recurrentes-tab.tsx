"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Empresa = { id: string; nombre: string };
type Recurrente = {
  id: string;
  nombre: string;
  cliente_nombre: string;
  frecuencia: "mensual" | "bimestral" | "trimestral" | "semestral" | "anual";
  proxima_emision: string;
  total: number;
  estado: "activa" | "pausada" | "finalizada";
  num_emisiones: number;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

const FRECUENCIAS = ["mensual", "bimestral", "trimestral", "semestral", "anual"] as const;

export function RecurrentesTab({ empresas }: { empresas: Empresa[] }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [items, setItems] = useState<Recurrente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [draft, setDraft] = useState({
    nombre: "",
    cliente_nombre: "",
    cliente_nif: "",
    cliente_email: "",
    frecuencia: "mensual" as typeof FRECUENCIAS[number],
    dia_emision: 1,
    base: 0,
    iva_pct: 21,
    irpf_pct: 0,
    concepto: "",
  });

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    if (!empresaId) return;
    setLoading(true);
    try {
      const tk = await token();
      const res = await fetch(`/api/billing/recurrentes?empresa_id=${empresaId}`, { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (json.ok) setItems(json.items ?? []);
      else setError(json.error ?? "Error");
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

  const totalDraft = useMemo(() => {
    const iva = draft.base * (draft.iva_pct / 100);
    const irpf = draft.base * (draft.irpf_pct / 100);
    return draft.base + iva - irpf;
  }, [draft]);

  async function crear() {
    if (!empresaId) return;
    if (!draft.nombre || !draft.cliente_nombre || !draft.base) {
      setError("Completa nombre, cliente y base.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const tk = await token();
      const res = await fetch("/api/billing/recurrentes", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresaId,
          nombre: draft.nombre,
          cliente_nombre: draft.cliente_nombre,
          cliente_nif: draft.cliente_nif || undefined,
          cliente_email: draft.cliente_email || undefined,
          frecuencia: draft.frecuencia,
          dia_emision: draft.dia_emision,
          base: draft.base,
          iva_pct: draft.iva_pct,
          irpf_pct: draft.irpf_pct,
          concepto: draft.concepto || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setCreating(false);
      setDraft({ nombre: "", cliente_nombre: "", cliente_nif: "", cliente_email: "", frecuencia: "mensual", dia_emision: 1, base: 0, iva_pct: 21, irpf_pct: 0, concepto: "" });
      setSuccess("Suscripción creada.");
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function emitir(id: string) {
    setError(null);
    setSuccess(null);
    const tk = await token();
    const res = await fetch(`/api/billing/recurrentes/${id}/emitir`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tk}` },
    });
    const json = await res.json();
    if (json.ok) {
      setSuccess(`Factura emitida (${json.factura?.id?.slice(0, 8) ?? ""}).`);
      load();
    } else {
      setError(json.error ?? "Error");
    }
  }

  async function toggleEstado(id: string, estado: string) {
    const tk = await token();
    const res = await fetch("/api/billing/recurrentes", {
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
            <span className="card-eyebrow">Facturación recurrente</span>
            <h2 className="title" style={{ fontSize: 24, marginTop: 4 }}>Suscripciones y cuotas</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Cuotas mensuales, anuales o cualquier frecuencia. M26 te recuerda emitir cada periodo (o lo hace solo si activas la automatización).
            </p>
          </div>
          <div className="button-row">
            <select className="input" style={{ maxWidth: 280 }} value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            <button className="button" onClick={() => setCreating(!creating)}>
              {creating ? "Cancelar" : "+ Nueva suscripción"}
            </button>
          </div>
        </div>

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
        {success ? <p role="status" style={{ color: "var(--good)" }}>{success}</p> : null}

        {creating ? (
          <div className="setting-box" style={{ padding: 16, borderRadius: 8, display: "grid", gap: 12 }}>
            <span className="card-eyebrow">Nueva suscripción</span>
            <div className="form three-cols">
              <label className="label">
                Nombre interno
                <input className="input" value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} placeholder="Cuota Innova mensual" />
              </label>
              <label className="label">
                Cliente
                <input className="input" value={draft.cliente_nombre} onChange={(e) => setDraft({ ...draft, cliente_nombre: e.target.value })} />
              </label>
              <label className="label">
                Email cliente
                <input className="input" type="email" value={draft.cliente_email} onChange={(e) => setDraft({ ...draft, cliente_email: e.target.value })} />
              </label>
              <label className="label">
                Frecuencia
                <select className="input" value={draft.frecuencia} onChange={(e) => setDraft({ ...draft, frecuencia: e.target.value as typeof FRECUENCIAS[number] })}>
                  {FRECUENCIAS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className="label">
                Día de emisión
                <input className="input" type="number" min={1} max={28} value={draft.dia_emision} onChange={(e) => setDraft({ ...draft, dia_emision: Number(e.target.value) })} />
              </label>
              <label className="label">
                NIF cliente
                <input className="input" value={draft.cliente_nif} onChange={(e) => setDraft({ ...draft, cliente_nif: e.target.value.toUpperCase() })} style={{ fontFamily: "var(--mono)" }} />
              </label>
              <label className="label">
                Base (€)
                <input className="input" type="number" min={0} step={0.01} value={draft.base} onChange={(e) => setDraft({ ...draft, base: Number(e.target.value) })} />
              </label>
              <label className="label">
                IVA %
                <input className="input" type="number" min={0} max={30} value={draft.iva_pct} onChange={(e) => setDraft({ ...draft, iva_pct: Number(e.target.value) })} />
              </label>
              <label className="label">
                IRPF %
                <input className="input" type="number" min={0} max={30} step={0.5} value={draft.irpf_pct} onChange={(e) => setDraft({ ...draft, irpf_pct: Number(e.target.value) })} />
              </label>
              <label className="label span-form">
                Concepto en factura
                <input className="input" value={draft.concepto} onChange={(e) => setDraft({ ...draft, concepto: e.target.value })} placeholder="Asesoría fiscal — cuota mensual" />
              </label>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--muted)" }}>
                Total por factura: <strong style={{ color: "var(--accent)", fontSize: 16 }}>{EUR(totalDraft)}</strong>
              </div>
              <button className="button" onClick={crear} disabled={loading}>{loading ? "Creando…" : "Activar suscripción"}</button>
            </div>
          </div>
        ) : null}

        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th><th>Cliente</th><th>Frecuencia</th><th>Próxima</th><th className="num">Importe</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 24 }}>Sin suscripciones activas. Crea una para automatizar.</td></tr>
            ) : items.map((r) => {
              const dias = Math.ceil((new Date(r.proxima_emision + "T23:59:59").getTime() - Date.now()) / 86_400_000);
              const tocaHoy = dias <= 0 && r.estado === "activa";
              return (
                <tr key={r.id}>
                  <td><strong>{r.nombre}</strong><br /><small className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{r.num_emisiones} emisiones</small></td>
                  <td>{r.cliente_nombre}</td>
                  <td><span className="pill plain">{r.frecuencia}</span></td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                    {new Date(r.proxima_emision + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                    <span style={{ color: tocaHoy ? "var(--accent)" : "var(--muted)", marginLeft: 4 }}>
                      {tocaHoy ? "ahora" : ` · ${dias}d`}
                    </span>
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>{EUR(Number(r.total))}</td>
                  <td><span className={`status ${r.estado === "activa" ? "good" : r.estado === "pausada" ? "warn" : "bad"}`}>{r.estado}</span></td>
                  <td>
                    {r.estado === "activa" ? (
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        <button className="button compact" onClick={() => emitir(r.id)} disabled={!tocaHoy}>Emitir</button>
                        <button className="button secondary compact" onClick={() => toggleEstado(r.id, "pausada")}>Pausar</button>
                      </span>
                    ) : r.estado === "pausada" ? (
                      <button className="button compact" onClick={() => toggleEstado(r.id, "activa")}>Reanudar</button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
