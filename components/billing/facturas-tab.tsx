"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Empresa = { id: string; nombre: string };
type Factura = {
  id: string;
  numero: string | null;
  contacto_nombre: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  base: number;
  iva: number;
  total: number;
  estado: string;
  payment_status?: string | null;
  payment_link_url?: string | null;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function FacturasTab({ empresas }: { empresas: Empresa[] }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [items, setItems] = useState<Factura[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    if (!empresaId) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      const sb = supabase;
      const { data, error } = await sb
        .from("facturas")
        .select("id,numero,contacto_nombre,fecha_emision,fecha_vencimiento,base,iva,total,estado,payment_status,payment_link_url")
        .eq("empresa_id", empresaId)
        .eq("tipo", "emitida")
        .order("fecha_emision", { ascending: false })
        .limit(50);
      if (!session.session) return;
      if (error) throw error;
      setItems(data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function generarLink(id: string) {
    setBusy(id);
    setError(null);
    setSuccess(null);
    try {
      const tk = await token();
      const res = await fetch(`/api/billing/facturas/${id}/payment-link`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setSuccess("Enlace de cobro generado. Cópialo desde la tabla.");
      await navigator.clipboard?.writeText(json.url);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  function copyLink(url: string) {
    navigator.clipboard?.writeText(url);
    setSuccess("Enlace copiado al portapapeles.");
    setTimeout(() => setSuccess(null), 2000);
  }

  return (
    <section className="grid">
      <div className="card span-12" style={{ display: "grid", gap: 12 }}>
        <div className="topbar" style={{ border: 0, padding: 0, margin: 0, alignItems: "flex-end" }}>
          <div>
            <span className="card-eyebrow">Facturas emitidas</span>
            <h2 className="title" style={{ fontSize: 24, marginTop: 4 }}>Cobros y enlaces de pago</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Genera un enlace Stripe Checkout en un clic. El cliente paga online y la factura queda
              marcada como pagada automáticamente cuando Stripe nos lo confirma.
            </p>
          </div>
          <select className="input" style={{ maxWidth: 280 }} value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
        </div>

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
        {success ? <p role="status" style={{ color: "var(--good)" }}>{success}</p> : null}

        <table className="table">
          <thead>
            <tr>
              <th>Nº</th><th>Cliente</th><th>Fecha</th><th className="num">Total</th><th>Estado</th><th>Cobro</th><th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 24 }}>Sin facturas emitidas en esta empresa todavía.</td></tr>
            ) : items.map((f) => {
              const ps = f.payment_status ?? "no_link";
              return (
                <tr key={f.id}>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{f.numero ?? f.id.slice(0, 8)}</td>
                  <td><strong>{f.contacto_nombre ?? "—"}</strong></td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                    {f.fecha_emision ? new Date(f.fecha_emision + "T00:00:00").toLocaleDateString("es-ES") : "—"}
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>{EUR(Number(f.total))}</td>
                  <td><span className={`status ${f.estado === "cobrada" || f.estado === "pagada" ? "good" : ""}`}>{f.estado}</span></td>
                  <td>
                    <span className={`status ${ps === "paid" ? "good" : ps === "pending" ? "warn" : ps === "failed" ? "bad" : ""}`}>
                      {ps === "no_link" ? "sin enlace" : ps}
                    </span>
                  </td>
                  <td>
                    {!f.payment_link_url ? (
                      <button className="button compact" onClick={() => generarLink(f.id)} disabled={busy === f.id}>
                        {busy === f.id ? "Generando…" : "💳 Cobrar"}
                      </button>
                    ) : (
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        <button className="button secondary compact" onClick={() => copyLink(f.payment_link_url!)}>Copiar</button>
                        <a className="button compact" href={f.payment_link_url} target="_blank" rel="noreferrer">Abrir →</a>
                      </span>
                    )}
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
