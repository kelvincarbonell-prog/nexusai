"use client";

import { useMemo, useState } from "react";
import { ListChecks, Search, ArrowDownToLine, ArrowUpFromLine, Info } from "lucide-react";
import { CONCEPTOS_NOMINA, type ConceptoCatalogo, type TipoConcepto } from "@/lib/laboral/conceptos";

type Filtro = "todos" | TipoConcepto;

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/**
 * Catálogo visual de los conceptos de nómina disponibles (estilo A3NOM).
 * Solo lectura por ahora — sirve como referencia para que el gestor sepa
 * qué conceptos puede aplicar en las nóminas y cómo tributan.
 */
export function ConceptosCatalogPanel() {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [q, setQ] = useState("");

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CONCEPTOS_NOMINA.filter((c) => {
      if (filtro !== "todos" && c.tipo !== filtro) return false;
      if (!needle) return true;
      return [c.codigo, c.nombre, c.descripcion].some((s) => s.toLowerCase().includes(needle));
    });
  }, [filtro, q]);

  const devengos = CONCEPTOS_NOMINA.filter((c) => c.tipo === "devengo").length;
  const deducciones = CONCEPTOS_NOMINA.filter((c) => c.tipo === "deduccion").length;

  return (
    <section className="card" style={{ display: "grid", gap: 12 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <ListChecks size={18} />
        <div>
          <span className="card-eyebrow">Catálogo</span>
          <h3 style={{ margin: 0, fontSize: 18 }}>Conceptos de nómina</h3>
        </div>
        <span className="muted" style={{ marginLeft: "auto", fontSize: 12 }}>
          {devengos} devengos · {deducciones} deducciones
        </span>
      </header>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }} />
          <input
            className="input"
            placeholder="Buscar concepto, código o descripción…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 30, width: "100%" }}
          />
        </div>
        {(["todos", "devengo", "deduccion"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className={`button compact ${filtro === f ? "" : "ghost"}`}
            onClick={() => setFiltro(f)}
          >
            {f === "todos" ? "Todos" : f === "devengo" ? "Devengos" : "Deducciones"}
          </button>
        ))}
      </div>

      <div style={{ overflow: "auto", border: "1px solid var(--line, #e5e7eb)", borderRadius: 10 }}>
        <table className="table" style={{ width: "100%", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ width: 60 }}>Cód.</th>
              <th>Concepto</th>
              <th style={{ width: 90 }}>Tipo</th>
              <th style={{ width: 70, textAlign: "center" }} title="Cotiza Contingencias Comunes">CC</th>
              <th style={{ width: 70, textAlign: "center" }} title="Cotiza AT/EP">AT/EP</th>
              <th style={{ width: 70, textAlign: "center" }} title="Sujeto a IRPF">IRPF</th>
              <th style={{ width: 130 }} className="num">Exención anual</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 16 }}>Sin resultados</td></tr>
            ) : (
              items.map((c) => <ConceptoRow key={c.codigo} c={c} />)
            )}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ fontSize: 11, margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Info size={12} /> Los importes con exención están limitados al máximo anual indicado por la LIRPF; el exceso cotiza y tributa.
      </p>
    </section>
  );
}

function ConceptoRow({ c }: { c: ConceptoCatalogo }) {
  const tipoLabel = c.tipo === "devengo" ? "Devengo" : "Deducción";
  const tipoColor = c.tipo === "devengo" ? "var(--good)" : "var(--bad)";
  const TipoIcon = c.tipo === "devengo" ? ArrowDownToLine : ArrowUpFromLine;
  return (
    <tr>
      <td style={{ fontFamily: "var(--mono, monospace)", fontSize: 12 }}>{c.codigo}</td>
      <td>
        <div style={{ display: "grid", gap: 2 }}>
          <strong style={{ fontSize: 13 }}>{c.nombre}</strong>
          <span className="muted" style={{ fontSize: 11, lineHeight: 1.35 }}>{c.descripcion}</span>
        </div>
      </td>
      <td>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, background: `color-mix(in srgb, ${tipoColor} 14%, transparent)`, color: tipoColor, fontSize: 11, fontWeight: 600 }}>
          <TipoIcon size={11} /> {tipoLabel}
        </span>
      </td>
      <td style={{ textAlign: "center" }}>{c.cotiza_cc ? "✓" : "—"}</td>
      <td style={{ textAlign: "center" }}>{c.cotiza_atyepy ? "✓" : "—"}</td>
      <td style={{ textAlign: "center" }}>{c.sujeto_irpf ? "✓" : "—"}</td>
      <td className="num" style={{ fontSize: 12 }}>{c.exencion_anual ? EUR(c.exencion_anual) : "—"}</td>
    </tr>
  );
}
