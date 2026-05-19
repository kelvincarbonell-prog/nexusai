"use client";

import { useState } from "react";
import {
  Sparkles,
  TrendingUp,
  Receipt,
  BookOpen,
  FileBarChart2,
  Users,
  Landmark,
  Archive,
  type LucideIcon,
} from "lucide-react";
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

type TabKey = "resumen" | "asientos" | "informes" | "operaciones" | "cierre";

const TABS: Array<{ key: TabKey; label: string; Icon: LucideIcon; hint: string }> = [
  { key: "resumen", label: "Resumen", Icon: Sparkles, hint: "Bot fiscal y comparativa de evolución" },
  { key: "asientos", label: "Asientos", Icon: BookOpen, hint: "Predefinidos y generación automática" },
  { key: "informes", label: "Informes", Icon: FileBarChart2, hint: "P&G, balance y libro IVA" },
  { key: "operaciones", label: "Operaciones", Icon: Users, hint: "347 terceros y conciliación bancaria" },
  { key: "cierre", label: "Cierre", Icon: Archive, hint: "Regularización y apertura de ejercicio" },
];

/**
 * Workspace contable agrupado en 5 pestañas para que el gestor no tenga
 * que hacer scroll por 9 cards. Cada pestaña carga sólo los paneles que
 * pertenecen a su categoría.
 */
export function ContabilidadMulti({
  empresas,
  initialId,
}: {
  empresas: Empresa[];
  initialId: string;
}) {
  const [empresaId, setEmpresaId] = useState(initialId);
  const [tab, setTab] = useState<TabKey>("resumen");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <EmpresaSelector empresas={empresas} initialId={empresaId} onChange={setEmpresaId} />

      <nav
        role="tablist"
        aria-label="Secciones de contabilidad"
        style={{
          display: "inline-flex",
          gap: 4,
          padding: 4,
          borderRadius: 10,
          background: "color-mix(in srgb, currentColor 5%, transparent)",
          border: "1px solid var(--line, #e5e7eb)",
          alignSelf: "flex-start",
          overflowX: "auto",
          flexWrap: "nowrap",
          maxWidth: "100%",
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          const Icon = t.Icon;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              title={t.hint}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 8,
                border: active ? "1px solid color-mix(in srgb, var(--accent) 35%, transparent)" : "1px solid transparent",
                background: active ? "color-mix(in srgb, var(--accent) 18%, transparent)" : "transparent",
                color: active ? "var(--accent)" : "var(--ink, #111)",
                fontWeight: active ? 600 : 500,
                fontSize: 13,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "background 0.15s, color 0.15s, border-color 0.15s",
              }}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* key forzada para remontar paneles al cambiar de empresa */}
      <div style={{ display: "grid", gap: 18 }}>
        {tab === "resumen" && (
          <>
            <BotFiscalPanel key={`bf-${empresaId}`} empresaId={empresaId} />
            <ComparativaPanel key={`cmp-${empresaId}`} empresaId={empresaId} />
          </>
        )}
        {tab === "asientos" && (
          <>
            <AutoAsientosPanel key={`aa-${empresaId}`} empresaId={empresaId} />
            <AsientosPredefinidosPanel key={`ap-${empresaId}`} empresaId={empresaId} />
          </>
        )}
        {tab === "informes" && (
          <>
            <PyGBalancePanel key={`pyg-${empresaId}`} empresaId={empresaId} />
            <LibroIvaPanel key={`liva-${empresaId}`} empresaId={empresaId} />
          </>
        )}
        {tab === "operaciones" && (
          <>
            <M347Panel key={`m347-${empresaId}`} empresaId={empresaId} />
            <ConciliacionPanel key={`con-${empresaId}`} empresaId={empresaId} />
          </>
        )}
        {tab === "cierre" && (
          <CierreAperturaPanel
            key={`ca-${empresaId}`}
            empresaId={empresaId}
            defaultEjercicio={new Date().getUTCFullYear() - 1}
          />
        )}
      </div>
    </div>
  );
}
