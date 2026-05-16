"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { UserAvatarButton } from "@/components/user/user-avatar-button";
import { ClienteResumen } from "@/components/clientes/cliente-resumen";
import { ClienteCopilot } from "@/components/clientes/cliente-copilot";

// Lazy-load para acelerar el primer render.
const OcrUpload = dynamic(() => import("@/components/clientes/ocr-upload").then((m) => m.OcrUpload), { loading: () => <p className="muted">Cargando lector…</p>, ssr: false });
const ClienteImportar = dynamic(() => import("@/components/clientes/cliente-importar").then((m) => m.ClienteImportar), { loading: () => <p className="muted">Cargando…</p>, ssr: false });
const ClienteGastos = dynamic(() => import("@/components/clientes/cliente-gastos").then((m) => m.ClienteGastos), { loading: () => <p className="muted">Cargando…</p>, ssr: false });
const BillingWorkspace = dynamic(() => import("@/components/billing/billing-workspace").then((m) => m.BillingWorkspace), { loading: () => <p className="muted">Cargando…</p>, ssr: false });
const AeatWorkspace = dynamic(() => import("@/components/aeat/aeat-workspace").then((m) => m.AeatWorkspace), { loading: () => <p className="muted">Cargando…</p>, ssr: false });
const WorkerManager = dynamic(() => import("@/components/laboral/worker-manager").then((m) => m.WorkerManager), { loading: () => <p className="muted">Cargando…</p>, ssr: false });
const PlantillaFacturaForm = dynamic(() => import("@/components/empresas/plantilla-factura-form").then((m) => m.PlantillaFacturaForm), { loading: () => <p className="muted">Cargando…</p>, ssr: false });
const ClienteConfigForm = dynamic(() => import("@/components/clientes/cliente-config-form").then((m) => m.ClienteConfigForm), { loading: () => <p className="muted">Cargando…</p>, ssr: false });
const ClienteBancos = dynamic(() => import("@/components/clientes/cliente-bancos").then((m) => m.ClienteBancos), { loading: () => <p className="muted">Cargando…</p>, ssr: false });
const ClienteDocumentos = dynamic(() => import("@/components/clientes/cliente-documentos").then((m) => m.ClienteDocumentos), { loading: () => <p className="muted">Cargando…</p>, ssr: false });
const ClienteFirmas = dynamic(() => import("@/components/clientes/cliente-firmas").then((m) => m.ClienteFirmas), { loading: () => <p className="muted">Cargando…</p>, ssr: false });
const ClienteAuditoria = dynamic(() => import("@/components/clientes/cliente-auditoria").then((m) => m.ClienteAuditoria), { loading: () => <p className="muted">Cargando…</p>, ssr: false });
const ClienteSolicitudes = dynamic(() => import("@/components/clientes/cliente-solicitudes").then((m) => m.ClienteSolicitudes), { loading: () => <p className="muted">Cargando…</p>, ssr: false });
const ClienteMensajes = dynamic(() => import("@/components/clientes/cliente-mensajes").then((m) => m.ClienteMensajes), { loading: () => <p className="muted">Cargando…</p>, ssr: false });
const CalendarioFiscal = dynamic(() => import("@/components/aeat/calendario-fiscal").then((m) => m.CalendarioFiscal), { loading: () => <p className="muted">Cargando…</p>, ssr: false });

type Empresa = {
  id: string;
  nombre: string;
  nif: string | null;
  account_type: string | null;
  plan: string | null;
  inbox_alias: string | null;
  metadata: Record<string, unknown>;
};

// Estructura inspirada en el legacy Nexus portal.
type SectionKey =
  | "inicio"
  | "facturas"
  | "gastos"
  | "albaranes"
  | "laboral"
  | "modelos"
  | "obligaciones"
  | "documentos"
  | "solicitudes"
  | "mensajes"
  | "bancos"
  | "firmas"
  | "auditoria"
  | "config";

type SubTab = { key: string; label: string };
type Section = {
  key: SectionKey;
  label: string;
  emoji: string;
  subTabs?: SubTab[];
};

const SECTIONS: Section[] = [
  { key: "inicio", label: "Inicio", emoji: "🏠" },
  {
    key: "facturas",
    label: "Facturas",
    emoji: "📄",
    subTabs: [
      { key: "listado", label: "Listado" },
      { key: "lector", label: "Lector ingresos (OCR)" },
      { key: "presupuestos", label: "Presupuestos" },
      { key: "recurrentes", label: "Recurrentes" },
    ],
  },
  {
    key: "gastos",
    label: "Gastos & OCR",
    emoji: "🧾",
    subTabs: [
      { key: "listado", label: "Listado" },
      { key: "lector", label: "Lector gastos (OCR)" },
      { key: "importar", label: "Importar A3 / Quipu / CSV" },
    ],
  },
  { key: "albaranes", label: "Albaranes", emoji: "📦" },
  {
    key: "laboral",
    label: "Laboral",
    emoji: "👥",
    subTabs: [
      { key: "trabajadores", label: "Plantilla" },
      { key: "nominas", label: "Nóminas" },
      { key: "ausencias", label: "Bajas e IT" },
      { key: "horario", label: "Fichajes" },
      { key: "calendario", label: "Calendario" },
    ],
  },
  { key: "modelos", label: "IVA y modelos AEAT", emoji: "🧮" },
  {
    key: "obligaciones",
    label: "Obligaciones",
    emoji: "📅",
  },
  {
    key: "documentos",
    label: "Documentos",
    emoji: "📁",
    subTabs: [
      { key: "todos", label: "Todos" },
      { key: "impuesto", label: "Impuestos" },
      { key: "laboral", label: "Laboral" },
      { key: "contable", label: "Contable" },
      { key: "nomina", label: "Nóminas" },
    ],
  },
  { key: "solicitudes", label: "Solicitudes", emoji: "📤" },
  { key: "mensajes", label: "Mensajes", emoji: "💬" },
  { key: "bancos", label: "Bancos", emoji: "🏦" },
  { key: "firmas", label: "Cl@ve & firmas", emoji: "✍️" },
  { key: "auditoria", label: "Auditoría", emoji: "🕒" },
  {
    key: "config",
    label: "Configuración",
    emoji: "⚙️",
    subTabs: [
      { key: "datos", label: "Datos empresa" },
      { key: "plantilla", label: "Plantilla facturas" },
    ],
  },
];

export function ClienteWorkspace({ empresa }: { empresa: Empresa }) {
  const [section, setSection] = useState<SectionKey>("inicio");
  const [subTab, setSubTab] = useState<Record<SectionKey, string>>({
    inicio: "",
    facturas: "listado",
    gastos: "listado",
    albaranes: "",
    laboral: "trabajadores",
    modelos: "",
    obligaciones: "",
    documentos: "todos",
    solicitudes: "",
    mensajes: "",
    bancos: "",
    firmas: "",
    auditoria: "",
    config: "datos",
  });

  const empresaSingleton = [{ id: empresa.id, nombre: empresa.nombre, nif: empresa.nif ?? undefined }];
  const empresaConType = [{ ...empresaSingleton[0], account_type: empresa.account_type ?? "empresa" }];
  const current = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0];
  const activeSub = subTab[section];

  function setSub(s: SectionKey, k: string) {
    setSubTab((prev) => ({ ...prev, [s]: k }));
  }

  return (
    <div className="shell">
      {/* Sidebar lateral del cliente */}
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
            marginBottom: 4,
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

        <nav className="sb-nav" role="tablist" aria-label="Secciones del cliente" style={{ display: "grid", gap: 2 }}>
          {SECTIONS.map((s) => {
            const isActive = section === s.key;
            return (
              <button
                key={s.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setSection(s.key)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "var(--ink)" : "var(--ink-soft, var(--ink))",
                  background: isActive ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "transparent",
                  borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                  transition: "all 0.12s ease",
                }}
              >
                <span aria-hidden="true" style={{ width: 18, textAlign: "center" }}>{s.emoji}</span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sb-foot">
          <span className="sb-eyebrow">Tu asesor</span>
          <span style={{ fontSize: 12 }}>● Despacho asignado</span>
          <button
            className="button compact"
            style={{ width: "100%", justifyContent: "center", marginTop: 6, fontSize: 12 }}
            onClick={() => setSection("mensajes")}
          >
            💬 Enviar mensaje
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main">
        <div className="topbar">
          <div className="crumbs" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Link href="/clientes" className="muted" style={{ textDecoration: "none" }}>clientes</Link>
            <span style={{ color: "var(--muted)" }}>/</span>
            <strong>{empresa.nombre}</strong>
            <span style={{ color: "var(--muted)" }}>/</span>
            <span>{current.label}</span>
          </div>
          <div className="topbar-meta" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <NotificationsBell />
            <ThemeToggle compact />
            <UserAvatarButton />
          </div>
        </div>

        {/* Sub-pestañas internas */}
        {current.subTabs ? (
          <div role="tablist" aria-label={`Sub-secciones de ${current.label}`} style={{ display: "flex", gap: 4, flexWrap: "wrap", borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
            {current.subTabs.map((sub) => {
              const isActive = activeSub === sub.key;
              return (
                <button
                  key={sub.key}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setSub(section, sub.key)}
                  className={`button compact ${isActive ? "" : "ghost"}`}
                  style={{ fontSize: 12.5 }}
                >
                  {sub.label}
                </button>
              );
            })}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 18 }}>
          {/* INICIO */}
          {section === "inicio" ? <ClienteResumen empresaId={empresa.id} /> : null}

          {/* FACTURAS · ingresos */}
          {section === "facturas" && activeSub === "listado" ? <BillingWorkspace empresas={empresaSingleton} initial="facturas" /> : null}
          {section === "facturas" && activeSub === "lector" ? <OcrUpload empresaId={empresa.id} modo="ingreso" /> : null}
          {section === "facturas" && activeSub === "presupuestos" ? <BillingWorkspace empresas={empresaSingleton} initial="presupuestos" /> : null}
          {section === "facturas" && activeSub === "recurrentes" ? <BillingWorkspace empresas={empresaSingleton} initial="recurrentes" /> : null}

          {/* GASTOS & OCR */}
          {section === "gastos" && activeSub === "listado" ? <ClienteGastos empresaId={empresa.id} /> : null}
          {section === "gastos" && activeSub === "lector" ? <OcrUpload empresaId={empresa.id} modo="gasto" /> : null}
          {section === "gastos" && activeSub === "importar" ? <ClienteImportar empresaId={empresa.id} /> : null}

          {/* ALBARANES */}
          {section === "albaranes" ? (
            <section className="grid">
              <article className="card span-12" style={{ textAlign: "center", padding: 32 }}>
                <span className="card-eyebrow">Albaranes</span>
                <p style={{ marginTop: 12, fontSize: 14, maxWidth: 520, marginInline: "auto" }}>
                  Los albaranes se gestionan desde Facturación → Presupuestos. Genera el albarán, conviértelo en
                  factura o recurrente.
                </p>
                <div className="button-row" style={{ justifyContent: "center", marginTop: 16 }}>
                  <button className="button" onClick={() => { setSection("facturas"); setSub("facturas", "presupuestos"); }}>
                    → Ir a Presupuestos / Albaranes
                  </button>
                </div>
              </article>
            </section>
          ) : null}

          {/* LABORAL con sub-tabs */}
          {section === "laboral" && activeSub === "trabajadores" ? <WorkerManager empresas={empresaSingleton} initialTab="trabajadores" /> : null}
          {section === "laboral" && activeSub === "nominas" ? <WorkerManager empresas={empresaSingleton} initialTab="nominas" /> : null}
          {section === "laboral" && activeSub === "ausencias" ? <WorkerManager empresas={empresaSingleton} initialTab="ausencias" /> : null}
          {section === "laboral" && activeSub === "horario" ? <WorkerManager empresas={empresaSingleton} initialTab="horario" /> : null}
          {section === "laboral" && activeSub === "calendario" ? <WorkerManager empresas={empresaSingleton} initialTab="calendario" /> : null}

          {/* MODELOS AEAT */}
          {section === "modelos" ? <AeatWorkspace empresas={empresaSingleton} /> : null}

          {/* OBLIGACIONES */}
          {section === "obligaciones" ? <CalendarioFiscal empresas={empresaConType} /> : null}

          {/* DOCUMENTOS con filtro por tipo */}
          {section === "documentos" ? <ClienteDocumentos empresaId={empresa.id} filtro={activeSub} /> : null}

          {/* SOLICITUDES */}
          {section === "solicitudes" ? <ClienteSolicitudes empresaId={empresa.id} /> : null}

          {/* MENSAJES */}
          {section === "mensajes" ? <ClienteMensajes empresaId={empresa.id} /> : null}

          {/* BANCOS */}
          {section === "bancos" ? <ClienteBancos empresa={empresa} /> : null}

          {/* FIRMAS */}
          {section === "firmas" ? <ClienteFirmas empresaId={empresa.id} /> : null}

          {/* AUDITORÍA */}
          {section === "auditoria" ? <ClienteAuditoria empresaId={empresa.id} /> : null}

          {/* CONFIGURACIÓN */}
          {section === "config" && activeSub === "datos" ? <ClienteConfigForm empresa={empresa} /> : null}
          {section === "config" && activeSub === "plantilla" ? <PlantillaFacturaForm empresaId={empresa.id} empresaNombre={empresa.nombre} /> : null}
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
