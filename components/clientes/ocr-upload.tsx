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
  payment_method?: string;
  iban?: string;
};

type Extraction = {
  id: string;
  empresa_id: string;
  filename: string | null;
  storage_path: string | null;
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

type Modo = "ingreso" | "gasto";

type LocalPreview = { name: string; size: number; dataUrl: string | null; status: "uploading" | "ok" | "fail"; error?: string };

export function OcrUpload({ empresaId, modo = "gasto" }: { empresaId: string; modo?: Modo }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<Extraction[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [recent, setRecent] = useState<LocalPreview[]>([]);
  const [filter, setFilter] = useState<"todas" | "pendientes" | "vinculadas" | "descartadas">("todas");

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

    const local: LocalPreview[] = list.map((f) => ({ name: f.name, size: f.size, dataUrl: null, status: "uploading" as const }));
    setRecent(local);

    try {
      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        if (file.size > MAX_BYTES) {
          setRecent((r) => r.map((it, idx) => (idx === i ? { ...it, status: "fail", error: "Supera 6 MB" } : it)));
          continue;
        }
        if (!ACCEPT.split(",").includes(file.type)) {
          setRecent((r) => r.map((it, idx) => (idx === i ? { ...it, status: "fail", error: "Formato no soportado" } : it)));
          continue;
        }

        const base64 = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result ?? "").split(",")[1] ?? "");
          r.onerror = () => rej(r.error);
          r.readAsDataURL(file);
        });

        // Miniatura solo si es imagen
        if (file.type.startsWith("image/")) {
          setRecent((r) => r.map((it, idx) => (idx === i ? { ...it, dataUrl: `data:${file.type};base64,${base64}` } : it)));
        }

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
          setRecent((r) => r.map((it, idx) => (idx === i ? { ...it, status: "fail", error: json.error ?? "Error" } : it)));
        } else {
          setRecent((r) => r.map((it, idx) => (idx === i ? { ...it, status: "ok" } : it)));
        }
      }
      setSuccess(`Procesado${list.length > 1 ? `s ${list.length} archivos` : ""}. Revisa abajo los datos extraídos.`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmar(extraccionId: string, tipoConfirmar: "factura" | "gasto") {
    setError(null);
    try {
      const tk = await token();
      const res = await fetch(`/api/portal/extracciones/${extraccionId}/confirmar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: tipoConfirmar,
          factura_tipo: modo === "ingreso" ? "emitida" : "recibida",
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setSuccess(`Convertido en ${tipoConfirmar}${modo === "ingreso" ? " emitida" : tipoConfirmar === "factura" ? " recibida" : ""}.`);
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

  const stats = useMemo(() => {
    const total = items.length;
    const ok = items.filter((i) => i.factura_id || i.gasto_id).length;
    const rejected = items.filter((i) => i.status === "rejected").length;
    const pending = total - ok - rejected;
    const sumTotal = items.reduce((s, i) => s + Number(i.datos_extraidos?.total ?? 0), 0);
    return { total, ok, rejected, pending, sumTotal };
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "pendientes") return items.filter((i) => !i.factura_id && !i.gasto_id && i.status !== "rejected");
    if (filter === "vinculadas") return items.filter((i) => i.factura_id || i.gasto_id);
    if (filter === "descartadas") return items.filter((i) => i.status === "rejected");
    return items;
  }, [items, filter]);

  const heroAccent = modo === "ingreso" ? "var(--good)" : "var(--accent)";

  return (
    <section style={{ display: "grid", gap: 16 }}>
      {/* Dropzone hero */}
      <article
        className="ocr-dropzone"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) procesar(e.dataTransfer.files);
        }}
        data-drag={dragOver ? "yes" : "no"}
        data-busy={busy ? "yes" : "no"}
        onClick={() => !busy && fileInputRef.current?.click()}
        style={{
          position: "relative",
          textAlign: "center",
          padding: 36,
          borderRadius: 14,
          border: `2px dashed ${dragOver ? heroAccent : "var(--line)"}`,
          background: dragOver
            ? `radial-gradient(120% 80% at 50% 30%, color-mix(in srgb, ${heroAccent} 18%, transparent) 0%, transparent 70%)`
            : busy
            ? "color-mix(in srgb, var(--accent) 5%, transparent)"
            : undefined,
          cursor: busy ? "wait" : "pointer",
          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          overflow: "hidden",
        }}
      >
        {busy ? <div className="ocr-shimmer" aria-hidden="true" /> : null}
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: `radial-gradient(circle, color-mix(in srgb, ${heroAccent} 35%, transparent) 0%, transparent 70%)`,
            display: "grid",
            placeItems: "center",
            margin: "0 auto 12px",
            fontSize: 32,
            animation: busy ? "ocr-pulse 1.4s ease-in-out infinite" : dragOver ? "ocr-bob 0.9s ease-in-out infinite" : undefined,
          }}
        >
          {busy ? "🤖" : modo === "ingreso" ? "💰" : "🧾"}
        </div>
        <span className="card-eyebrow">{modo === "ingreso" ? "Lector ingresos · OCR con IA" : "Lector gastos · OCR con IA"}</span>
        <p style={{ fontSize: 17, marginTop: 8, marginBottom: 4, fontWeight: 600 }}>
          {busy
            ? "Procesando con IA · puede tardar 5–15 segundos"
            : dragOver
            ? "Suelta el archivo aquí"
            : modo === "ingreso"
            ? "Arrastra tus facturas emitidas o haz clic"
            : "Arrastra tus facturas/tickets de proveedor o haz clic"}
        </p>
        <small className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
          JPG · PNG · WebP · PDF · máx 6 MB · multi-archivo · detecta {modo === "ingreso" ? "cliente" : "proveedor"}, NIF, base, IVA, total
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

      {/* Miniaturas de archivos recién subidos */}
      {recent.length > 0 ? (
        <article className="card">
          <span className="card-eyebrow">Subida en curso</span>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
            {recent.map((r, i) => (
              <div
                key={i}
                style={{
                  width: 110,
                  borderRadius: 10,
                  border: `1px solid ${r.status === "fail" ? "var(--bad)" : r.status === "ok" ? "var(--good)" : "var(--line)"}`,
                  background: "var(--bg-soft, var(--bg, transparent))",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: 80,
                    background: r.dataUrl
                      ? `center / cover no-repeat url("${r.dataUrl}")`
                      : "linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent) 0%, color-mix(in srgb, var(--accent) 4%, transparent) 100%)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 28,
                    position: "relative",
                  }}
                >
                  {!r.dataUrl ? "📄" : null}
                  {r.status === "uploading" ? <div className="ocr-shimmer" aria-hidden="true" style={{ position: "absolute", inset: 0 }} /> : null}
                  {r.status === "ok" ? (
                    <div style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: "var(--good)", color: "white", display: "grid", placeItems: "center", fontSize: 13, animation: "ocr-pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>✓</div>
                  ) : null}
                </div>
                <div style={{ padding: "6px 8px" }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.name}
                  </div>
                  <small className="muted" style={{ fontSize: 10 }}>
                    {(r.size / 1024).toFixed(0)} KB{r.error ? ` · ${r.error}` : ""}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
      {success ? <p role="status" style={{ color: "var(--good)" }}>{success}</p> : null}

      {/* Estadísticas + filtros */}
      <section className="grid">
        <article className="card span-3">
          <span className="card-eyebrow">Total procesadas</span>
          <div className="metric" style={{ fontSize: 28 }}>{stats.total}</div>
          <div className="metric-foot good">archivos analizados</div>
        </article>
        <article className="card span-3">
          <span className="card-eyebrow">Vinculadas</span>
          <div className="metric accent" style={{ fontSize: 28 }}>{stats.ok}</div>
          <div className="metric-foot good">{modo === "ingreso" ? "ingresos confirmados" : "gastos confirmados"}</div>
        </article>
        <article className="card span-3">
          <span className="card-eyebrow">Pendientes</span>
          <div className="metric" style={{ fontSize: 28, color: stats.pending > 0 ? "var(--warn)" : undefined }}>{stats.pending}</div>
          <div className="metric-foot warn">esperan revisión</div>
        </article>
        <article className="card span-3">
          <span className="card-eyebrow">Importe total leído</span>
          <div className="metric" style={{ fontSize: 24 }}>{EUR(stats.sumTotal)}</div>
          <div className="metric-foot">acumulado IVA incluido</div>
        </article>
      </section>

      {/* Listado */}
      <article className="card">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span className="card-eyebrow">Extracciones</span>
          <div className="button-row" style={{ gap: 4 }}>
            <button className={`button compact ${filter === "todas" ? "" : "ghost"}`} onClick={() => setFilter("todas")}>Todas · {stats.total}</button>
            <button className={`button compact ${filter === "pendientes" ? "" : "ghost"}`} onClick={() => setFilter("pendientes")}>Pendientes · {stats.pending}</button>
            <button className={`button compact ${filter === "vinculadas" ? "" : "ghost"}`} onClick={() => setFilter("vinculadas")}>Vinculadas · {stats.ok}</button>
            <button className={`button compact ${filter === "descartadas" ? "" : "ghost"}`} onClick={() => setFilter("descartadas")}>Descartadas · {stats.rejected}</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
            {items.length === 0 ? "Sin facturas procesadas todavía. Sube la primera arriba." : "Sin resultados para este filtro."}
          </p>
        ) : (
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Archivo</th>
                <th>{modo === "ingreso" ? "Cliente" : "Proveedor"}</th>
                <th>NIF</th>
                <th>Fecha</th>
                <th>Nº</th>
                <th className="num">Base</th>
                <th className="num">IVA</th>
                <th className="num">Total</th>
                <th>Confianza</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const d = e.datos_extraidos ?? {};
                const conf = e.confidence ?? 0;
                const confColor = conf >= 80 ? "var(--good)" : conf >= 50 ? "var(--warn)" : "var(--bad)";
                const linked = e.factura_id || e.gasto_id;
                return (
                  <tr key={e.id}>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.filename ?? e.id.slice(0, 8)}
                    </td>
                    <td><strong>{d.vendor_name ?? "—"}</strong></td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{d.vendor_nif ?? "—"}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{d.issue_date ?? "—"}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{d.invoice_number ?? "—"}</td>
                    <td className="num">{d.base != null ? EUR(d.base) : "—"}</td>
                    <td className="num">{d.iva != null ? EUR(d.iva) : "—"}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{d.total != null ? EUR(d.total) : "—"}</td>
                    <td>
                      <div style={{ display: "grid", gap: 4, minWidth: 90 }}>
                        <div style={{ height: 6, borderRadius: 4, background: "color-mix(in srgb, var(--line) 60%, transparent)", overflow: "hidden" }}>
                          <div style={{ width: `${conf}%`, height: "100%", background: confColor, transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }} />
                        </div>
                        <small style={{ fontFamily: "var(--mono)", fontSize: 10, color: confColor }}>
                          {conf.toFixed(0)}% · {e.status}
                        </small>
                      </div>
                    </td>
                    <td>
                      {linked ? (
                        <span className="pill good" style={{ fontSize: 11 }}>✓ vinculado</span>
                      ) : e.status === "rejected" ? (
                        <span className="muted" style={{ fontSize: 11 }}>descartado</span>
                      ) : (
                        <div className="button-row" style={{ gap: 4 }}>
                          {modo === "ingreso" ? (
                            <button className="button compact" onClick={() => confirmar(e.id, "factura")} title="Crear factura emitida">+ Ingreso</button>
                          ) : (
                            <>
                              <button className="button compact" onClick={() => confirmar(e.id, "gasto")} title="Convertir en gasto">+ Gasto</button>
                              <button className="button secondary compact" onClick={() => confirmar(e.id, "factura")} title="Convertir en factura recibida">+ Factura</button>
                            </>
                          )}
                          <button className="button ghost compact" onClick={() => descartar(e.id)} title="Descartar">✕</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </article>

      {/* Estilos locales para animaciones de carga */}
      <style jsx global>{`
        @keyframes ocr-pulse {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes ocr-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes ocr-pop {
          0% { transform: scale(0); }
          70% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes ocr-shimmer-anim {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .ocr-shimmer {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .ocr-shimmer::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            105deg,
            transparent 30%,
            color-mix(in srgb, var(--accent) 22%, transparent) 50%,
            transparent 70%
          );
          animation: ocr-shimmer-anim 1.4s linear infinite;
        }
        .ocr-dropzone[data-drag="yes"] { transform: scale(1.005); }
      `}</style>
    </section>
  );
}
