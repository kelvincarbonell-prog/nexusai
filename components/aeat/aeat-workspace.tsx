"use client";

import { useMemo, useState } from "react";
import { Casillas303 } from "@/components/aeat/casillas-303";
import { CasillasSimple } from "@/components/aeat/casillas-simple";
import { Casillas200 } from "@/components/aeat/casillas-200";
import { Casillas202 } from "@/components/aeat/casillas-202";

type Empresa = { id: string; nombre: string; nif?: string; account_type?: string | null; tipo?: string | null };

type ModeloKey = "100" | "303" | "111" | "115" | "123" | "130" | "180" | "184" | "190" | "193" | "200" | "202" | "210" | "232" | "296" | "309" | "347" | "349" | "390" | "720";

type Aplicabilidad = ("autonomo" | "empresa")[];

const TABS: { key: ModeloKey; label: string; hint: string; group: "trimestral" | "anual"; aplica: Aplicabilidad }[] = [
  // Comunes (autónomo + empresa)
  { key: "303", label: "303 · IVA", hint: "Autoliquidación trimestral de IVA", group: "trimestral", aplica: ["autonomo", "empresa"] },
  { key: "111", label: "111 · IRPF retenciones", hint: "Trabajadores y profesionales", group: "trimestral", aplica: ["autonomo", "empresa"] },
  { key: "115", label: "115 · Alquileres", hint: "Retenciones de arrendamientos", group: "trimestral", aplica: ["autonomo", "empresa"] },
  { key: "123", label: "123 · Capital mobiliario", hint: "Retenciones dividendos/intereses (19 %)", group: "trimestral", aplica: ["autonomo", "empresa"] },
  { key: "309", label: "309 · IVA no periódico", hint: "Liquidación IVA operación puntual", group: "trimestral", aplica: ["autonomo", "empresa"] },
  { key: "349", label: "349 · Intracom.", hint: "Operaciones intracomunitarias", group: "trimestral", aplica: ["autonomo", "empresa"] },
  { key: "210", label: "210 · No residentes", hint: "Retenciones a no residentes (renta puntual)", group: "trimestral", aplica: ["autonomo", "empresa"] },

  // Solo autónomo
  { key: "130", label: "130 · Autónomos", hint: "Pago fraccionado IRPF estimación directa — SOLO autónomos", group: "trimestral", aplica: ["autonomo"] },
  { key: "100", label: "100 · Renta", hint: "IRPF anual — SOLO autónomo / persona física", group: "anual", aplica: ["autonomo"] },
  { key: "184", label: "184 · Atribución rentas", hint: "Comunidades de bienes, sociedades civiles — atribución a comuneros", group: "anual", aplica: ["autonomo"] },

  // Solo empresa
  { key: "200", label: "200 · Sociedades", hint: "Impuesto sobre Sociedades anual — SOLO empresa", group: "anual", aplica: ["empresa"] },
  { key: "202", label: "202 · Pago fraccionado IS", hint: "Pagos a cuenta IS (abr/oct/dic) — SOLO empresa", group: "trimestral", aplica: ["empresa"] },
  { key: "232", label: "232 · Vinculadas", hint: "Operaciones vinculadas y paraísos fiscales — SOLO empresa", group: "anual", aplica: ["empresa"] },

  // Resúmenes anuales (comunes)
  { key: "180", label: "180 · Resumen alquileres", hint: "Resumen anual retenciones alquileres", group: "anual", aplica: ["autonomo", "empresa"] },
  { key: "190", label: "190 · Resumen IRPF", hint: "Resumen anual de retenciones IRPF", group: "anual", aplica: ["autonomo", "empresa"] },
  { key: "193", label: "193 · Resumen capital", hint: "Resumen anual capital mobiliario", group: "anual", aplica: ["autonomo", "empresa"] },
  { key: "296", label: "296 · No residentes anual", hint: "Resumen anual retenciones no residentes", group: "anual", aplica: ["autonomo", "empresa"] },
  { key: "347", label: "347 · Terceros", hint: "Operaciones con terceros >3.005 € anuales", group: "anual", aplica: ["autonomo", "empresa"] },
  { key: "390", label: "390 · Resumen IVA", hint: "Resumen anual de IVA (agrega los 4 trimestres del 303)", group: "anual", aplica: ["autonomo", "empresa"] },
  { key: "720", label: "720 · Extranjero", hint: "Bienes y derechos en el extranjero", group: "anual", aplica: ["autonomo", "empresa"] },
];

export function AeatWorkspace({ empresas, initialModelo = "303" }: { empresas: Empresa[]; initialModelo?: ModeloKey }) {
  const [active, setActive] = useState<ModeloKey>(initialModelo);
  const [empresaId, setEmpresaId] = useState<string>(empresas[0]?.id ?? "");

  const empresaSel = empresas.find((e) => e.id === empresaId);
  const tipoRaw = (empresaSel?.account_type ?? empresaSel?.tipo ?? "autonomo").toString().toLowerCase();
  const tipo: "autonomo" | "empresa" = tipoRaw === "empresa" || tipoRaw === "sociedad" ? "empresa" : "autonomo";

  const visibleTabs = useMemo(() => TABS.filter((t) => t.aplica.includes(tipo)), [tipo]);

  // Si el tab activo no aplica al tipo, salta a 303 (universal)
  if (!visibleTabs.some((t) => t.key === active)) {
    setTimeout(() => setActive("303"), 0);
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {empresas.length > 1 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <label style={{ fontSize: 12, opacity: 0.75, fontWeight: 600 }}>Empresa</label>
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid color-mix(in srgb, currentColor 16%, transparent)", background: "color-mix(in srgb, currentColor 4%, transparent)", color: "inherit", fontSize: 13 }}
          >
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre} {e.account_type === "empresa" ? "(sociedad)" : "(autónomo)"}
              </option>
            ))}
          </select>
          <span
            style={{
              padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase",
              background: tipo === "empresa" ? "color-mix(in srgb, #3b82f6 14%, transparent)" : "color-mix(in srgb, #10b981 14%, transparent)",
              color: tipo === "empresa" ? "#3b82f6" : "#10b981",
            }}
          >
            modelos para {tipo}
          </span>
        </div>
      ) : null}

      <div className="aeat-tabs" role="tablist" aria-label="Modelos AEAT">
        {visibleTabs.map((t) => (
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
