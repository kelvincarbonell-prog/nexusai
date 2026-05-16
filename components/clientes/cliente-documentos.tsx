"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Documento = {
  id: string;
  nombre: string;
  tipo: string | null;
  estado: string;
  storage_path: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export function ClienteDocumentos({ empresaId, filtro = "todos" }: { empresaId: string; filtro?: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [items, setItems] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const tk = sess.session?.access_token ?? "";
        const res = await fetch(`/api/portal/documentos?empresa_id=${empresaId}`, {
          headers: { Authorization: `Bearer ${tk}` },
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "Error");
        setItems(json.items ?? []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, [empresaId, supabase]);

  const filtered = filtro === "todos" || !filtro
    ? items
    : items.filter((d) => (d.tipo ?? "").toLowerCase().includes(filtro));

  return (
    <section className="grid">
      <article className="card span-12">
        <span className="card-eyebrow">Documentos</span>
        <h2 style={{ fontSize: 18, margin: "4px 0 0" }}>
          {filtered.length} documento{filtered.length !== 1 ? "s" : ""}
          {filtro && filtro !== "todos" ? <span className="muted" style={{ fontSize: 14, marginLeft: 8 }}>· filtro: {filtro}</span> : null}
        </h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Documentos cargados por gestor o cliente. Para subir nuevas facturas con OCR usa la pestaña «Subir factura».
        </p>

        {loading ? <p className="muted">Cargando…</p> : null}
        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}

        {filtered.length === 0 && !loading ? (
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>{items.length === 0 ? "Sin documentos registrados." : `Sin documentos en "${filtro}".`}</p>
        ) : (
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.nombre}</strong></td>
                  <td>{d.tipo ?? "—"}</td>
                  <td><span className={`pill ${d.estado === "firmado" ? "good" : d.estado === "pendiente" ? "warn" : "plain"}`}>{d.estado}</span></td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                    {new Date(d.created_at).toLocaleDateString("es-ES")}
                  </td>
                  <td>
                    {d.storage_path ? (
                      <a className="button secondary compact" href={`/api/documents/generate?path=${encodeURIComponent(d.storage_path)}`} rel="noreferrer">
                        Descargar
                      </a>
                    ) : (
                      <span className="muted" style={{ fontSize: 11 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </section>
  );
}
