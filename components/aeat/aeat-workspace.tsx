"use client";

import { useState } from "react";
import { Casillas303 } from "@/components/aeat/casillas-303";
import { CasillasSimple } from "@/components/aeat/casillas-simple";
import { Casillas200 } from "@/components/aeat/casillas-200";
import { Casillas202 } from "@/components/aeat/casillas-202";

type Empresa = { id: string; nombre: string; nif?: string };

type ModeloKey = "100" | "303" | "111" | "115" | "123" | "130" | "180" | "184" | "190" | "193" | "200" | "202" | "210" | "232" | "296" | "309" | "347" | "349" | "390" | "720";

const TABS: { key: ModeloKey; label: string; hint: string; group: "trimestral" | "anual" }[] = [
  { key: "303", label: "303 · IVA", hint: "Autoliquidación trimestral de IVA", group: "trimestral" },
  { key: "111", label: "111 · IRPF retenciones", hint: "Trabajadores y profesionales", group: "trimestral" },
  { key: "115", label: "115 · Alquileres", hint: "Retenciones de arrendamientos", group: "trimestral" },
  { key: "123", label: "123 · Capital mobiliario", hint: "Retenciones dividendos/intereses (19 %)", group: "trimestral" },
  { key: "130", label: "130 · Autónomos", hint: "Pago fraccionado IRPF", group: "trimestral" },
  { key: "210", label: "210 · No residentes", hint: "Retenciones a no residentes (renta puntual)", group: "trimestral" },
  { key: "309", label: "309 · IVA no periódico", hint: "Liquidación IVA operación puntual", group: "trimestral" },
  { key: "349", label: "349 · Intracom.", hint: "Operaciones intracomunitarias", group: "trimestral" },
  { key: "100", label: "100 · Renta", hint: "IRPF anual particulares y autónomos", group: "anual" },
  { key: "180", label: "180 · Resumen alquileres", hint: "Resumen anual retenciones alquileres", group: "anual" },
  { key: "184", label: "184 · Atribución rentas", hint: "Comunidades de bienes, sociedades civiles", group: "anual" },
  { key: "190", label: "190 · Resumen IRPF", hint: "Resumen anual de retenciones IRPF", group: "anual" },
  { key: "193", label: "193 · Resumen capital", hint: "Resumen anual capital mobiliario", group: "anual" },
  { key: "200", label: "200 · Sociedades", hint: "Impuesto sobre Sociedades anual", group: "anual" },
  { key: "202", label: "202 · Pago fraccionado IS", hint: "Pagos a cuenta IS (abr/oct/dic)", group: "trimestral" },
  { key: "232", label: "232 · Vinculadas", hint: "Operaciones vinculadas y paraísos fiscales", group: "anual" },
  { key: "296", label: "296 · No residentes anual", hint: "Resumen anual retenciones no residentes", group: "anual" },
  { key: "347", label: "347 · Terceros", hint: "Operaciones con terceros >3.005 € anuales", group: "anual" },
  { key: "390", label: "390 · Resumen IVA", hint: "Resumen anual de IVA (agrega los 4 trimestres del 303)", group: "anual" },
  { key: "720", label: "720 · Extranjero", hint: "Bienes y derechos en el extranjero", group: "anual" },
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
      ) : active === "200" ? (
        <Casillas200 empresas={empresas} />
      ) : active === "202" ? (
        <Casillas202 empresas={empresas} />
      ) : (
        <CasillasSimple modelo={active} empresas={empresas} />
      )}
    </div>
  );
}
