"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Trabajador = { id: string; nombre: string };

type Bonificacion = {
  codigo: string;
  nombre: string;
  importe_anual: number;
  duracion_meses: number;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function BonificacionesModal({ trabajador, onClose }: { trabajador: Trabajador; onClose: () => void }) {
  const [flags, setFlags] = useState({
    parado_larga_duracion: false,
    primer_empleo_joven: false,
    victima_violencia: false,
    zona_rural_despoblada: false,
  });
  const [bonis, setBonis] = useState<Bonificacion[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(k: keyof typeof flags) {
    setFlags((p) => ({ ...p, [k]: !p[k] }));
  }

  async function calcular() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createBrowserSupabase();
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/laboral/bonificaciones", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ trabajador_id: trabajador.id, ...flags }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setBonis(json.bonificaciones ?? []);
      setTotal(json.total_anual ?? 0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 999,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ maxWidth: 640, width: "100%", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <span className="card-eyebrow">Bonificaciones SS 2026</span>
            <h2 style={{ fontSize: 20, margin: "4px 0 0" }}>{trabajador.nombre}</h2>
          </div>
          <button className="button ghost compact" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <p className="muted" style={{ fontSize: 13 }}>
          Indica las circunstancias que aplican y calcula las bonificaciones de la cuota empresarial.
        </p>

        <div className="form two-cols">
          <label className="label" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={flags.parado_larga_duracion} onChange={() => toggle("parado_larga_duracion")} />
            Parado de larga duración
          </label>
          <label className="label" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={flags.primer_empleo_joven} onChange={() => toggle("primer_empleo_joven")} />
            Primer empleo joven (&lt; 30)
          </label>
          <label className="label" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={flags.victima_violencia} onChange={() => toggle("victima_violencia")} />
            Víctima violencia de género
          </label>
          <label className="label" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={flags.zona_rural_despoblada} onChange={() => toggle("zona_rural_despoblada")} />
            Zona rural despoblada
          </label>
        </div>

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}

        {bonis.length > 0 ? (
          <div>
            <div className="metric accent">{EUR(total)}</div>
            <div className="metric-foot good">de bonificación anual</div>
            <table className="table" style={{ marginTop: 12 }}>
              <thead><tr><th>Código</th><th>Concepto</th><th className="num">Anual</th><th className="num">Meses</th></tr></thead>
              <tbody>
                {bonis.map((b) => (
                  <tr key={b.codigo}>
                    <td style={{ fontFamily: "var(--mono)" }}>{b.codigo}</td>
                    <td>{b.nombre}</td>
                    <td className="num">{EUR(b.importe_anual)}</td>
                    <td className="num">{b.duracion_meses >= 999 ? "∞" : b.duracion_meses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="button-row" style={{ justifyContent: "flex-end" }}>
          <button className="button" onClick={calcular} disabled={loading}>
            {loading ? "Calculando…" : "Calcular bonificaciones"}
          </button>
        </div>
      </div>
    </div>
  );
}
