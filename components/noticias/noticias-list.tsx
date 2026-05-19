"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Search, Filter, Newspaper, CalendarClock, AlertOctagon } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { CATEGORIA_LABEL, CATEGORIAS_PRIORITARIAS, type FuenteCategoria } from "@/lib/noticias/sources";

type Item = {
  id: string;
  slug: string;
  titulo: string;
  resumen: string;
  fuente_codigo: string;
  fuente_nombre: string;
  categoria: FuenteCategoria;
  tags: string[];
  importancia: "alta" | "normal" | "baja";
  fecha_publicacion: string;
};

const FILTROS: Array<{ key: "todas" | FuenteCategoria; label: string }> = [
  { key: "todas", label: "Todas" },
  ...CATEGORIAS_PRIORITARIAS.map((c) => ({ key: c, label: CATEGORIA_LABEL[c] })),
];

export function NoticiasList() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todas" | FuenteCategoria>("todas");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const tk = sess.session?.access_token ?? "";
        const params = new URLSearchParams({ limit: "40" });
        if (filtro !== "todas") params.set("categoria", filtro);
        if (debouncedQ) params.set("q", debouncedQ);
        const res = await fetch(`/api/noticias?${params}`, { headers: { Authorization: `Bearer ${tk}` } });
        const j = await res.json();
        if (!j.ok) throw new Error(j.error ?? "Error");
        setItems(j.items ?? []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [filtro, debouncedQ, supabase]);

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 280px", minWidth: 240 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }} />
          <input
            className="input"
            placeholder="Buscar en noticias…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 36, width: "100%" }}
          />
        </div>
        <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 10, background: "color-mix(in srgb, currentColor 5%, transparent)", border: "1px solid var(--line, #e5e7eb)" }}>
          <Filter size={12} style={{ alignSelf: "center", marginLeft: 6, opacity: 0.5 }} />
          {FILTROS.map((f) => {
            const active = filtro === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFiltro(f.key)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: active ? "1px solid color-mix(in srgb, var(--accent) 35%, transparent)" : "1px solid transparent",
                  background: active ? "color-mix(in srgb, var(--accent) 18%, transparent)" : "transparent",
                  color: active ? "var(--accent)" : "var(--ink, #111)",
                  fontWeight: active ? 600 : 500,
                  fontSize: 12,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p role="alert" style={{ color: "var(--bad)" }}>{error}</p>}

      {loading ? (
        <p className="muted" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={14} className="animate-spin" /> Cargando noticias…
        </p>
      ) : items.length === 0 ? (
        <article className="card" style={{ display: "grid", placeItems: "center", gap: 10, padding: 40, textAlign: "center" }}>
          <Newspaper size={36} strokeWidth={1.5} color="var(--muted)" />
          <strong style={{ fontSize: 15 }}>Sin noticias en este filtro</strong>
          <span className="muted" style={{ fontSize: 13 }}>
            Cada mañana publicamos 3-4 artículos nuevos sobre actualidad fiscal, contable, mercantil y laboral.
          </span>
        </article>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 14 }}>
          {items.map((it) => {
            const fechaFmt = new Date(it.fecha_publicacion + "T00:00:00").toLocaleDateString("es-ES", {
              day: "2-digit", month: "short",
            });
            const importColor = it.importancia === "alta" ? "#ef4444" : it.importancia === "baja" ? "var(--muted)" : "var(--accent)";
            return (
              <Link
                key={it.id}
                href={`/noticias/${it.slug}`}
                className="card"
                style={{
                  display: "grid",
                  gap: 8,
                  textDecoration: "none",
                  color: "inherit",
                  transition: "transform 0.12s, border-color 0.15s",
                  borderLeft: `3px solid ${importColor}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, flexWrap: "wrap" }}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 999, fontWeight: 600,
                    background: `color-mix(in srgb, ${importColor} 14%, transparent)`,
                    color: importColor,
                  }}>{CATEGORIA_LABEL[it.categoria] ?? it.categoria}</span>
                  {it.importancia === "alta" && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "#ef4444", fontWeight: 600 }}>
                      <AlertOctagon size={10} /> Alta
                    </span>
                  )}
                  <span className="muted" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <CalendarClock size={11} /> {fechaFmt}
                  </span>
                </div>
                <strong style={{ fontSize: 15, lineHeight: 1.3 }}>{it.titulo}</strong>
                <p className="muted" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{it.resumen}</p>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{it.fuente_nombre}</div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
