"use client";

import { useState } from "react";
import { FacturasTab } from "@/components/billing/facturas-tab";
import { PresupuestosTab } from "@/components/billing/presupuestos-tab";
import { RecurrentesTab } from "@/components/billing/recurrentes-tab";

type Empresa = { id: string; nombre: string };
type Tab = "facturas" | "presupuestos" | "recurrentes";

export function BillingWorkspace({ empresas, initial = "facturas" }: { empresas: Empresa[]; initial?: Tab }) {
  const [tab, setTab] = useState<Tab>(initial);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="aeat-tabs" role="tablist" aria-label="Facturación">
        <button role="tab" aria-selected={tab === "facturas"} onClick={() => setTab("facturas")} className={`button ${tab === "facturas" ? "" : "secondary"} compact`}>
          Facturas
        </button>
        <button role="tab" aria-selected={tab === "presupuestos"} onClick={() => setTab("presupuestos")} className={`button ${tab === "presupuestos" ? "" : "secondary"} compact`}>
          Presupuestos
        </button>
        <button role="tab" aria-selected={tab === "recurrentes"} onClick={() => setTab("recurrentes")} className={`button ${tab === "recurrentes" ? "" : "secondary"} compact`}>
          Recurrentes
        </button>
      </div>

      {tab === "facturas" ? <FacturasTab empresas={empresas} /> : null}
      {tab === "presupuestos" ? <PresupuestosTab empresas={empresas} /> : null}
      {tab === "recurrentes" ? <RecurrentesTab empresas={empresas} /> : null}
    </div>
  );
}
