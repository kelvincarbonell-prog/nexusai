"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Send, Inbox, MessageSquare } from "lucide-react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Conv = {
  empresa_id: string;
  empresa_nombre: string;
  empresa_nif: string | null;
  ultimo_mensaje: string | null;
  ultimo_at: string | null;
  no_leidos: number;
  total: number;
  es_mio_ultimo: boolean;
};

type Mensaje = {
  id: string;
  remitente_id: string;
  contenido: string;
  leido: boolean;
  created_at: string;
};

function format(ts: string | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export function BandejaGestor() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [conv, setConv] = useState<Conv[]>([]);
  const [search, setSearch] = useState("");
  const [activa, setActiva] = useState<Conv | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function loadBandeja() {
    try {
      const tk = await token();
      const res = await fetch("/api/asesor/mensajes", { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (json.ok) setConv(json.conversaciones ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function loadConversacion(c: Conv) {
    setActiva(c);
    const tk = await token();
    // Marcar como leído
    await fetch(`/api/asesor/mensajes/${c.empresa_id}`, { method: "PATCH", headers: { Authorization: `Bearer ${tk}` } });
    const res = await fetch(`/api/portal/mensajes?empresa_id=${c.empresa_id}`, { headers: { Authorization: `Bearer ${tk}` } });
    const json = await res.json();
    if (json.ok) {
      setMensajes(json.items ?? []);
      setMe(json.me ?? null);
    }
    await loadBandeja();
  }

  async function enviar() {
    if (!draft.trim() || !activa) return;
    setBusy(true);
    try {
      const tk = await token();
      const res = await fetch("/api/portal/mensajes", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: activa.empresa_id, contenido: draft.trim() }),
      });
      const json = await res.json();
      if (json.ok) {
        setDraft("");
        await loadConversacion(activa);
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadBandeja();
    const i = setInterval(loadBandeja, 15000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensajes.length]);

  const filtrada = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conv;
    return conv.filter((c) =>
      c.empresa_nombre.toLowerCase().includes(q) ||
      (c.empresa_nif ?? "").toLowerCase().includes(q) ||
      (c.ultimo_mensaje ?? "").toLowerCase().includes(q),
    );
  }, [conv, search]);

  const totalNoLeidos = conv.reduce((s, c) => s + c.no_leidos, 0);

  return (
    <section className="grid" style={{ gridTemplateColumns: "minmax(320px, 380px) 1fr", gap: 16, alignItems: "start" }}>
      {/* Columna izquierda: lista de conversaciones */}
      <aside className="card" style={{ display: "grid", gridTemplateRows: "auto auto 1fr", maxHeight: "78vh" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span className="card-eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Inbox size={13} /> Bandeja de entrada
            </span>
            <strong style={{ fontSize: 14, display: "block", marginTop: 4 }}>
              {filtrada.length} conversaciones
              {totalNoLeidos > 0 ? <span className="pill bad" style={{ marginLeft: 8, fontSize: 11 }}>{totalNoLeidos} no leídos</span> : null}
            </strong>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8 }}>
          <Search size={14} color="var(--muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente o texto…"
            style={{ all: "unset", flex: 1, fontSize: 13, color: "var(--ink)" }}
          />
        </div>
        <div style={{ overflowY: "auto", marginTop: 10 }}>
          {loading ? <p className="muted" style={{ fontSize: 13, padding: 8 }}>Cargando…</p> : null}
          {!loading && filtrada.length === 0 ? (
            <p className="muted" style={{ fontSize: 13, padding: 12 }}>
              {conv.length === 0 ? "Aún no tienes mensajes de clientes." : "Sin resultados."}
            </p>
          ) : null}
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
            {filtrada.map((c) => {
              const activo = activa?.empresa_id === c.empresa_id;
              return (
                <li key={c.empresa_id}>
                  <button
                    onClick={() => loadConversacion(c)}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      display: "block",
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: activo ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
                      borderLeft: activo ? "3px solid var(--accent)" : "3px solid transparent",
                      transition: "background 0.12s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <strong style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                        {c.empresa_nombre}
                      </strong>
                      <time style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)" }}>
                        {format(c.ultimo_at)}
                      </time>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, gap: 8 }}>
                      <small style={{ fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, fontWeight: c.no_leidos > 0 ? 600 : 400 }}>
                        {c.es_mio_ultimo ? "Tú: " : ""}{c.ultimo_mensaje ?? "—"}
                      </small>
                      {c.no_leidos > 0 ? (
                        <span className="pill bad" style={{ fontSize: 10, padding: "2px 8px" }}>{c.no_leidos}</span>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* Columna derecha: thread */}
      <article className="card" style={{ display: "grid", gridTemplateRows: "auto 1fr auto", maxHeight: "78vh" }}>
        {activa ? (
          <>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
              <div>
                <span className="card-eyebrow">Conversación</span>
                <strong style={{ fontSize: 16, display: "block", marginTop: 4 }}>{activa.empresa_nombre}</strong>
                <small className="muted" style={{ fontSize: 11, fontFamily: "var(--mono)" }}>{activa.empresa_nif ?? ""}</small>
              </div>
              <Link href={`/clientes/${activa.empresa_id}`} className="button secondary compact">
                Abrir cliente →
              </Link>
            </header>

            <div ref={scrollRef} style={{ overflowY: "auto", padding: "16px 4px", display: "flex", flexDirection: "column", gap: 10 }}>
              {mensajes.length === 0 ? (
                <p className="muted" style={{ textAlign: "center", marginTop: 40, fontSize: 13 }}>
                  Sin mensajes aún en esta conversación.
                </p>
              ) : (
                mensajes.map((m) => {
                  const isMine = m.remitente_id === me;
                  return (
                    <div
                      key={m.id}
                      style={{
                        alignSelf: isMine ? "flex-end" : "flex-start",
                        maxWidth: "75%",
                        background: isMine ? "color-mix(in srgb, var(--accent) 18%, transparent)" : "color-mix(in srgb, var(--line) 50%, transparent)",
                        padding: "10px 14px",
                        borderRadius: 14,
                        borderTopRightRadius: isMine ? 4 : 14,
                        borderTopLeftRadius: !isMine ? 4 : 14,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                        <strong style={{ fontSize: 12 }}>{isMine ? "Tú (asesor)" : "Cliente"}</strong>
                        <time style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)" }}>
                          {new Date(m.created_at).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}
                        </time>
                      </div>
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.contenido}</p>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: "flex", gap: 8, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
              <input
                className="input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); }
                }}
                placeholder="Escribe respuesta y pulsa Enter…"
                style={{ flex: 1 }}
              />
              <button className="button" onClick={enviar} disabled={busy || !draft.trim()} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Send size={14} /> {busy ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: "grid", placeItems: "center", height: "100%", padding: 40, textAlign: "center" }}>
            <MessageSquare size={42} strokeWidth={1.4} color="var(--muted)" aria-hidden="true" />
            <h3 style={{ marginTop: 12, fontSize: 16 }}>Selecciona una conversación</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 6, maxWidth: 320 }}>
              Las preguntas y peticiones de tus clientes aparecen aquí. Las nuevas se marcan automáticamente como leídas al abrirlas.
            </p>
          </div>
        )}
      </article>
    </section>
  );
}
