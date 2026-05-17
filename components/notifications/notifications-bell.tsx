"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Item = {
  id: string;
  tipo: string;
  titulo: string;
  detalle?: string | null;
  url?: string | null;
  severidad: "info" | "warn" | "bad" | "good";
  leida: boolean;
  created_at: string;
};

export function NotificationsBell() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const tk = session.session?.access_token;
      if (!tk) {
        setItems([]);
        setNoLeidas(0);
        return;
      }
      const res = await fetch("/api/notificaciones", { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (json.ok) {
        setItems(json.items ?? []);
        setNoLeidas(json.no_leidas ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // Polling cada 60s para nuevas notificaciones
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
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

  async function marcarLeida(id: string) {
    const { data: session } = await supabase.auth.getSession();
    const tk = session.session?.access_token;
    if (!tk) return;
    await fetch("/api/notificaciones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
      body: JSON.stringify({ id }),
    });
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, leida: true } : it)));
    setNoLeidas((n) => Math.max(0, n - 1));
  }

  async function marcarTodas() {
    const { data: session } = await supabase.auth.getSession();
    const tk = session.session?.access_token;
    if (!tk) return;
    await fetch("/api/notificaciones", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
      body: JSON.stringify({ marcar_todas: true }),
    });
    setItems((prev) => prev.map((it) => ({ ...it, leida: true })));
    setNoLeidas(0);
  }

  function fmt(ts: string) {
    const d = new Date(ts);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "ahora";
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="bell"
        aria-label={`${noLeidas} notificaciones sin leer`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Bell size={14} aria-hidden="true" />
        {noLeidas > 0 ? <span className="dot">{noLeidas}</span> : null}
      </button>

      {open ? (
        <div className="notifications-panel" role="menu">
          <div className="notifications-head">
            <strong>Notificaciones</strong>
            {noLeidas > 0 ? (
              <button
                type="button"
                onClick={marcarTodas}
                className="muted"
                style={{ fontFamily: "var(--mono)", fontSize: 11, border: "none", background: "transparent", cursor: "pointer" }}
              >
                marcar todas como leídas
              </button>
            ) : (
              <Link href="/dashboard" className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }} onClick={() => setOpen(false)}>
                al día →
              </Link>
            )}
          </div>
          {loading ? (
            <p className="muted" style={{ padding: 14, fontSize: 13 }}>Cargando…</p>
          ) : items.length === 0 ? (
            <p className="muted" style={{ padding: 18, textAlign: "center", fontSize: 13 }}>
              Sin notificaciones. Todo en orden.
            </p>
          ) : (
            <ul className="notifications-list">
              {items.map((it) => (
                <li key={it.id} style={{ opacity: it.leida ? 0.65 : 1 }}>
                  <Link
                    href={it.url ?? "/dashboard"}
                    onClick={() => {
                      setOpen(false);
                      if (!it.leida) marcarLeida(it.id);
                    }}
                    className="notification-item"
                  >
                    <span className={`notification-dot dot-${it.severidad}`} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: 13 }}>{it.titulo}</strong>
                      {it.detalle ? (
                        <small className="muted" style={{ display: "block", fontSize: 11, lineHeight: 1.4, marginTop: 2 }}>
                          {it.detalle}
                        </small>
                      ) : null}
                    </div>
                    <small className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{fmt(it.created_at)}</small>
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
