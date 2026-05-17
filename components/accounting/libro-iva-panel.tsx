"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, BookOpenCheck } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Linea = {
  fecha: string;
  numero: string;
  serie: string;
  contacto_nombre: string;
  contacto_nif: string;
  base: number;
  tipo_iva_pct: number;
  cuota_iva: number;
  total: number;
  irpf: number;
  clave_operacion: string;
  tipo_factura: string;
};
type Libro = {
  lineas: Linea[];
  resumen: {
    n_facturas: number;
    base_total: number;
    cuota_total: number;
    total: number;
    irpf_total: number;
    por_tipo: { tipo: number; base: number; cuota: number }[];
  };
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function LibroIvaPanel({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const currentYear = new Date().getUTCFullYear();
  const [ejercicio, setEjercicio] = useState(currentYear);
  const [periodo, setPeriodo] = useState<"1T" | "2T" | "3T" | "4T" | "ANUAL">("ANUAL");
  const [tipo, setTipo] = useState<"repercutido" | "soportado">("repercutido");
  const [libro, setLibro] = useState<Libro | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const url = `/api/accounting/libro-iva?empresa_id=${empresaId}&ejercicio=${ejercicio}&periodo=${periodo}&tipo=${tipo}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setLibro(json.libro);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, ejercicio, periodo, tipo]);

  async function descargarCSV() {
    const { data: sess } = await supabase.auth.getSession();
    const tk = sess.session?.access_token ?? "";
    const url = `/api/accounting/libro-iva?empresa_id=${empresaId}&ejercicio=${ejercicio}&periodo=${periodo}&tipo=${tipo}&formato=csv`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } });
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = `libro-iva-${tipo}-${periodo}-${ejercicio}.csv`;
    a.click();
    URL.revokeObjectURL(objUrl);
  }

  return (
    <article className="card span-12" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 12, background: "color-mix(in srgb, var(--accent) 14%, transparent)", display: "grid", placeItems: "center" }}>
            <BookOpenCheck size={22} strokeWidth={1.8} color="var(--accent)" />
          </div>
          <div>
            <span className="card-eyebrow">Libro registro de IVA · formato AEAT</span>
            <h2 style={{ fontSize: 18, margin: "4px 0 0" }}>
              {tipo === "repercutido" ? "IVA repercutido (facturas emitidas)" : "IVA soportado (facturas recibidas + gastos)"}
            </h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Conforme a las claves de operación AEAT (01 general, 02 exportación, 06 ISP, 09 intracom.). Exportable como CSV
              compatible para el 303 o el SII.
            </p>
          </div>
        </div>
        <button className="button secondary" onClick={descargarCSV} disabled={!libro || libro.lineas.length === 0} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Download size={14} /> Descargar CSV
        </button>
      </div>

      <div className="form" style={{ gridTemplateColumns: "auto auto auto auto", gap: 8 }}>
        <div role="tablist" style={{ display: "flex", gap: 4 }}>
          <button className={`button compact ${tipo === "repercutido" ? "" : "ghost"}`} onClick={() => setTipo("repercutido")}>Repercutido</button>
          <button className={`button compact ${tipo === "soportado" ? "" : "ghost"}`} onClick={() => setTipo("soportado")}>Soportado</button>
        </div>
        <label className="label compact">
          <select className="input compact" value={ejercicio} onChange={(e) => setEjercicio(Number(e.target.value))} style={{ fontSize: 12 }}>
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="label compact">
          <select className="input compact" value={periodo} onChange={(e) => setPeriodo(e.target.value as typeof periodo)} style={{ fontSize: 12 }}>
            <option value="1T">1T</option>
            <option value="2T">2T</option>
            <option value="3T">3T</option>
            <option value="4T">4T</option>
            <option value="ANUAL">ANUAL</option>
          </select>
        </label>
      </div>

      {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}

      {libro ? (
        <>
          <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <article className="card span-3" style={{ padding: 12 }}>
              <span className="card-eyebrow">Nº facturas</span>
              <strong style={{ fontSize: 22, display: "block", marginTop: 2 }}>{libro.resumen.n_facturas}</strong>
            </article>
            <article className="card span-3" style={{ padding: 12 }}>
              <span className="card-eyebrow">Base imponible</span>
              <strong style={{ fontSize: 18, display: "block", marginTop: 2 }}>{EUR(libro.resumen.base_total)}</strong>
            </article>
            <article className="card span-3" style={{ padding: 12 }}>
              <span className="card-eyebrow">Cuota IVA</span>
              <strong style={{ fontSize: 18, display: "block", marginTop: 2, color: "var(--accent)" }}>{EUR(libro.resumen.cuota_total)}</strong>
            </article>
            <article className="card span-3" style={{ padding: 12 }}>
              <span className="card-eyebrow">Total</span>
              <strong style={{ fontSize: 18, display: "block", marginTop: 2 }}>{EUR(libro.resumen.total)}</strong>
            </article>
          </div>

          {libro.resumen.por_tipo.length > 0 ? (
            <div>
              <span className="card-eyebrow">Desglose por tipo IVA</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {libro.resumen.por_tipo.map((t) => (
                  <span key={t.tipo} className="pill plain" style={{ fontSize: 11 }}>
                    {t.tipo}% · base {EUR(t.base)} · cuota {EUR(t.cuota)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ marginTop: 4, fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Serie/Nº</th>
                  <th>Tipo F.</th>
                  <th>Clave</th>
                  <th>NIF</th>
                  <th>Tercero</th>
                  <th className="num">Base</th>
                  <th className="num">%</th>
                  <th className="num">Cuota</th>
                  <th className="num">IRPF</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {libro.lineas.length === 0 ? (
                  <tr><td colSpan={11} className="muted" style={{ textAlign: "center", padding: 16 }}>Sin movimientos en el periodo.</td></tr>
                ) : libro.lineas.map((l, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "var(--mono)" }}>{l.fecha}</td>
                    <td style={{ fontFamily: "var(--mono)" }}>{l.serie ? `${l.serie}-${l.numero}` : l.numero}</td>
                    <td><span className="pill plain" style={{ fontSize: 10 }}>{l.tipo_factura}</span></td>
                    <td><span className="pill plain" style={{ fontSize: 10 }}>{l.clave_operacion}</span></td>
                    <td style={{ fontFamily: "var(--mono)" }}>{l.contacto_nif || "—"}</td>
                    <td>{l.contacto_nombre || "—"}</td>
                    <td className="num">{EUR(l.base)}</td>
                    <td className="num">{l.tipo_iva_pct}%</td>
                    <td className="num">{EUR(l.cuota_iva)}</td>
                    <td className="num">{l.irpf > 0 ? EUR(l.irpf) : "—"}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{EUR(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : loading ? (
        <p className="muted">Cargando libro…</p>
      ) : null}
    </article>
  );
}
