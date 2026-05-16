"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Item = {
  id: string;
  titulo: string;
  detalle?: string;
  url?: string;
  severidad: "info" | "warn" | "bad" | "good";
  cuando: string;
};

export function NotificationsBell() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        const tk = session.session?.access_token;
        if (!tk) {
          setItems([]);
          return;
        }
        const res = await fetch("/api/inteligencia", { headers: { Authorization: `Bearer ${tk}` } });
        const json = await res.json();
        if (!json.ok) {
          setItems([]);
          return;
        }
        const alertas = (json.alertas ?? []) as Array<{ tipo: string; severidad: "info" | "warn" | "bad"; mensaje: string }>;
        const mapped: Item[] = alertas.map((a, i) => ({
          id: `${a.tipo}-${i}`,
          titulo: a.mensaje,
          severidad: a.severidad,
          url: a.tipo === "facturas_vencidas"
            ? "/facturacion"
            : a.tipo === "modelos_proximos"
              ? "/aeat"
              : a.tipo === "fichajes_abiertos"
                ? "/laboral"
                : "/inteligencia",
          cuando: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
        }));
        setItems(mapped);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="bell"
        aria-label={`${items.length} notificaciones`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Bell size={14} aria-hidden="true" />
        {items.length > 0 ? <span className="dot">{items.length}</span> : null}
      </button>

      {open ? (
        <div className="notifications-panel" role="menu">
          <div className="notifications-head">
            <strong>Notificaciones</strong>
            <Link href="/inteligencia" className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }} onClick={() => setOpen(false)}>
              ver inteligencia →
            </Link>
          </div>
          {loading ? (
            <p className="muted" style={{ padding: 14, fontSize: 13 }}>Cargando…</p>
          ) : items.length === 0 ? (
            <p className="muted" style={{ padding: 18, textAlign: "center", fontSize: 13 }}>
              Sin notificaciones. Todo en orden 🎉
            </p>
          ) : (
            <ul className="notifications-list">
              {items.map((it) => (
                <li key={it.id}>
                  <Link href={it.url ?? "/dashboard"} onClick={() => setOpen(false)} className="notification-item">
                    <span className={`notification-dot dot-${it.severidad}`} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: 13 }}>{it.titulo}</strong>
                      {it.detalle ? <small className="muted" style={{ display: "block", fontFamily: "var(--mono)", fontSize: 11 }}>{it.detalle}</small> : null}
                    </div>
                    <small className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{it.cuando}</small>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
