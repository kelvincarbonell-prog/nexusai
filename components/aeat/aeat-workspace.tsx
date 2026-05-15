"use client";

import { useState } from "react";
import { Casillas303 } from "@/components/aeat/casillas-303";
import { CasillasSimple } from "@/components/aeat/casillas-simple";

type Empresa = { id: string; nombre: string; nif?: string };

const TABS: { key: "303" | "111" | "115" | "130"; label: string; hint: string }[] = [
  { key: "303", label: "303 · IVA", hint: "Autoliquidación trimestral de IVA" },
  { key: "111", label: "111 · IRPF retenciones", hint: "Trabajadores y profesionales" },
  { key: "115", label: "115 · Alquileres", hint: "Retenciones de arrendamientos" },
  { key: "130", label: "130 · Autónomos", hint: "Pago fraccionado IRPF" },
];

export function AeatWorkspace({ empresas, initialModelo = "303" }: { empresas: Empresa[]; initialModelo?: "303" | "111" | "115" | "130" }) {
  const [active, setActive] = useState(initialModelo);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div role="tablist" aria-label="Modelos AEAT" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
