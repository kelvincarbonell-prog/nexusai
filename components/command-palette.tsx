"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Item = {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  group: "cliente" | "página" | "agente" | "modelo";
};

const STATIC_ITEMS: Item[] = [
  { id: "p-dashboard", label: "Hoy del gestor", href: "/dashboard", group: "página" },
  { id: "p-clientes", label: "Clientes", href: "/clientes", group: "página" },
  { id: "p-facturacion", label: "Facturación", href: "/facturacion", group: "página" },
  { id: "p-aeat", label: "Modelos AEAT", href: "/aeat", group: "página" },
  { id: "p-contabilidad", label: "Contabilidad", href: "/contabilidad", group: "página" },
  { id: "p-laboral", label: "Laboral", href: "/laboral", group: "página" },
  { id: "p-agentes", label: "Agentes IA", href: "/agentes", group: "página" },
  { id: "p-tareas", label: "Tareas", href: "/tareas", group: "página" },
  { id: "p-crm", label: "CRM", href: "/crm", group: "página" },
  { id: "p-inteligencia", label: "Inteligencia", href: "/inteligencia", group: "página" },
  { id: "p-perfil", label: "Mi perfil y equipo", href: "/perfil", group: "página" },
  { id: "p-calendario", label: "Calendario fiscal", href: "/aeat/calendario", group: "página" },
  { id: "p-prorrata", label: "Calculadora prorrata IVA", href: "/aeat/prorrata", group: "página" },
  // Modelos AEAT
  ...["303", "111", "115", "123", "130", "180", "184", "190", "193", "200", "202", "210", "232", "296", "309", "347", "349", "390", "720"].map((m) => ({
    id: `m-${m}`, label: `Modelo ${m}`, sublabel: "Ir al cálculo y borrador", href: `/aeat?modelo=${m}`, group: "modelo" as const,
  })),
];

export function CommandPalette() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [clientes, setClientes] = useState<Item[]>([]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || clientes.length > 0) return;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/clientes", { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (json.ok) {
        const items: Item[] = (json.items ?? []).slice(0, 100).map((e: { id: string; nombre: string; nif?: string }) => ({
          id: `c-${e.id}`,
          label: e.nombre,
          sublabel: e.nif ?? "Cliente",
          href: `/clientes/${e.id}`,
          group: "cliente",
        }));
        setClientes(items);
      }
    })();
  }, [open, clientes.length, supabase]);

  const allItems = useMemo(() => [...clientes, ...STATIC_ITEMS], [clientes]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return allItems.slice(0, 30);
    return allItems
      .filter((i) => i.label.toLowerCase().includes(s) || (i.sublabel ?? "").toLowerCase().includes(s))
      .slice(0, 40);
  }, [allItems, q]);

  if (!open) return null;

  return (
    <div
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 500,
        display: "grid",
        placeItems: "start center",
        paddingTop: "10vh",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 92vw)",
          background: "var(--bg-soft, var(--bg, white))",
          border: "1px solid var(--line)",
          borderRadius: 14,
          boxShadow: "0 24px 64px -16px rgba(0,0,0,0.55)",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "auto 1fr",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
          <Search size={16} strokeWidth={1.8} color="var(--muted)" />
          <input
            autoFocus
            placeholder="Buscar cliente, página, modelo AEAT…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ all: "unset", flex: 1, fontSize: 15, color: "var(--ink)" }}
          />
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)" }}>esc</span>
        </div>
        <div style={{ maxHeight: "60vh", overflowY: "auto", padding: 6 }}>
          {filtered.length === 0 ? (
            <p className="muted" style={{ padding: 18, fontSize: 13, textAlign: "center" }}>
              Sin resultados para «{q}».
            </p>
          ) : (
            filtered.map((it, idx) => (
              <button
                key={it.id}
                onClick={() => {
                  setOpen(false);
                  router.push(it.href);
                }}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  width: "100%",
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: idx === 0 ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "color-mix(in srgb, var(--accent) 14%, transparent)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = idx === 0 ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent"; }}
              >
                <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                  <strong style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</strong>
                  {it.sublabel ? <small className="muted" style={{ fontSize: 11 }}>{it.sublabel}</small> : null}
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--muted)" }}>
                  <span className="pill plain" style={{ fontSize: 10, textTransform: "uppercase" }}>{it.group}</span>
                  <ArrowRight size={14} strokeWidth={1.8} />
                </div>
              </button>
            ))
          )}
        </div>
        <div style={{ borderTop: "1px solid var(--line)", padding: "8px 14px", display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
          <span>⌘K · Cmd/Ctrl+K para abrir</span>
          <span>{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}
