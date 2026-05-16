"use client";

import { useState } from "react";
import Link from "next/link";
import { BillingWorkspace } from "@/components/billing/billing-workspace";
import { AeatWorkspace } from "@/components/aeat/aeat-workspace";
import { WorkerManager } from "@/components/laboral/worker-manager";
import { PlantillaFacturaForm } from "@/components/empresas/plantilla-factura-form";
import { OcrUpload } from "@/components/clientes/ocr-upload";
import { ClienteResumen } from "@/components/clientes/cliente-resumen";
import { ClienteConfigForm } from "@/components/clientes/cliente-config-form";
import { ClienteCopilot } from "@/components/clientes/cliente-copilot";

type Empresa = {
  id: string;
  nombre: string;
  nif: string | null;
  account_type: string | null;
  plan: string | null;
  inbox_alias: string | null;
  metadata: Record<string, unknown>;
};

const TABS = [
  { key: "resumen", label: "Resumen", emoji: "📊" },
  { key: "ocr", label: "Subir factura (OCR)", emoji: "🪄" },
  { key: "facturacion", label: "Facturación", emoji: "🧾" },
  { key: "aeat", label: "IVA y modelos", emoji: "📄" },
  { key: "laboral", label: "Laboral", emoji: "👥" },
  { key: "contabilidad", label: "Contabilidad", emoji: "📚" },
  { key: "plantilla", label: "Plantilla facturas", emoji: "🎨" },
  { key: "config", label: "Configuración", emoji: "⚙️" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ClienteWorkspace({ empresa }: { empresa: Empresa }) {
  const [tab, setTab] = useState<TabKey>("resumen");
  const empresaSingleton = [{ id: empresa.id, nombre: empresa.nombre, nif: empresa.nif ?? undefined }];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <header style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            borderRadius: 14,
            background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-2, var(--accent)) 100%)",
            display: "grid",
            placeItems: "center",
            color: "white",
            fontSize: 26,
            fontWeight: 800,
          }}
        >
          {empresa.nombre?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div style={{ flex: 1 }}>
          <div className="crumbs">
            <Link href="/dashboard">despacho</Link>
            <span>/</span>
            <Link href="/dashboard?view=clientes">clientes</Link>
            <span>/</span>
            <strong>{empresa.nombre}</strong>
          </div>
          <h1 className="title" style={{ fontSize: 32, marginTop: 6 }}>
            {empresa.nombre}
            <em style={{ marginLeft: 12, fontStyle: "normal", color: "var(--muted)", fontSize: 16, fontWeight: 500 }}>
              {empresa.account_type === "autonomo" ? "Autónomo" : "Empresa"}
            </em>
          </h1>
          <div className="button-row" style={{ marginTop: 8 }}>
            <span className="pill plain" style={{ fontFamily: "var(--mono)" }}>{empresa.nif ?? "sin NIF"}</span>
            {empresa.plan ? <span className="pill dark">plan {empresa.plan}</span> : null}
            {empresa.inbox_alias ? <span className="pill accent" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{empresa.inbox_alias}@inbox</span> : null}
          </div>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Secciones del cliente"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          borderBottom: "1px solid var(--line)",
          paddingBottom: 8,
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`button ${tab === t.key ? "" : "ghost"} compact`}
            style={{
              fontSize: 13,
              borderRadius: 8,
              transition: "background-color 0.15s ease, transform 0.1s ease",
            }}
          >
            <span style={{ marginRight: 6 }}>{t.emoji}</span>{t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === "resumen" ? <ClienteResumen empresaId={empresa.id} /> : null}
        {tab === "ocr" ? <OcrUpload empresaId={empresa.id} /> : null}
        {tab === "facturacion" ? <BillingWorkspace empresas={empresaSingleton} /> : null}
        {tab === "aeat" ? <AeatWorkspace empresas={empresaSingleton} /> : null}
        {tab === "laboral" ? <WorkerManager empresas={empresaSingleton} /> : null}
        {tab === "contabilidad" ? (
          <section className="grid">
            <article className="card span-12" style={{ textAlign: "center", padding: 32 }}>
              <span className="card-eyebrow">Libro diario y mayor</span>
              <p style={{ marginTop: 12, fontSize: 14 }}>
                La contabilidad se gestiona desde la sección global de contabilidad para no duplicar la vista.
              </p>
              <div className="button-row" style={{ justifyContent: "center", marginTop: 16 }}>
                <Link href="/contabilidad" className="button">Ir a contabilidad →</Link>
              </div>
            </article>
          </section>
        ) : null}
        {tab === "plantilla" ? <PlantillaFacturaForm empresaId={empresa.id} empresaNombre={empresa.nombre} /> : null}
        {tab === "config" ? <ClienteConfigForm empresa={empresa} /> : null}
      </div>

      <ClienteCopilot
        empresa={{
          id: empresa.id,
          nombre: empresa.nombre,
          nif: empresa.nif,
          account_type: empresa.account_type,
        }}
      />
    </div>
  );
}
