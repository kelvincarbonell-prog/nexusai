"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Scale } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Linea = { code: string; label: string; importe: number; bold?: boolean; level?: 0 | 1 | 2 };
type PyG = { lineas: Linea[]; totales: { resultado_explotacion: number; resultado_antes_impuestos: number; resultado_ejercicio: number; importe_neto_cifra_negocios: number } };
type Balance = {
  activo: Linea[];
  pasivo: Linea[];
  totales: { total_activo: number; total_pasivo: number; patrimonio_neto: number; diferencia: number };
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function PyGBalancePanel({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const currentYear = new Date().getUTCFullYear();
  const [ejercicio, setEjercicio] = useState(currentYear);
  const [tab, setTab] = useState<"pyg" | "balance">("pyg");
  const [pyg, setPyG] = useState<PyG | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const [pygRes, balRes] = await Promise.all([
        fetch(`/api/accounting/pyg?empresa_id=${empresaId}&ejercicio=${ejercicio}`, { headers: { Authorization: `Bearer ${tk}` } }),
        fetch(`/api/accounting/balance?empresa_id=${empresaId}&ejercicio=${ejercicio}`, { headers: { Authorization: `Bearer ${tk}` } }),
      ]);
      const pygJson = await pygRes.json();
      const balJson = await balRes.json();
      if (pygJson.ok) setPyG(pygJson);
      if (balJson.ok) setBalance(balJson);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, ejercicio]);

  return (
    <article className="card span-12" style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 12, background: "color-mix(in srgb, var(--good) 14%, transparent)", display: "grid", placeItems: "center" }}>
            {tab === "pyg" ? <TrendingUp size={22} strokeWidth={1.8} color="var(--good)" /> : <Scale size={22} strokeWidth={1.8} color="var(--good)" />}
          </div>
          <div>
            <span className="card-eyebrow">Informes oficiales PGC PYMES</span>
            <h2 style={{ fontSize: 18, margin: "4px 0 0" }}>
              {tab === "pyg" ? "Cuenta de Pérdidas y Ganancias" : "Balance de Situación"}
            </h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Estructura oficial según Orden EHA/3360/2010. Generado en vivo desde los asientos del diario.
            </p>
          </div>
        </div>
        <div className="form" style={{ gridTemplateColumns: "auto auto", gap: 8 }}>
          <div role="tablist" style={{ display: "flex", gap: 4 }}>
            <button className={`button compact ${tab === "pyg" ? "" : "ghost"}`} onClick={() => setTab("pyg")}>PyG</button>
            <button className={`button compact ${tab === "balance" ? "" : "ghost"}`} onClick={() => setTab("balance")}>Balance</button>
          </div>
          <select className="input compact" value={ejercicio} onChange={(e) => setEjercicio(Number(e.target.value))} style={{ fontSize: 12 }}>
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? <p className="muted">Calculando…</p> : null}

      {tab === "pyg" && pyg ? (
        <>
          <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <article className="card span-4" style={{ padding: 12 }}>
              <span className="card-eyebrow">Cifra de negocios</span>
              <strong style={{ fontSize: 22, display: "block", marginTop: 2 }}>{EUR(pyg.totales.importe_neto_cifra_negocios)}</strong>
            </article>
            <article className="card span-4" style={{ padding: 12, borderColor: pyg.totales.resultado_explotacion >= 0 ? "var(--good)" : "var(--bad)" }}>
              <span className="card-eyebrow">Resultado de explotación</span>
              <strong style={{ fontSize: 22, display: "block", marginTop: 2, color: pyg.totales.resultado_explotacion >= 0 ? "var(--good)" : "var(--bad)" }}>
                {EUR(pyg.totales.resultado_explotacion)}
              </strong>
            </article>
            <article className="card span-4" style={{ padding: 12, borderColor: pyg.totales.resultado_ejercicio >= 0 ? "var(--accent)" : "var(--bad)" }}>
              <span className="card-eyebrow">Resultado del ejercicio</span>
              <strong style={{ fontSize: 22, display: "block", marginTop: 2, color: pyg.totales.resultado_ejercicio >= 0 ? "var(--accent)" : "var(--bad)" }}>
                {EUR(pyg.totales.resultado_ejercicio)}
              </strong>
            </article>
          </div>

          <table className="table" style={{ fontSize: 13 }}>
            <tbody>
              {pyg.lineas.map((l) => {
                const isTotal = l.bold;
                const indent = (l.level ?? 0) * 16;
                return (
                  <tr key={l.code} style={isTotal ? { background: "color-mix(in srgb, var(--accent) 6%, transparent)", borderTop: "1px solid var(--line)" } : undefined}>
                    <td style={{ paddingLeft: 8 + indent, fontFamily: isTotal ? "var(--sans)" : "var(--mono)", fontSize: isTotal ? 13 : 11, fontWeight: isTotal ? 700 : 400, color: isTotal ? "var(--ink)" : "var(--muted)", width: 60 }}>{l.code}</td>
                    <td style={{ fontWeight: isTotal ? 700 : 400, fontSize: isTotal ? 13 : 12 }}>{l.label}</td>
                    <td className="num" style={{ fontWeight: isTotal ? 700 : 500, color: isTotal && l.importe < 0 ? "var(--bad)" : isTotal ? "var(--ink)" : undefined, fontSize: isTotal ? 14 : 12 }}>
                      {EUR(l.importe)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ) : null}

      {tab === "balance" && balance ? (
        <>
          <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <article className="card span-4" style={{ padding: 12, borderColor: "var(--accent)" }}>
              <span className="card-eyebrow">Total Activo</span>
              <strong style={{ fontSize: 22, display: "block", marginTop: 2 }}>{EUR(balance.totales.total_activo)}</strong>
            </article>
            <article className="card span-4" style={{ padding: 12 }}>
              <span className="card-eyebrow">Patrimonio Neto</span>
              <strong style={{ fontSize: 22, display: "block", marginTop: 2, color: balance.totales.patrimonio_neto >= 0 ? "var(--good)" : "var(--bad)" }}>
                {EUR(balance.totales.patrimonio_neto)}
              </strong>
            </article>
            <article className="card span-4" style={{ padding: 12, borderColor: Math.abs(balance.totales.diferencia) < 1 ? "var(--good)" : "var(--bad)" }}>
              <span className="card-eyebrow">Cuadre (Activo − P+PN)</span>
              <strong style={{ fontSize: 22, display: "block", marginTop: 2, color: Math.abs(balance.totales.diferencia) < 1 ? "var(--good)" : "var(--bad)" }}>
                {EUR(balance.totales.diferencia)}
              </strong>
            </article>
          </div>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <article className="card span-6">
              <span className="card-eyebrow">ACTIVO</span>
              <table className="table" style={{ fontSize: 12, marginTop: 6 }}>
                <tbody>
                  {balance.activo.map((l) => {
                    const isTotal = l.bold;
                    const indent = (l.level ?? 0) * 12;
                    return (
                      <tr key={l.code} style={isTotal ? { background: "color-mix(in srgb, var(--accent) 6%, transparent)" } : undefined}>
                        <td style={{ paddingLeft: 6 + indent, fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", width: 50 }}>{l.code}</td>
                        <td style={{ fontWeight: isTotal ? 700 : 400, fontSize: isTotal ? 12 : 11 }}>{l.label}</td>
                        <td className="num" style={{ fontWeight: isTotal ? 700 : 400, fontSize: isTotal ? 13 : 11 }}>{EUR(l.importe)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </article>
            <article className="card span-6">
              <span className="card-eyebrow">PATRIMONIO NETO Y PASIVO</span>
              <table className="table" style={{ fontSize: 12, marginTop: 6 }}>
                <tbody>
                  {balance.pasivo.map((l) => {
                    const isTotal = l.bold;
                    const indent = (l.level ?? 0) * 12;
                    return (
                      <tr key={l.code} style={isTotal ? { background: "color-mix(in srgb, var(--good) 6%, transparent)" } : undefined}>
                        <td style={{ paddingLeft: 6 + indent, fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", width: 50 }}>{l.code}</td>
                        <td style={{ fontWeight: isTotal ? 700 : 400, fontSize: isTotal ? 12 : 11 }}>{l.label}</td>
                        <td className="num" style={{ fontWeight: isTotal ? 700 : 400, fontSize: isTotal ? 13 : 11 }}>{EUR(l.importe)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </article>
          </div>
        </>
      ) : null}
    </article>
  );
}
