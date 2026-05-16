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
import { ClienteDocumentos } from "@/components/clientes/cliente-documentos";
import { ClienteFirmas } from "@/components/clientes/cliente-firmas";
import { ClienteAuditoria } from "@/components/clientes/cliente-auditoria";
import { ClienteBancos } from "@/components/clientes/cliente-bancos";
import { ClienteImportar } from "@/components/clientes/cliente-importar";

type Empresa = {
  id: string;
  nombre: string;
  nif: string | null;
  account_type: string | null;
  plan: string | null;
  inbox_alias: string | null;
  metadata: Record<string, unknown>;
};

type TabKey =
  | "resumen"
  | "ocr"
  | "importar"
  | "facturacion"
  | "aeat"
  | "contabilidad"
  | "laboral"
  | "nominas"
  | "contratos"
  | "bancos"
  | "documentos"
  | "firmas"
  | "auditoria"
  | "plantilla"
  | "config";

type TabDef = { key: TabKey; label: string; emoji: string };

const TABS_BY_GROUP: { group: string; tabs: TabDef[] }[] = [
  {
    group: "Vista",
    tabs: [
      { key: "resumen", label: "Resumen", emoji: "📊" },
      { key: "auditoria", label: "Auditoría", emoji: "🕒" },
    ],
  },
  {
    group: "Operativa",
    tabs: [
      { key: "ocr", label: "Subir factura (OCR)", emoji: "🪄" },
      { key: "importar", label: "Importar (A3/Quipu/…)", emoji: "📥" },
      { key: "facturacion", label: "Facturación", emoji: "🧾" },
    ],
  },
  {
    group: "Fiscal & contable",
    tabs: [
      { key: "aeat", label: "IVA y modelos", emoji: "📄" },
      { key: "contabilidad", label: "Contabilidad", emoji: "📚" },
    ],
  },
  {
    group: "Personas",
    tabs: [
      { key: "laboral", label: "Laboral", emoji: "👥" },
      { key: "nominas", label: "Nóminas", emoji: "💶" },
      { key: "contratos", label: "Contratos", emoji: "📑" },
    ],
  },
  {
    group: "Archivo",
    tabs: [
      { key: "bancos", label: "Bancos", emoji: "🏦" },
      { key: "documentos", label: "Documentos", emoji: "📁" },
      { key: "firmas", label: "Cl@ve & firmas", emoji: "✍️" },
    ],
  },
  {
    group: "Configuración",
    tabs: [
      { key: "plantilla", label: "Plantilla facturas", emoji: "🎨" },
      { key: "config", label: "Configuración", emoji: "⚙️" },
    ],
  },
];

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
            flexShrink: 0,
          }}
        >
          {empresa.nombre?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="crumbs">
            <Link href="/dashboard">despacho</Link>
            <span>/</span>
            <Link href="/clientes">clientes</Link>
            <span>/</span>
            <strong>{empresa.nombre}</strong>
          </div>
          <h1 className="title" style={{ fontSize: "clamp(20px, 3vw, 32px)", marginTop: 6 }}>
            {empresa.nombre}
            <em style={{ marginLeft: 12, fontStyle: "normal", color: "var(--muted)", fontSize: 16, fontWeight: 500 }}>
              {empresa.account_type === "autonomo" ? "Autónomo" : "Empresa"}
            </em>
          </h1>
          <div className="button-row" style={{ marginTop: 8, flexWrap: "wrap" }}>
            <span className="pill plain" style={{ fontFamily: "var(--mono)" }}>{empresa.nif ?? "sin NIF"}</span>
            {empresa.plan ? <span className="pill dark">plan {empresa.plan}</span> : null}
            {empresa.inbox_alias ? (
              <span className="pill accent" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                {empresa.inbox_alias}@inbox
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <nav
        role="tablist"
        aria-label="Secciones del cliente"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          borderBottom: "1px solid var(--line)",
          paddingBottom: 12,
        }}
      >
        {TABS_BY_GROUP.map((grp) => (
          <div key={grp.group} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            <span
              className="card-eyebrow"
              style={{
                fontSize: 10,
                color: "var(--muted)",
                minWidth: 110,
                fontFamily: "var(--mono)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {grp.group}
            </span>
            {grp.tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`button ${tab === t.key ? "" : "ghost"} compact`}
                style={{
                  fontSize: 12.5,
                  borderRadius: 8,
                }}
              >
                <span style={{ marginRight: 4 }}>{t.emoji}</span>{t.label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div>
        {tab === "resumen" ? <ClienteResumen empresaId={empresa.id} /> : null}
        {tab === "auditoria" ? <ClienteAuditoria empresaId={empresa.id} /> : null}
        {tab === "ocr" ? <OcrUpload empresaId={empresa.id} /> : null}
        {tab === "importar" ? <ClienteImportar empresaId={empresa.id} /> : null}
        {tab === "facturacion" ? <BillingWorkspace empresas={empresaSingleton} /> : null}
        {tab === "aeat" ? <AeatWorkspace empresas={empresaSingleton} /> : null}
        {tab === "contabilidad" ? (
          <section className="grid">
            <article className="card span-12" style={{ textAlign: "center", padding: 32 }}>
              <span className="card-eyebrow">Libro diario · cierre · balance</span>
              <p style={{ marginTop: 12, fontSize: 14, maxWidth: 520, marginInline: "auto" }}>
                La contabilidad detallada (PGC, diario, mayor, sumas y saldos, cierre/apertura) vive en el módulo
                global para no duplicar la vista.
              </p>
              <div className="button-row" style={{ justifyContent: "center", marginTop: 16 }}>
                <Link href="/contabilidad" className="button">Ir a contabilidad →</Link>
                <Link href="/aeat/prorrata" className="button secondary">Prorrata IVA</Link>
                <Link href="/aeat/calendario" className="button secondary">Calendario fiscal</Link>
              </div>
            </article>
          </section>
        ) : null}
        {tab === "laboral" ? <WorkerManager empresas={empresaSingleton} initialTab="trabajadores" /> : null}
        {tab === "nominas" ? <WorkerManager empresas={empresaSingleton} initialTab="nominas" /> : null}
        {tab === "contratos" ? <WorkerManager empresas={empresaSingleton} initialTab="trabajadores" /> : null}
        {tab === "bancos" ? <ClienteBancos empresa={empresa} /> : null}
        {tab === "documentos" ? <ClienteDocumentos empresaId={empresa.id} /> : null}
        {tab === "firmas" ? <ClienteFirmas empresaId={empresa.id} /> : null}
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
