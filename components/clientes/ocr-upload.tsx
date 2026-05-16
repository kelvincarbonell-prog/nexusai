"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type ExtractedInvoice = {
  vendor_name?: string;
  vendor_nif?: string;
  invoice_number?: string;
  issue_date?: string;
  due_date?: string;
  concepto?: string;
  base?: number;
  iva?: number;
  iva_pct?: number;
  irpf?: number;
  irpf_pct?: number;
  total?: number;
  currency?: string;
};

type Extraction = {
  id: string;
  empresa_id: string;
  filename: string | null;
  status: "pending" | "extracted" | "reviewed" | "rejected" | "failed";
  confidence: number | null;
  datos_extraidos: ExtractedInvoice;
  factura_id: string | null;
  gasto_id: string | null;
  created_at: string;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
const MAX_BYTES = 6 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export function OcrUpload({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<Extraction[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    try {
      const tk = await token();
      const res = await fetch(`/api/portal/extracciones?empresa_id=${empresaId}`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const json = await res.json();
      if (json.ok) setItems(json.items ?? []);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function procesar(files: FileList | File[]) {
    setError(null);
    setSuccess(null);
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);
    try {
      for (const file of list) {
        if (file.size > MAX_BYTES) {
          setError(`${file.name}: supera el máximo de 6 MB.`);
          continue;
        }
        if (!ACCEPT.split(",").includes(file.type)) {
          setError(`${file.name}: formato no soportado (usa JPG, PNG, WebP o PDF).`);
          continue;
        }
        // PDF: leemos texto si es posible; si no, lo subimos como imagen plana (1ª página)
        const base64 = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result ?? "").split(",")[1] ?? "");
          r.onerror = () => rej(r.error);
          r.readAsDataURL(file);
        });
        const tk = await token();
        const res = await fetch("/api/agents/extract-invoice", {
          method: "POST",
          headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            empresa_id: empresaId,
            source: "upload",
            filename: file.name,
            mime_type: file.type,
            base64,
          }),
        });
        const json = await res.json();
        if (!json.ok && !json.item) {
          setError(`${file.name}: ${json.error ?? "error desconocido"}`);
        }
      }
      setSuccess("Procesado. Revisa abajo los datos extraídos antes de confirmar.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmar(extraccionId: string, tipo: "factura" | "gasto") {
    setError(null);
    try {
      const tk = await token();
      const res = await fetch(`/api/portal/extracciones/${extraccionId}/confirmar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ tipo }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setSuccess(`Convertido en ${tipo}.`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  async function descartar(extraccionId: string) {
    setError(null);
    try {
      const tk = await token();
      const res = await fetch(`/api/portal/extracciones/${extraccionId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <article
        className="card"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) procesar(e.dataTransfer.files);
        }}
        style={{
          textAlign: "center",
          padding: 32,
          border: `2px dashed ${dragOver ? "var(--accent)" : "var(--line)"}`,
          background: dragOver ? "color-mix(in srgb, var(--accent) 8%, transparent)" : undefined,
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <span className="card-eyebrow">OCR · subir factura</span>
        <p style={{ fontSize: 16, marginTop: 12, marginBottom: 4 }}>
          {busy ? "Procesando con IA…" : "Arrastra o haz clic para subir una factura"}
        </p>
        <small className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
          JPG · PNG · WebP · PDF · máx 6 MB · IA detectará proveedor, NIF, base, IVA, total
        </small>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          style={{ display: "none" }}
          onChange={(e) => e.target.files && procesar(e.target.files)}
        />
        <div className="button-row" style={{ justifyContent: "center", marginTop: 16 }}>
          <button className="button" disabled={busy}>
            {busy ? "Procesando…" : "Seleccionar archivo"}
          </button>
        </div>
      </article>

      {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
      {success ? <p role="status" style={{ color: "var(--good)" }}>{success}</p> : null}

      {items.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>Sin facturas procesadas todavía.</p>
      ) : (
        <article className="card">
          <span className="card-eyebrow">Extracciones recientes</span>
          <table className="table" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Archivo</th>
                <th>Proveedor</th>
                <th>NIF</th>
                <th>Fecha</th>
                <th className="num">Base</th>
                <th className="num">IVA</th>
                <th className="num">Total</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => {
                const d = e.datos_extraidos ?? {};
                const conf = e.confidence ?? 0;
                const confClass = conf >= 80 ? "good" : conf >= 50 ? "warn" : "bad";
                const linked = e.factura_id || e.gasto_id;
                return (
                  <tr key={e.id}>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{e.filename ?? e.id.slice(0, 8)}</td>
                    <td>{d.vendor_name ?? "—"}</td>
                    <td style={{ fontFamily: "var(--mono)" }}>{d.vendor_nif ?? "—"}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{d.issue_date ?? "—"}</td>
                    <td className="num">{d.base != null ? EUR(d.base) : "—"}</td>
                    <td className="num">{d.iva != null ? EUR(d.iva) : "—"}</td>
                    <td className="num">{d.total != null ? EUR(d.total) : "—"}</td>
                    <td>
                      <span className={`pill ${confClass}`} style={{ fontSize: 11 }}>
                        {e.status} {conf > 0 ? `· ${conf.toFixed(0)}%` : ""}
                      </span>
                    </td>
                    <td>
                      {linked ? (
                        <span className="pill good" style={{ fontSize: 11 }}>✓ vinculado</span>
                      ) : e.status === "rejected" ? (
                        <span className="muted" style={{ fontSize: 11 }}>descartado</span>
                      ) : (
                        <div className="button-row" style={{ gap: 4 }}>
                          <button className="button compact" onClick={() => confirmar(e.id, "gasto")}>+ Gasto</button>
                          <button className="button secondary compact" onClick={() => descartar(e.id)}>✕</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </article>
      )}
    </section>
  );
}
