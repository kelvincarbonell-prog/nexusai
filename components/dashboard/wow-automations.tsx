"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  FileCheck2,
  ScanSearch,
  Banknote,
  Receipt,
  Mail,
  Zap,
  ArrowRight,
} from "lucide-react";
import { DuplicadosModal } from "@/components/dashboard/duplicados-modal";

/**
 * Atajos automáticos para gestor fiscal: las acciones de mayor impacto
 * que estaban escondidas en sub-páginas. Reagrupadas en el dashboard
 * para que el gestor las dispare con 1 click.
 */
type Wow = {
  Icon: typeof FileCheck2;
  titulo: string;
  descripcion: string;
  accent: boolean;
} & ({ href: string; action?: undefined } | { action: "duplicados"; href?: undefined });

const WOWS: Wow[] = [
  {
    Icon: FileCheck2,
    titulo: "Borrador 303 del trimestre",
    descripcion: "Reúne todo el IVA del Q vigente y prepara el modelo. Tú solo firmas.",
    href: "/aeat?modelo=303",
    accent: true,
  },
  {
    Icon: ScanSearch,
    titulo: "Detectar facturas duplicadas",
    descripcion: "Escaneo IA de la cartera completa. Avisa de duplicados antes de contabilizar.",
    action: "duplicados",
    accent: false,
  },
  {
    Icon: Banknote,
    titulo: "Cerrar nóminas del mes",
    descripcion: "Generar 47 nóminas a la vez con sus cotizaciones, TC1/TC2 y SEPA.",
    href: "/laboral",
    accent: true,
  },
  {
    Icon: Receipt,
    titulo: "Resumen para el cliente",
    descripcion: "PDF con KPIs del mes (resultado, IVA, modelos presentados) listo para enviar.",
    href: "/inteligencia",
    accent: false,
  },
  {
    Icon: Mail,
    titulo: "Recordatorios de cobro",
    descripcion: "Email automático con enlace de pago a clientes con facturas vencidas.",
    href: "/agentes?modulo=cobros",
    accent: false,
  },
  {
    Icon: Zap,
    titulo: "Conciliar banco hoy",
    descripcion: "Cruce automático SEPA → factura. Concilia cientos de movimientos en segundos.",
    href: "/bancos",
    accent: true,
  },
];

export function WowAutomations() {
  const [openModal, setOpenModal] = useState<null | "duplicados">(null);

  const cardStyle = (accent: boolean): React.CSSProperties => ({
    display: "grid",
    gap: 8,
    padding: 14,
    borderRadius: 10,
    border: "1px solid var(--line, #e5e7eb)",
    background: "color-mix(in srgb, var(--accent) 4%, var(--card, transparent))",
    textDecoration: "none",
    color: "var(--ink, inherit)",
    transition: "transform 0.12s, border-color 0.15s, box-shadow 0.15s",
    cursor: "pointer",
    textAlign: "left",
    width: "100%",
    font: "inherit",
  });
  const onEnter = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.transform = "translateY(-1px)";
    e.currentTarget.style.boxShadow = "0 8px 20px -12px rgba(0,0,0,0.25)";
    e.currentTarget.style.borderColor = "color-mix(in srgb, var(--accent) 35%, transparent)";
  };
  const onLeave = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.borderColor = "var(--line, #e5e7eb)";
  };
  const cardInner = (Icon: Wow["Icon"], titulo: string, descripcion: string, accent: boolean) => (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            display: "grid",
            placeItems: "center",
            background: accent ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "color-mix(in srgb, currentColor 6%, transparent)",
            color: accent ? "var(--accent)" : "var(--ink, inherit)",
            flexShrink: 0,
          }}
        >
          <Icon size={15} />
        </span>
        <strong style={{ fontSize: 14, color: "var(--ink, inherit)" }}>{titulo}</strong>
        <ArrowRight size={12} style={{ marginLeft: "auto", opacity: 0.5 }} />
      </div>
      <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "var(--muted, #6b7280)" }}>{descripcion}</p>
    </>
  );

  return (
    <article className="card span-12" style={{ display: "grid", gap: 12 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Sparkles size={16} color="var(--accent)" />
        <div>
          <span className="card-eyebrow">Atajos automáticos</span>
          <strong style={{ display: "block", fontSize: 16, marginTop: 2 }}>
            Lo que el copiloto puede hacer por ti ahora mismo
          </strong>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
        {WOWS.map((w) => {
          if (w.action === "duplicados") {
            return (
              <button
                key={w.titulo}
                type="button"
                onClick={() => setOpenModal("duplicados")}
                style={cardStyle(w.accent)}
                onMouseEnter={onEnter}
                onMouseLeave={onLeave}
              >
                {cardInner(w.Icon, w.titulo, w.descripcion, w.accent)}
              </button>
            );
          }
          return (
            <Link
              key={w.href}
              href={w.href}
              style={cardStyle(w.accent)}
              onMouseEnter={onEnter}
              onMouseLeave={onLeave}
            >
              {cardInner(w.Icon, w.titulo, w.descripcion, w.accent)}
            </Link>
          );
        })}
      </div>

      {openModal === "duplicados" && <DuplicadosModal onClose={() => setOpenModal(null)} />}
    </article>
  );
}
