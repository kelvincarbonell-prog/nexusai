"use client";

import { useState } from "react";
import { EmpresaSelector } from "@/components/accounting/empresa-selector";
import { AutoAsientosPanel } from "@/components/accounting/auto-asientos-panel";
import { PyGBalancePanel } from "@/components/accounting/pyg-balance-panel";
import { LibroIvaPanel } from "@/components/accounting/libro-iva-panel";
import { CierreAperturaPanel } from "@/components/accounting/cierre-apertura-panel";
import { ConciliacionPanel } from "@/components/accounting/conciliacion-panel";
import { AsientosPredefinidosPanel } from "@/components/accounting/asientos-predefinidos-panel";
import { ComparativaPanel } from "@/components/accounting/comparativa-panel";
import { BotFiscalPanel } from "@/components/dashboard/bot-fiscal-panel";
import { M347Panel } from "@/components/accounting/m347-panel";

type Empresa = { id: string; nombre: string | null; nif?: string | null };

/**
 * Renderiza todos los paneles de contabilidad para una empresa seleccionable.
 * Si el gestor cambia de cliente en el selector, los paneles se recargan.
 */
export function ContabilidadMulti({
  empresas,
  initialId,
}: {
  empresas: Empresa[];
  initialId: string;
}) {
  const [empresaId, setEmpresaId] = useState(initialId);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <EmpresaSelector empresas={empresas} initialId={empresaId} onChange={setEmpresaId} />

      {/* Key forzada para remontar los paneles al cambiar de cliente */}
      <BotFiscalPanel key={`bf-${empresaId}`} empresaId={empresaId} />
      <ComparativaPanel key={`cmp-${empresaId}`} empresaId={empresaId} />
      <AutoAsientosPanel key={`aa-${empresaId}`} empresaId={empresaId} />
      <AsientosPredefinidosPanel key={`ap-${empresaId}`} empresaId={empresaId} />
      <PyGBalancePanel key={`pyg-${empresaId}`} empresaId={empresaId} />
      <LibroIvaPanel key={`liva-${empresaId}`} empresaId={empresaId} />
      <M347Panel key={`m347-${empresaId}`} empresaId={empresaId} />
      <ConciliacionPanel key={`con-${empresaId}`} empresaId={empresaId} />
      <CierreAperturaPanel
        key={`ca-${empresaId}`}
        empresaId={empresaId}
        defaultEjercicio={new Date().getUTCFullYear() - 1}
      />
    </div>
  );
}
