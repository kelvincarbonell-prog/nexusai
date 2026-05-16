"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type FirmaDoc = {
  ref: string;
  doc_tipo: string;
  filename: string;
  formato: string;
  file_size: number;
  storage_path: string;
  signed_hash: string;
  created_at: string;
};

export function ClienteFirmas({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [items, setItems] = useState<FirmaDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const tk = sess.session?.access_token ?? "";
        const res = await fetch(`/api/portal/firmas?empresa_id=${empresaId}`, {
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

  return (
    <section className="grid">
      <article className="card span-12">
        <span className="card-eyebrow">Cl@ve & firmas digitales</span>
        <h2 style={{ fontSize: 18, margin: "4px 0 0" }}>{items.length} documento{items.length !== 1 ? "s" : ""} firmado{items.length !== 1 ? "s" : ""}</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Histórico de documentos firmados digitalmente. Cada uno incluye hash criptográfico de integridad y referencia
          única.
        </p>

        {loading ? <p className="muted">Cargando…</p> : null}
        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}

        {items.length === 0 && !loading ? (
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>Aún no hay documentos firmados.</p>
        ) : (
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Tipo</th>
                <th>Archivo</th>
                <th>Tamaño</th>
                <th>Hash</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {items.map((f) => (
                <tr key={f.ref}>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{f.ref}</td>
                  <td><span className="pill plain">{f.doc_tipo}</span></td>
                  <td>{f.filename}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{(f.file_size / 1024).toFixed(1)} KB</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)" }}>
                    {f.signed_hash.slice(0, 12)}…
                  </td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                    {new Date(f.created_at).toLocaleDateString("es-ES")}
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
