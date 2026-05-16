"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Mensaje = {
  id: string;
  remitente_id: string;
  contenido: string;
  leido: boolean;
  created_at: string;
};

export function ClienteMensajes({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [items, setItems] = useState<Mensaje[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [gestorId, setGestorId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    try {
      const tk = await token();
      const res = await fetch(`/api/portal/mensajes?empresa_id=${empresaId}`, { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (json.ok) {
        setItems(json.items ?? []);
        setMe(json.me ?? null);
        setGestorId(json.gestor_id ?? null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000); // refrescar cada 8s para mensajes nuevos
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [items.length]);

  async function enviar() {
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const tk = await token();
      const res = await fetch("/api/portal/mensajes", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId, contenido: draft.trim() }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setDraft("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid">
      <article className="card span-12" style={{ display: "grid", gridTemplateRows: "auto 1fr auto", height: "70vh", minHeight: 480 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
          <div>
            <span className="card-eyebrow">Mensajes con tu asesor</span>
            <h2 style={{ fontSize: 18, margin: "4px 0 0" }}>Chat directo</h2>
          </div>
          <span className="pill plain" style={{ fontSize: 11 }}>{items.length} mensajes</span>
        </header>

        <div
          ref={scrollRef}
          style={{
            overflowY: "auto",
            padding: "16px 4px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {items.length === 0 ? (
            <p className="muted" style={{ textAlign: "center", marginTop: 40, fontSize: 13 }}>
              Aún no hay mensajes. Empieza la conversación con tu asesor.
            </p>
          ) : (
            items.map((m) => {
              const isMine = m.remitente_id === me;
              const isAsesor = m.remitente_id === gestorId;
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: isMine ? "flex-end" : "flex-start",
                    maxWidth: "75%",
                    background: isMine
                      ? "color-mix(in srgb, var(--accent) 18%, transparent)"
                      : "color-mix(in srgb, var(--line) 50%, transparent)",
                    padding: "10px 14px",
                    borderRadius: 14,
                    borderTopRightRadius: isMine ? 4 : 14,
                    borderTopLeftRadius: !isMine ? 4 : 14,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
                    <strong style={{ fontSize: 12 }}>{isMine ? "Tú" : isAsesor ? "Asesor" : "Equipo"}</strong>
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

        {error ? <p role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p> : null}

        <div style={{ display: "flex", gap: 8, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <input
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder="Escribe un mensaje y pulsa Enter…"
            style={{ flex: 1 }}
          />
          <button className="button" onClick={enviar} disabled={busy || !draft.trim()}>
            {busy ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </article>
    </section>
  );
}
