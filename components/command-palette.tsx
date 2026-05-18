"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, ArrowRight, Building2, Users, FileText, Calculator, Receipt, Plus,
  Mail, ListChecks, Sparkles, MessageSquare, BookOpen, BarChart3, Inbox,
  CornerDownLeft, ArrowUp, ArrowDown,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Group = "accion" | "cliente" | "factura" | "gasto" | "trabajador" | "pagina" | "modelo";

type Item = {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
  group: Group;
  icon?: React.ReactNode;
  shortcut?: string;
};

const PAGINAS: Item[] = [
  { id: "p-dashboard", label: "Hoy del gestor", href: "/dashboard", group: "pagina", icon: <BarChart3 size={14} />, shortcut: "G H" },
  { id: "p-clientes", label: "Clientes", href: "/clientes", group: "pagina", icon: <Users size={14} />, shortcut: "G C" },
  { id: "p-facturacion", label: "Facturación", href: "/facturacion", group: "pagina", icon: <FileText size={14} />, shortcut: "G F" },
  { id: "p-aeat", label: "Modelos AEAT", href: "/aeat", group: "pagina", icon: <Calculator size={14} />, shortcut: "G A" },
  { id: "p-contabilidad", label: "Contabilidad", href: "/contabilidad", group: "pagina", icon: <BookOpen size={14} />, shortcut: "G B" },
  { id: "p-laboral", label: "Laboral", href: "/laboral", group: "pagina", icon: <Users size={14} />, shortcut: "G L" },
  { id: "p-agentes", label: "Agentes IA", href: "/agentes", group: "pagina", icon: <Sparkles size={14} /> },
  { id: "p-solicitudes", label: "Solicitudes", href: "/solicitudes", group: "pagina", icon: <Inbox size={14} />, shortcut: "G S" },
  { id: "p-mensajes", label: "Mensajes", href: "/mensajes", group: "pagina", icon: <MessageSquare size={14} />, shortcut: "G M" },
  { id: "p-tareas", label: "Tareas", href: "/tareas", group: "pagina", icon: <ListChecks size={14} />, shortcut: "G T" },
  { id: "p-inteligencia", label: "Inteligencia", href: "/inteligencia", group: "pagina", icon: <Sparkles size={14} /> },
  { id: "p-calendario", label: "Calendario fiscal", href: "/aeat/calendario", group: "pagina", icon: <Calculator size={14} /> },
];

const ACCIONES: Item[] = [
  { id: "a-crear-cliente", label: "Crear empresa / cliente nuevo", href: "/clientes?nuevo=1", group: "accion", icon: <Plus size={14} />, shortcut: "C" },
  { id: "a-crear-factura", label: "Crear factura", href: "/facturacion?nueva=1", group: "accion", icon: <Plus size={14} />, shortcut: "F" },
  { id: "a-crear-presupuesto", label: "Crear presupuesto", href: "/facturacion?presupuesto=1", group: "accion", icon: <Plus size={14} /> },
  { id: "a-subir-gasto", label: "Subir factura de gasto al OCR", href: "/clientes?accion=ocr", group: "accion", icon: <Plus size={14} />, shortcut: "G" },
  { id: "a-bandeja", label: "Bandeja de solicitudes pendientes", href: "/solicitudes?estado=pendiente", group: "accion", icon: <Inbox size={14} /> },
  { id: "a-mensajes-noleidos", label: "Mensajes sin leer", href: "/mensajes?no_leidos=1", group: "accion", icon: <Mail size={14} /> },
];

const MODELOS: Item[] = ["303", "111", "115", "123", "130", "180", "184", "190", "193", "200", "202", "210", "232", "296", "309", "347", "349", "390", "720"].map((m) => ({
  id: `m-${m}`, label: `Modelo ${m}`, sublabel: "Ir al cálculo", href: `/aeat?modelo=${m}`, group: "modelo" as const, icon: <Calculator size={14} />,
}));

const GROUP_TITLES: Record<Group, string> = {
  accion: "Acciones rápidas",
  cliente: "Clientes",
  factura: "Facturas",
  gasto: "Gastos",
  trabajador: "Trabajadores",
  pagina: "Páginas",
  modelo: "Modelos AEAT",
};

export function CommandPalette() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const [clientes, setClientes] = useState<Item[]>([]);
  const [facturas, setFacturas] = useState<Item[]>([]);
  const [gastos, setGastos] = useState<Item[]>([]);
  const [trabajadores, setTrabajadores] = useState<Item[]>([]);
  const [loadingExtended, setLoadingExtended] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Toggle Cmd+K + ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Carga lazy de clientes la primera vez que se abre
  useEffect(() => {
    if (!open || clientes.length > 0) return;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/clientes", { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (json.ok) {
        const items: Item[] = (json.items ?? []).slice(0, 200).map((e: { id: string; nombre: string; nif?: string }) => ({
          id: `c-${e.id}`,
          label: e.nombre,
          sublabel: e.nif ?? "Cliente",
          href: `/clientes/${e.id}`,
          group: "cliente",
          icon: <Building2 size={14} />,
        }));
        setClientes(items);
      }
    })();
  }, [open, clientes.length, supabase]);

  // Búsqueda profunda en facturas/gastos/trabajadores con debounce (300ms)
  useEffect(() => {
    if (!open) return;
    const search = q.trim();
    if (search.length < 3) {
      setFacturas([]); setGastos([]); setTrabajadores([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoadingExtended(true);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const tk = sess.session?.access_token ?? "";
        const res = await fetch(`/api/search/global?q=${encodeURIComponent(search)}`, { headers: { Authorization: `Bearer ${tk}` } });
        const j = await res.json();
        if (j.ok) {
          setFacturas((j.facturas ?? []).map((f: { id: string; numero?: string; contacto_nombre?: string; total?: number; empresa_id: string }) => ({
            id: `f-${f.id}`,
            label: f.numero ? `Factura ${f.numero}` : "Factura",
            sublabel: `${f.contacto_nombre ?? "—"} · ${(f.total ?? 0).toLocaleString("es-ES")}€`,
            href: `/facturacion?id=${f.id}`,
            group: "factura",
            icon: <Receipt size={14} />,
          })));
          setGastos((j.gastos ?? []).map((g: { id: string; proveedor?: string; concepto?: string; total?: number; empresa_id: string }) => ({
            id: `gt-${g.id}`,
            label: g.proveedor ?? "Gasto",
            sublabel: `${g.concepto ?? ""} · ${(g.total ?? 0).toLocaleString("es-ES")}€`,
            href: `/clientes/${g.empresa_id}?tab=gastos&id=${g.id}`,
            group: "gasto",
            icon: <Receipt size={14} />,
          })));
          setTrabajadores((j.trabajadores ?? []).map((t: { id: string; nombre: string; apellidos?: string; dni?: string; empresa_id: string }) => ({
            id: `t-${t.id}`,
            label: t.apellidos ? `${t.apellidos}, ${t.nombre}` : t.nombre,
            sublabel: t.dni ?? "Trabajador",
            href: `/laboral?empresa=${t.empresa_id}&trabajador=${t.id}`,
            group: "trabajador",
            icon: <Users size={14} />,
          })));
        }
      } finally {
        setLoadingExtended(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q, open, supabase]);

  const allItems = useMemo(() => [
    ...ACCIONES,
    ...clientes,
    ...facturas,
    ...gastos,
    ...trabajadores,
    ...PAGINAS,
    ...MODELOS,
  ], [clientes, facturas, gastos, trabajadores]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return allItems.slice(0, 30);
    return allItems
      .filter((i) => i.label.toLowerCase().includes(s) || (i.sublabel ?? "").toLowerCase().includes(s))
      .slice(0, 50);
  }, [allItems, q]);

  // Agrupado para mostrar
  const grouped = useMemo(() => {
    const acc: Record<Group, Item[]> = { accion: [], cliente: [], factura: [], gasto: [], trabajador: [], pagina: [], modelo: [] };
    for (const it of filtered) acc[it.group].push(it);
    return acc;
  }, [filtered]);

  // Reset cursor cuando cambia la query
  useEffect(() => { setCursor(0); }, [q, open]);

  function goSelected() {
    const it = filtered[cursor];
    if (!it) return;
    setOpen(false);
    router.push(it.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(filtered.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      goSelected();
    }
  }

  if (!open) return null;

  let runningIndex = -1;
  const groupOrder: Group[] = ["accion", "cliente", "factura", "gasto", "trabajador", "pagina", "modelo"];

  return (
    <div
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 500, display: "grid", placeItems: "start center", paddingTop: "10vh" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(680px, 92vw)", background: "var(--bg-soft, var(--bg, white))", border: "1px solid var(--line)",
          borderRadius: 14, boxShadow: "0 24px 64px -16px rgba(0,0,0,0.55)", overflow: "hidden",
          display: "grid", gridTemplateRows: "auto 1fr auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--line)" }}>
          <Search size={16} strokeWidth={1.8} color="var(--muted)" />
          <input
            autoFocus
            placeholder="Buscar cliente, factura, gasto, trabajador, página, modelo AEAT…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            style={{ all: "unset", flex: 1, fontSize: 15, color: "var(--ink)" }}
          />
          {loadingExtended && <span style={{ fontSize: 11, color: "var(--muted)" }}>buscando…</span>}
          <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)" }}>esc</span>
        </div>
        <div ref={listRef} style={{ maxHeight: "62vh", overflowY: "auto", padding: 6 }}>
          {filtered.length === 0 ? (
            <p className="muted" style={{ padding: 18, fontSize: 13, textAlign: "center" }}>
              {q.trim().length < 3 && q.trim().length > 0
                ? "Escribe 3 caracteres mínimo para buscar facturas / gastos / trabajadores."
                : `Sin resultados para «${q}».`}
            </p>
          ) : (
            groupOrder.map((g) => {
              const items = grouped[g];
              if (items.length === 0) return null;
              return (
                <div key={g} style={{ marginBottom: 4 }}>
                  <div style={{ padding: "8px 12px 4px", fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--muted)", fontWeight: 700 }}>
                    {GROUP_TITLES[g]} · {items.length}
                  </div>
                  {items.map((it) => {
                    runningIndex++;
                    const isActive = runningIndex === cursor;
                    return (
                      <button
                        key={it.id}
                        onClick={() => {
                          setOpen(false);
                          router.push(it.href);
                        }}
                        onMouseEnter={() => {/* cursor controlled by keyboard */}}
                        style={{
                          all: "unset", cursor: "pointer", width: "100%", boxSizing: "border-box",
                          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                          padding: "8px 12px", borderRadius: 8,
                          background: isActive ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "transparent",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                          {it.icon ?? <ArrowRight size={14} />}
                          <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                            <strong style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.label}</strong>
                            {it.sublabel ? <small className="muted" style={{ fontSize: 11 }}>{it.sublabel}</small> : null}
                          </div>
                        </div>
                        {it.shortcut && <span className="kbd" style={{ fontSize: 10 }}>{it.shortcut}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
        <div style={{ borderTop: "1px solid var(--line)", padding: "8px 14px", display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><ArrowUp size={11} /><ArrowDown size={11} /> mover</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><CornerDownLeft size={11} /> abrir</span>
          </span>
          <span>{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}
