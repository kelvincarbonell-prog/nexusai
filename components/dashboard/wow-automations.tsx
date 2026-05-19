"use client";

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

/**
 * Atajos automáticos para gestor fiscal: las acciones de mayor impacto
 * que estaban escondidas en sub-páginas. Reagrupadas en el dashboard
 * para que el gestor las dispare con 1 click.
 */
const WOWS = [
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
    href: "/facturacion?duplicados=1",
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
    descripcion: "Email + WhatsApp + enlace de pago a clientes con facturas vencidas.",
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
        {WOWS.map(({ Icon, titulo, descripcion, href, accent }) => (
          <Link
            key={href}
            href={href}
            style={{
              display: "grid",
              gap: 8,
              padding: 14,
              borderRadius: 10,
              border: `1px solid ${accent ? "color-mix(in srgb, var(--accent) 30%, transparent)" : "var(--line, #e5e7eb)"}`,
              background: accent ? "color-mix(in srgb, var(--accent) 5%, transparent)" : "var(--card, #fff)",
              textDecoration: "none",
              color: "inherit",
              transition: "transform 0.12s, border-color 0.15s, box-shadow 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 8px 20px -12px rgba(0,0,0,0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon size={16} color={accent ? "var(--accent)" : "var(--ink)"} />
              <strong style={{ fontSize: 14 }}>{titulo}</strong>
              <ArrowRight size={12} style={{ marginLeft: "auto", opacity: 0.5 }} />
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.45 }}>{descripcion}</p>
          </Link>
        ))}
      </div>
    </article>
  );
}
