"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MessageSquare, Inbox, Bell, ListChecks, FileSignature, AlertOctagon, Loader2, Sun, Coffee, Moon,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Resp = {
  ok: boolean;
  contadores: {
    mensajes_no_leidos: number;
    solicitudes_pendientes: number;
    solicitudes_urgentes: number;
    notificaciones_no_leidas: number;
    tareas_hoy_y_mañana: number;
    modelos_pendientes_firma: number;
    facturas_vencidas: number;
    importe_vencido: number;
  };
  nivel: "perfecto" | "ligero" | "normal" | "cargado";
  fecha: string;
};

const EUR0 = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

function saludoYIcono() {
  const h = new Date().getHours();
  if (h < 6) return { saludo: "Buenas noches", Icon: Moon, color: "#6366f1" };
  if (h < 13) return { saludo: "Buenos días", Icon: Sun, color: "#f59e0b" };
  if (h < 20) return { saludo: "Buenas tardes", Icon: Coffee, color: "#a16207" };
  return { saludo: "Buenas noches", Icon: Moon, color: "#6366f1" };
}

export function MiDia({ nombre }: { nombre?: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/dashboard/mi-dia", { headers: { Authorization: `Bearer ${tk}` } });
      const j = await res.json();
      if (alive && j.ok) {
        setData(j);
        setLoading(false);
      } else if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [supabase]);

  const { saludo, Icon, color } = saludoYIcono();
  const firstName = nombre?.split(" ")[0];

  const tituloPorNivel = (nivel?: string) => {
    if (nivel === "perfecto") return "Día tranquilo. Aprovecha.";
    if (nivel === "ligero") return "Día ligero. Pocas cosas que tocar.";
    if (nivel === "cargado") return "Día cargado. Vamos por orden.";
    return "Vamos al lío.";
  };

  if (loading || !data) {
    return (
      <article className="card span-12" style={{ display: "flex", gap: 14, alignItems: "center", padding: 18 }}>
        <Loader2 size={16} className="animate-spin" />
        <span style={{ fontSize: 13, opacity: 0.75 }}>Preparando tu día…</span>
      </article>
    );
  }

  const c = data.contadores;
  const items: Array<{ icon: React.ReactNode; label: string; value: number | string; sub?: string; href: string; tone: "ok" | "warn" | "bad" | "neutral" }> = [
    { icon: <FileSignature size={16} />, label: "Firmas pendientes", value: c.modelos_pendientes_firma, href: "/aeat", tone: c.modelos_pendientes_firma > 0 ? "warn" : "ok" },
    { icon: <Inbox size={16} />, label: "Solicitudes", value: c.solicitudes_pendientes, sub: c.solicitudes_urgentes > 0 ? `${c.solicitudes_urgentes} urgentes` : undefined, href: "/solicitudes", tone: c.solicitudes_urgentes > 0 ? "bad" : c.solicitudes_pendientes > 0 ? "warn" : "ok" },
    { icon: <MessageSquare size={16} />, label: "Mensajes sin leer", value: c.mensajes_no_leidos, href: "/mensajes", tone: c.mensajes_no_leidos > 0 ? "warn" : "ok" },
    { icon: <ListChecks size={16} />, label: "Tareas hoy y mañana", value: c.tareas_hoy_y_mañana, href: "/tareas", tone: c.tareas_hoy_y_mañana > 0 ? "warn" : "ok" },
    { icon: <Bell size={16} />, label: "Notificaciones", value: c.notificaciones_no_leidas, href: "/dashboard", tone: c.notificaciones_no_leidas > 0 ? "neutral" : "ok" },
    { icon: <AlertOctagon size={16} />, label: "Facturas vencidas", value: c.facturas_vencidas, sub: c.importe_vencido > 0 ? EUR0(c.importe_vencido) : undefined, href: "/facturacion?filtro=vencidas", tone: c.facturas_vencidas > 0 ? "bad" : "ok" },
  ];

  return (
    <article
      className="card span-12"
      style={{
        background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent), transparent)",
        border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)",
        padding: 18,
        display: "grid",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Icon size={22} color={color} />
        <div>
          <span className="card-eyebrow">Mi día</span>
          <h2 style={{ margin: "2px 0 0", fontSize: 20 }}>
            {saludo}{firstName ? `, ${firstName}` : ""}. <span style={{ opacity: 0.8, fontWeight: 500 }}>{tituloPorNivel(data.nivel)}</span>
          </h2>
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
          {new Date(data.fecha + "T00:00:00").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
        {items.map((it) => (
          <Link key={it.label} href={it.href} style={{ textDecoration: "none", color: "inherit" }}>
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                border: `1px solid ${
                  it.tone === "bad" ? "#ef444455" : it.tone === "warn" ? "#f59e0b55" : it.tone === "ok" ? "#10b98155" : "color-mix(in srgb, currentColor 14%, transparent)"
                }`,
                background: `color-mix(in srgb, ${
                  it.tone === "bad" ? "#ef4444" : it.tone === "warn" ? "#f59e0b" : it.tone === "ok" ? "#10b981" : "currentColor"
                } 4%, transparent)`,
                display: "grid",
                gap: 4,
                transition: "transform 0.12s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: it.tone === "bad" ? "#ef4444" : it.tone === "warn" ? "#f59e0b" : it.tone === "ok" ? "#10b981" : "var(--muted)" }}>
                {it.icon}
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{it.label}</span>
              </div>
              <strong style={{ fontSize: 22 }}>{it.value}</strong>
              {it.sub && <small style={{ fontSize: 11, opacity: 0.7 }}>{it.sub}</small>}
            </div>
          </Link>
        ))}
      </div>
    </article>
  );
}
