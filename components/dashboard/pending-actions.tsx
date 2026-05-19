"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileSignature, ArrowRight, Loader2, Shield, FileText, Banknote, Calculator, X } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { AutofirmaButton } from "@/components/firma/autofirma-button";

type PendingItem = {
  kind: "modelo_aeat" | "nomina" | "factura";
  id: string;
  empresa_id: string;
  empresa_nombre: string;
  titulo: string;
  subtitulo: string;
  importe?: number;
  confidence?: number;
  link: string;            // dónde ir si el usuario quiere revisar antes de firmar
  firmable: boolean;       // si tenemos contenido base64 para firmar
};

const EUR = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function PendingActions() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [firmandoId, setFirmandoId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const tk = sess.session?.access_token ?? "";
        const res = await fetch("/api/dashboard/pendientes-firma", { headers: { Authorization: `Bearer ${tk}` } });
        const j = await res.json();
        if (j.ok) setItems(j.items ?? []);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const iconFor = (kind: PendingItem["kind"]) =>
    kind === "modelo_aeat" ? <Calculator size={14} /> : kind === "nomina" ? <Banknote size={14} /> : <FileText size={14} />;

  const itemActivo = items.find((i) => i.id === firmandoId) ?? null;

  if (loading) {
    return (
      <section className="action-row">
        {[0, 1, 2].map((i) => (
          <article key={i} className="action-card" style={{ opacity: 0.55 }}>
            <div className="head"><span className="pill">Cargando…</span></div>
            <div className="amount skeleton" style={{ height: 24, width: 80 }} />
          </article>
        ))}
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="action-row">
        <article className="action-card" style={{ display: "grid", gap: 8, placeItems: "center", textAlign: "center" }}>
          <Shield size={28} color="#10b981" />
          <strong>Sin firmas pendientes</strong>
          <small className="muted">Cuando haya modelos AEAT preparados, nóminas o facturas listas, aparecerán aquí.</small>
        </article>
      </section>
    );
  }

  return (
    <>
      <section className="action-row">
        {items.slice(0, 5).map((it) => (
          <article key={it.id} className="action-card">
            <div className="head">
              <span className="pill">{iconFor(it.kind)} {it.kind === "modelo_aeat" ? "AEAT" : it.kind === "nomina" ? "Nómina" : "Factura"}</span>
              {it.confidence ? <span>{it.confidence}%</span> : null}
            </div>
            <strong>{it.empresa_nombre}</strong>
            <small className="muted">{it.subtitulo}</small>
            {it.importe != null && <div className="amount">{EUR(it.importe)}</div>}
            <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
              <Link href={it.link} className="button secondary compact" style={{ flex: 1, justifyContent: "center" }}>
                Revisar
              </Link>
              {it.firmable ? (
                <button
                  className="button compact"
                  onClick={() => setFirmandoId(it.id)}
                  style={{ justifyContent: "center", flex: 1, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <FileSignature size={12} />
                  Firmar
                </button>
              ) : (
                <Link href={it.link} className="button compact" style={{ flex: 1, justifyContent: "center", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <ArrowRight size={12} />
                  Abrir
                </Link>
              )}
            </div>
          </article>
        ))}
      </section>

      {itemActivo && (
        <FirmarModal item={itemActivo} onClose={() => setFirmandoId(null)} supabase={supabase} />
      )}
    </>
  );
}

function FirmarModal({
  item,
  onClose,
  supabase,
}: {
  item: PendingItem;
  onClose: () => void;
  supabase: ReturnType<typeof createBrowserSupabase>;
}) {
  const [contenido, setContenido] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const tk = sess.session?.access_token ?? "";
        // Pedimos el contenido a firmar (TXT/XML/PDF base64)
        const res = await fetch(`/api/dashboard/pendientes-firma/${item.id}?kind=${item.kind}&empresa_id=${item.empresa_id}`, {
          headers: { Authorization: `Bearer ${tk}` },
        });
        const j = await res.json();
        if (!j.ok) throw new Error(j.error ?? "No se pudo obtener el contenido");
        setContenido(j.contenido_b64);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={dialog}>
        <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FileSignature size={16} />
          <div style={{ display: "grid" }}>
            <strong style={{ fontSize: 14 }}>Firmar · {item.titulo}</strong>
            <small style={{ opacity: 0.7, fontSize: 12 }}>{item.empresa_nombre} · {item.subtitulo}</small>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={iconBtn}><X size={14} /></button>
        </header>

        {loading && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, opacity: 0.7 }}>
            <Loader2 size={14} className="animate-spin" /> Preparando contenido…
          </div>
        )}
        {err && (
          <div style={{ padding: 10, borderRadius: 8, background: "#ef444412", border: "1px solid #ef444455", color: "#ef4444", fontSize: 13 }}>
            {err}
          </div>
        )}

        {contenido && !err && (
          <>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>
              Vas a firmar con tu <strong>certificado digital</strong> a través de Autofirma. Si no lo tienes instalado,
              te pedirá el descargarlo. Tras firmar, podrás <strong>presentar el TXT/XML en la sede AEAT</strong> o
              enviarlo directamente al cliente.
            </p>
            <AutofirmaButton
              contenidoBase64={contenido}
              endpointPersistir={`/api/dashboard/pendientes-firma/${item.id}/firmado`}
              extra={{ empresa_id: item.empresa_id, kind: item.kind }}
              label="Firmar con certificado"
            />
            <div style={{ paddingTop: 10, borderTop: "1px solid color-mix(in srgb, currentColor 12%, transparent)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Link href={item.link} onClick={onClose} className="button ghost compact">
                Abrir para revisar
              </Link>
              <small style={{ fontSize: 11, opacity: 0.6 }}>Firma con Autofirma · Gobierno de España</small>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", padding: 16, zIndex: 1000 };
const dialog: React.CSSProperties = { width: "min(520px, 100%)", background: "var(--panel, #fff)", borderRadius: 14, border: "1px solid var(--line, #e5e7eb)", padding: 18, display: "grid", gap: 12 };
const iconBtn: React.CSSProperties = { marginLeft: "auto", border: "none", background: "transparent", cursor: "pointer", padding: 4, color: "inherit" };
