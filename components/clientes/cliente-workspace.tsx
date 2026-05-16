"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { UserAvatarButton } from "@/components/user/user-avatar-button";
import { ClienteResumen } from "@/components/clientes/cliente-resumen";
import { ClienteCopilot } from "@/components/clientes/cliente-copilot";

// Lazy-load todos los módulos pesados para acelerar el primer render.
const OcrUpload = dynamic(() => import("@/components/clientes/ocr-upload").then((m) => m.OcrUpload), {
  loading: () => <p className="muted">Cargando lector…</p>,
  ssr: false,
});
const ClienteImportar = dynamic(() => import("@/components/clientes/cliente-importar").then((m) => m.ClienteImportar), {
  loading: () => <p className="muted">Cargando importador…</p>,
  ssr: false,
});
const ClienteGastos = dynamic(() => import("@/components/clientes/cliente-gastos").then((m) => m.ClienteGastos), {
  loading: () => <p className="muted">Cargando gastos…</p>,
  ssr: false,
});
const BillingWorkspace = dynamic(() => import("@/components/billing/billing-workspace").then((m) => m.BillingWorkspace), {
  loading: () => <p className="muted">Cargando facturación…</p>,
  ssr: false,
});
const AeatWorkspace = dynamic(() => import("@/components/aeat/aeat-workspace").then((m) => m.AeatWorkspace), {
  loading: () => <p className="muted">Cargando modelos AEAT…</p>,
  ssr: false,
});
const WorkerManager = dynamic(() => import("@/components/laboral/worker-manager").then((m) => m.WorkerManager), {
  loading: () => <p className="muted">Cargando laboral…</p>,
  ssr: false,
});
const PlantillaFacturaForm = dynamic(() => import("@/components/empresas/plantilla-factura-form").then((m) => m.PlantillaFacturaForm), {
  loading: () => <p className="muted">Cargando plantilla…</p>,
  ssr: false,
});
const ClienteConfigForm = dynamic(() => import("@/components/clientes/cliente-config-form").then((m) => m.ClienteConfigForm), {
  loading: () => <p className="muted">Cargando configuración…</p>,
  ssr: false,
});
const ClienteBancos = dynamic(() => import("@/components/clientes/cliente-bancos").then((m) => m.ClienteBancos), {
  loading: () => <p className="muted">Cargando bancos…</p>,
  ssr: false,
});
const ClienteDocumentos = dynamic(() => import("@/components/clientes/cliente-documentos").then((m) => m.ClienteDocumentos), {
  loading: () => <p className="muted">Cargando documentos…</p>,
  ssr: false,
});
const ClienteFirmas = dynamic(() => import("@/components/clientes/cliente-firmas").then((m) => m.ClienteFirmas), {
  loading: () => <p className="muted">Cargando firmas…</p>,
  ssr: false,
});
const ClienteAuditoria = dynamic(() => import("@/components/clientes/cliente-auditoria").then((m) => m.ClienteAuditoria), {
  loading: () => <p className="muted">Cargando auditoría…</p>,
  ssr: false,
});

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
  | "auditoria"
  | "lector_ingresos"
  | "ingresos"
  | "lector_gastos"
  | "gastos"
  | "importar"
  | "aeat"
  | "contabilidad"
  | "laboral"
  | "nominas"
  | "contratos"
  | "bancos"
  | "documentos"
  | "firmas"
  | "plantilla"
  | "config";

type TabDef = { key: TabKey; label: string; emoji: string };

const NAV: { group: string; tabs: TabDef[] }[] = [
  {
    group: "Vista",
    tabs: [
      { key: "resumen", label: "Resumen", emoji: "📊" },
      { key: "auditoria", label: "Auditoría", emoji: "🕒" },
    ],
  },
  {
    group: "Ingresos",
    tabs: [
      { key: "lector_ingresos", label: "Lector ingresos", emoji: "💰" },
      { key: "ingresos", label: "Ingresos", emoji: "🧾" },
    ],
  },
  {
    group: "Gastos",
    tabs: [
      { key: "lector_gastos", label: "Lector gastos", emoji: "🪄" },
      { key: "gastos", label: "Gastos", emoji: "📤" },
    ],
  },
  {
    group: "Importaciones",
    tabs: [{ key: "importar", label: "A3 / Quipu / CSV", emoji: "📥" }],
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
      { key: "config", label: "Datos empresa", emoji: "⚙️" },
    ],
  },
];

export function ClienteWorkspace({ empresa }: { empresa: Empresa }) {
  const [tab, setTab] = useState<TabKey>("resumen");
  const empresaSingleton = [{ id: empresa.id, nombre: empresa.nombre, nif: empresa.nif ?? undefined }];
  const activeLabel = NAV.flatMap((g) => g.tabs).find((t) => t.key === tab)?.label ?? "";

  return (
    <div className="shell">
      {/* Sidebar cliente */}
      <aside className="sidebar" aria-label={`Menú del cliente ${empresa.nombre}`}>
        <Link
          href="/clientes"
          className="button ghost compact"
          style={{
            justifyContent: "flex-start",
            gap: 8,
            fontSize: 12,
            color: "var(--muted)",
            padding: "8px 10px",
            borderRadius: 8,
          }}
        >
          ← Volver al panel gestor
        </Link>

        <div className="sb-section">
          <span className="sb-eyebrow">Cliente activo</span>
          <div className="sb-card">
            <div className="sb-card-title">
              <span
                className="avatar"
                aria-hidden="true"
                style={{
                  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-2, var(--accent)) 100%)",
                  color: "white",
                  fontWeight: 800,
                }}
              >
                {empresa.nombre?.[0]?.toUpperCase() ?? "?"}
              </span>
              <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{empresa.nombre}</span>
                <small>{empresa.account_type === "autonomo" ? "Autónomo" : "Empresa"} · {empresa.nif ?? "sin NIF"}</small>
              </div>
            </div>
            <div className="sb-card-meta">
              {empresa.plan ? <span className="pill dark">{empresa.plan}</span> : null}
              {empresa.inbox_alias ? <span className="pill accent" title="Buzón de email">@inbox</span> : null}
            </div>
          </div>
        </div>

        <nav className="sb-nav" role="tablist" aria-label="Secciones del cliente" style={{ display: "grid", gap: 14 }}>
          {NAV.map((grp) => (
            <div key={grp.group} style={{ display: "grid", gap: 4 }}>
              <span
                className="sb-eyebrow"
                style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}
              >
                {grp.group}
              </span>
              {grp.tabs.map((t) => {
                const isActive = tab === t.key;
                return (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setTab(t.key)}
                    className={isActive ? "active" : undefined}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "7px 10px",
                      borderRadius: 7,
                      fontSize: 13,
                      color: isActive ? "var(--ink)" : "var(--ink-soft, var(--ink))",
                      background: isActive ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
                      borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                      transition: "all 0.12s ease",
                    }}
                  >
                    <span aria-hidden="true" style={{ width: 16, textAlign: "center" }}>{t.emoji}</span>
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sb-foot">
          <span className="sb-eyebrow">Acciones rápidas</span>
          <Link href="/dashboard" style={{ textDecoration: "none", color: "var(--ink-soft, var(--ink))" }}>● Hoy del gestor</Link>
          <Link href="/aeat" style={{ textDecoration: "none", color: "var(--ink-soft, var(--ink))" }}>● Modelos AEAT</Link>
          <Link href="/contabilidad" style={{ textDecoration: "none", color: "var(--ink-soft, var(--ink))" }}>● Contabilidad</Link>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <div className="topbar">
          <div className="crumbs" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link href="/clientes" className="muted" style={{ textDecoration: "none" }}>clientes</Link>
            <span style={{ color: "var(--muted)" }}>/</span>
            <strong>{empresa.nombre}</strong>
            <span style={{ color: "var(--muted)" }}>/</span>
            <span>{activeLabel}</span>
          </div>
          <div className="topbar-meta" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <NotificationsBell />
            <ThemeToggle compact />
            <UserAvatarButton />
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          {tab === "resumen" ? <ClienteResumen empresaId={empresa.id} /> : null}
          {tab === "auditoria" ? <ClienteAuditoria empresaId={empresa.id} /> : null}
          {tab === "lector_ingresos" ? <OcrUpload empresaId={empresa.id} modo="ingreso" /> : null}
          {tab === "lector_gastos" ? <OcrUpload empresaId={empresa.id} modo="gasto" /> : null}
          {tab === "importar" ? <ClienteImportar empresaId={empresa.id} /> : null}
          {tab === "ingresos" ? <BillingWorkspace empresas={empresaSingleton} /> : null}
          {tab === "gastos" ? <ClienteGastos empresaId={empresa.id} /> : null}
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
      </main>

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
