"use client";

import { useState } from "react";
import { Casillas303 } from "@/components/aeat/casillas-303";
import { CasillasSimple } from "@/components/aeat/casillas-simple";

type Empresa = { id: string; nombre: string; nif?: string };

type ModeloKey = "303" | "111" | "115" | "130" | "390" | "347" | "349" | "180" | "190" | "232";

const TABS: { key: ModeloKey; label: string; hint: string; group: "trimestral" | "anual" }[] = [
  { key: "303", label: "303 · IVA", hint: "Autoliquidación trimestral de IVA", group: "trimestral" },
  { key: "111", label: "111 · IRPF retenciones", hint: "Trabajadores y profesionales", group: "trimestral" },
  { key: "115", label: "115 · Alquileres", hint: "Retenciones de arrendamientos", group: "trimestral" },
  { key: "130", label: "130 · Autónomos", hint: "Pago fraccionado IRPF", group: "trimestral" },
  { key: "349", label: "349 · Intracom.", hint: "Operaciones intracomunitarias", group: "trimestral" },
  { key: "390", label: "390 · Resumen IVA", hint: "Resumen anual de IVA (agrega los 4 trimestres del 303)", group: "anual" },
  { key: "190", label: "190 · Resumen IRPF", hint: "Resumen anual de retenciones IRPF", group: "anual" },
  { key: "180", label: "180 · Resumen alquileres", hint: "Resumen anual retenciones alquileres", group: "anual" },
  { key: "347", label: "347 · Terceros", hint: "Operaciones con terceros >3.005 € anuales", group: "anual" },
  { key: "232", label: "232 · Vinculadas", hint: "Operaciones vinculadas y paraísos fiscales", group: "anual" },
];

export function AeatWorkspace({ empresas, initialModelo = "303" }: { empresas: Empresa[]; initialModelo?: ModeloKey }) {
  const [active, setActive] = useState(initialModelo);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="aeat-tabs" role="tablist" aria-label="Modelos AEAT">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={`button ${active === t.key ? "" : "secondary"} compact`}
            title={t.hint}
          >
            {t.label}
          </button>
        ))}
      </div>
      {active === "303" ? (
        <Casillas303 empresas={empresas} />
      ) : (
        <CasillasSimple modelo={active} empresas={empresas} />
      )}
    </div>
  );
}
