"use client";

import { useEffect, useState } from "react";
import { History, TrendingUp, TrendingDown, Plus } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Trabajador = { id: string; nombre: string };
type Item = {
  id: string;
  fecha_efecto: string;
  bruto_anual: number;
  bruto_anual_anterior: number | null;
  delta_anual: number | null;
  motivo: string | null;
  convenio_codigo: string | null;
  created_at: string;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

const MOTIVOS = [
  "Subida convenio",
  "Revisión salarial",
  "Ascenso",
  "Cambio categoría",
  "Bajada acordada",
  "Otro",
];

/**
 * Histórico salarial del trabajador: lista los cambios + permite registrar
 * uno nuevo (que actualiza el bruto vigente si la fecha es ≤ hoy).
 */
export function HistoricoSalarialModal({ empresaId, trabajador, onClose }: { empresaId: string; trabajador: Trabajador; onClose: () => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [bruto, setBruto] = useState<number | "">("");
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [convenio, setConvenio] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function token() {
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    setLoading(true);
    try {
      const tk = await token();
      const res = await fetch(`/api/laboral/salario-historico?empresa_id=${empresaId}&trabajador_id=${trabajador.id}`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const j = await res.json();
      if (j.ok) setItems(j.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardar() {
    if (!bruto || Number(bruto) <= 0) {
      setError("Indica el nuevo bruto anual.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tk = await token();
      const res = await fetch("/api/laboral/salario-historico", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          empresa_id: empresaId,
          trabajador_id: trabajador.id,
          fecha_efecto: fecha,
          bruto_anual: Number(bruto),
          motivo,
          convenio_codigo: convenio || undefined,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Error");
      setAdding(false);
      setBruto("");
      setConvenio("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 999, display: "grid", placeItems: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ maxWidth: 720, width: "100%", display: "grid", gap: 14 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <span className="card-eyebrow">
              <History size={12} style={{ verticalAlign: "middle" }} /> Histórico salarial
            </span>
            <h2 style={{ fontSize: 20, margin: "4px 0 0" }}>{trabajador.nombre}</h2>
            <p className="muted" style={{ fontSize: 12, margin: "2px 0 0" }}>
              Cada cambio se audita; si la fecha de efecto es ≤ hoy, actualiza el bruto vigente del trabajador.
            </p>
          </div>
          <button className="button ghost compact" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}

        {!adding ? (
          <button
            type="button"
            className="button secondary compact"
            onClick={() => setAdding(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
          >
            <Plus size={13} /> Registrar cambio salarial
          </button>
        ) : (
          <div className="form three-cols" style={{ padding: 12, borderRadius: 10, background: "color-mix(in srgb, var(--accent) 6%, transparent)" }}>
            <label className="label">
              Fecha efecto
              <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </label>
            <label className="label">
              Nuevo bruto anual (€)
              <input
                type="number" min={0} step="0.01" className="input"
                value={bruto} onChange={(e) => setBruto(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="22.500,00"
              />
            </label>
            <label className="label">
              Motivo
              <select className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                {MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="label">
              Código convenio (opcional)
              <input className="input" value={convenio} onChange={(e) => setConvenio(e.target.value)} placeholder="ej. 99014445" />
            </label>
            <div className="span-form" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="button ghost compact" onClick={() => setAdding(false)} disabled={busy}>Cancelar</button>
              <button type="button" className="button compact" onClick={guardar} disabled={busy}>
                {busy ? "Guardando…" : "Guardar cambio"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="muted">Cargando histórico…</p>
        ) : items.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>Sin cambios registrados todavía.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha efecto</th>
                <th className="num">Bruto anterior</th>
                <th className="num">Bruto nuevo</th>
                <th className="num">Δ</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const up = (it.delta_anual ?? 0) > 0;
                const down = (it.delta_anual ?? 0) < 0;
                return (
                  <tr key={it.id}>
                    <td style={{ fontFamily: "var(--mono, monospace)", fontSize: 12 }}>{it.fecha_efecto}</td>
                    <td className="num">{it.bruto_anual_anterior != null ? EUR(it.bruto_anual_anterior) : "—"}</td>
                    <td className="num"><strong>{EUR(it.bruto_anual)}</strong></td>
                    <td className="num" style={{ color: up ? "var(--good)" : down ? "var(--bad)" : "var(--muted)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4, justifyContent: "flex-end", width: "100%" }}>
                      {it.delta_anual != null ? (
                        <>
                          {up && <TrendingUp size={12} />}{down && <TrendingDown size={12} />}
                          {EUR(it.delta_anual)}
                        </>
                      ) : "—"}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {it.motivo ?? "—"}
                      {it.convenio_codigo ? <span className="muted" style={{ marginLeft: 6, fontSize: 11 }}>· conv. {it.convenio_codigo}</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
