"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, ReceiptText, FileImage, FilePlus2, Check, X, Eye, Trash2 } from "lucide-react";
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
  status: "pending" | "extracted" | "reviewed" | "rejected" | "failed" | "queued" | "needs_manual_review";
  confidence: number | null;
  datos_extraidos: ExtractedInvoice;
  factura_id: string | null;
  gasto_id: string | null;
  match_score?: number | null;
  match_warnings?: string[] | null;
  retry_count?: number | null;
  next_retry_at?: string | null;
  eta_seconds?: number | null;
  created_at: string;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
const MAX_BYTES = 6 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

type Modo = "ingreso" | "gasto";

type Stage = "loading" | "scanning" | "extracting" | "encrypting" | "done";
type LocalPreview = {
  name: string;
  size: number;
  dataUrl: string | null;
  status: "uploading" | "ok" | "fail";
  stage?: Stage;
  error?: string;
  result?: {
    vendor_name?: string;
    vendor_nif?: string;
    total?: number;
    confidence?: number;
    provider?: string;
  };
};

const STAGE_LABELS: Record<Stage, string> = {
  loading: "Cargando…",
  scanning: "Analizando virus…",
  extracting: "Extrayendo datos…",
  encrypting: "Encriptando…",
  done: "Cargado con éxito",
};

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
  const [aiUnavailable, setAiUnavailable] = useState(false);

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

  function updateStage(idx: number, stage: Stage) {
    setRecent((r) => r.map((it, i) => (i === idx ? { ...it, stage } : it)));
  }

  async function procesar(files: FileList | File[]) {
    setError(null);
    setSuccess(null);
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);

    const local: LocalPreview[] = list.map((f) => ({ name: f.name, size: f.size, dataUrl: null, status: "uploading" as const, stage: "loading" as const }));
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

        updateStage(i, "loading");
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
        const startedAt = Date.now();
        // Fases mientras esperamos la respuesta de la IA.
        const stageTimers: ReturnType<typeof setTimeout>[] = [];
        stageTimers.push(setTimeout(() => updateStage(i, "scanning"), 400));
        stageTimers.push(setTimeout(() => updateStage(i, "extracting"), 1400));
        stageTimers.push(setTimeout(() => updateStage(i, "encrypting"), 4500));

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
        stageTimers.forEach(clearTimeout);
        const json = await res.json();
        const elapsed = Date.now() - startedAt;
        void elapsed;

        if (!json.ok && !json.item) {
          setRecent((r) => r.map((it, idx) => (idx === i ? { ...it, status: "fail", error: json.error ?? "Error" } : it)));
          if (typeof json.error === "string" && /proveedor IA|sin configurar|api[\s_-]?key|OPENAI|ANTHROPIC|GEMINI|visión/i.test(json.error)) {
            setAiUnavailable(true);
          }
        } else {
          const datos = (json.item?.datos_extraidos ?? {}) as Record<string, unknown>;
          setRecent((r) =>
            r.map((it, idx) =>
              idx === i
                ? {
                    ...it,
                    status: "ok",
                    stage: "done",
                    result: {
                      vendor_name: datos.vendor_name as string | undefined,
                      vendor_nif: datos.vendor_nif as string | undefined,
                      total: typeof datos.total === "number" ? (datos.total as number) : undefined,
                      confidence: typeof json.confidence === "number" ? json.confidence : undefined,
                      provider: typeof json.provider === "string" ? json.provider : undefined,
                    },
                  }
                : it,
            ),
          );
        }
      }
      // Cuenta los archivos auto-confirmados para mostrar mensaje específico
      const autoConfirmados = recent.filter((r) => r.result?.confidence !== undefined && r.result.confidence >= 70 && r.status === "ok").length;
      if (autoConfirmados > 0) {
        setSuccess(`${autoConfirmados} ${modo === "ingreso" ? "ingreso" : "gasto"}${autoConfirmados > 1 ? "s" : ""} creado${autoConfirmados > 1 ? "s" : ""} automáticamente con cuenta PGC asignada por IA. Ya aparecen en el listado.`);
      } else {
        setSuccess(`Procesado${list.length > 1 ? `s ${list.length} archivos` : ""}. Revisa los datos extraídos y confirma cada uno.`);
      }
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

  async function borrar(extraccionId: string) {
    if (!confirm("¿Borrar definitivamente esta extracción y su archivo? No se puede deshacer.")) return;
    setError(null);
    try {
      const tk = await token();
      const res = await fetch(`/api/portal/extracciones/${extraccionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tk}` },
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setSuccess("Extracción borrada.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);

  async function visualizar(extraccionId: string) {
    setError(null);
    try {
      const tk = await token();
      const res = await fetch(`/api/portal/extracciones/${extraccionId}/archivo`, {
        headers: { Authorization: `Bearer ${tk}` },
      });
      const json = await res.json();
      if (!json.ok || !json.url) throw new Error(json.error ?? "Sin archivo");
      // Abre en modal interno (pequeño en pantalla), no en pestaña nueva
      setPreviewUrl(json.url);
      setPreviewMime(json.mime_type ?? null);
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
      {aiUnavailable ? (
        <article className="card" style={{ borderColor: "var(--bad)", background: "color-mix(in srgb, var(--bad) 6%, transparent)" }}>
          <span className="card-eyebrow bad">Falta configurar la IA con visión</span>
          <p style={{ marginTop: 8, fontSize: 14 }}>
            Configura en Vercel cualquiera de estas keys (todas tienen tier gratuito) y vuelve a desplegar.
            El sistema usa la primera disponible y va cayendo a las siguientes si falla:
          </p>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
            <li><code style={{ fontFamily: "var(--mono)" }}>GEMINI_API_KEY</code> — Gemini flash (recomendado). <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>Sacar clave →</a></li>
            <li><code style={{ fontFamily: "var(--mono)" }}>MISTRAL_API_KEY</code> — Pixtral 12B vision free. <a href="https://console.mistral.ai/api-keys" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>Sacar clave →</a></li>
            <li><code style={{ fontFamily: "var(--mono)" }}>OPENROUTER_API_KEY</code> — Llama 3.2 Vision free. <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>Sacar clave →</a></li>
            <li><code style={{ fontFamily: "var(--mono)" }}>OCRSPACE_API_KEY</code> — 25k req/mes gratis, extrae texto y lo pasa a Groq. <a href="https://ocr.space/ocrapi/freekey" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>Sacar clave →</a></li>
          </ul>
        </article>
      ) : null}

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
            color: heroAccent,
            animation: busy ? "ocr-pulse 1.4s ease-in-out infinite" : dragOver ? "ocr-bob 0.9s ease-in-out infinite" : undefined,
          }}
        >
          {busy ? <Sparkles size={28} strokeWidth={1.6} /> : modo === "ingreso" ? <ReceiptText size={28} strokeWidth={1.6} /> : <FileImage size={28} strokeWidth={1.6} />}
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

      {/* Panel de extracción con efectos premium */}
      {recent.length > 0 ? (
        <article className="card">
          <span className="card-eyebrow">
            {recent.every((r) => r.status === "ok") ? "Listo · resultado del OCR" : recent.some((r) => r.status === "uploading") ? "Procesando con IA…" : "Subida"}
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14, marginTop: 12 }}>
            {recent.map((r, i) => {
              const isWorking = r.status === "uploading";
              const isDone = r.status === "ok";
              const isFail = r.status === "fail";
              return (
                <div
                  key={i}
                  className="ocr-tile"
                  data-state={r.status}
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${isFail ? "var(--bad)" : isDone ? "var(--good)" : "var(--line)"}`,
                    background: "var(--bg-soft, var(--bg, transparent))",
                    overflow: "hidden",
                    position: "relative",
                    transition: "border-color 0.3s ease, box-shadow 0.3s ease, transform 0.3s ease",
                    boxShadow: isDone
                      ? "0 8px 26px -16px color-mix(in srgb, var(--good) 60%, transparent)"
                      : isWorking
                      ? "0 8px 26px -16px color-mix(in srgb, var(--accent) 60%, transparent)"
                      : undefined,
                  }}
                >
                  {/* Preview con barrido de escáner */}
                  <div
                    style={{
                      height: 130,
                      background: r.dataUrl
                        ? `center / cover no-repeat url("${r.dataUrl}")`
                        : "linear-gradient(135deg, color-mix(in srgb, var(--accent) 16%, transparent) 0%, color-mix(in srgb, var(--accent) 4%, transparent) 100%)",
                      display: "grid",
                      placeItems: "center",
                      position: "relative",
                      color: "var(--muted)",
                      overflow: "hidden",
                    }}
                  >
                    {!r.dataUrl ? <FilePlus2 size={34} strokeWidth={1.5} aria-hidden="true" /> : null}

                    {/* Barrido de escáner durante el procesamiento */}
                    {isWorking ? (
                      <>
                        <div className="ocr-scanline" aria-hidden="true" />
                        <div className="ocr-grid-overlay" aria-hidden="true" />
                      </>
                    ) : null}

                    {/* Badge de éxito con animación pop */}
                    {isDone ? (
                      <div
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: "var(--good)",
                          color: "white",
                          display: "grid",
                          placeItems: "center",
                          animation: "ocr-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
                          boxShadow: "0 4px 12px -2px color-mix(in srgb, var(--good) 50%, transparent)",
                        }}
                      >
                        <Check size={15} strokeWidth={2.8} aria-hidden="true" />
                      </div>
                    ) : isFail ? (
                      <div
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: "var(--bad)",
                          color: "white",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <X size={15} strokeWidth={2.8} aria-hidden="true" />
                      </div>
                    ) : null}

                    {/* Indicador de fase (centro, sobre la imagen) */}
                    {isWorking && r.stage ? (
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          padding: "8px 10px",
                          background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
                          color: "white",
                          fontSize: 11,
                          fontFamily: "var(--mono)",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span className="ocr-dot" aria-hidden="true" />
                        <span>{STAGE_LABELS[r.stage]}</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Datos del archivo */}
                  <div style={{ padding: "10px 12px" }}>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.name}
                    </div>
                    <small className="muted" style={{ fontSize: 10, fontFamily: "var(--mono)" }}>
                      {(r.size / 1024).toFixed(0)} KB
                      {r.result?.provider ? ` · ${r.result.provider}` : ""}
                    </small>

                    {/* Resultado revelado con animación */}
                    {isDone && r.result ? (
                      <div className="ocr-reveal" style={{ marginTop: 10, display: "grid", gap: 4 }}>
                        {r.result.vendor_name ? (
                          <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.result.vendor_name}
                          </div>
                        ) : null}
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 11 }}>
                          {r.result.vendor_nif ? (
                            <span style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>{r.result.vendor_nif}</span>
                          ) : <span />}
                          {typeof r.result.total === "number" ? (
                            <span style={{ fontWeight: 700 }}>{EUR(r.result.total)}</span>
                          ) : null}
                        </div>
                        {typeof r.result.confidence === "number" ? (
                          <div style={{ display: "grid", gap: 3, marginTop: 4 }}>
                            <div style={{ height: 4, borderRadius: 2, background: "color-mix(in srgb, var(--line) 60%, transparent)", overflow: "hidden" }}>
                              <div
                                style={{
                                  width: `${r.result.confidence}%`,
                                  height: "100%",
                                  background: r.result.confidence >= 80 ? "var(--good)" : r.result.confidence >= 50 ? "var(--warn)" : "var(--bad)",
                                  transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
                                }}
                              />
                            </div>
                            <small style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)" }}>
                              {r.result.confidence.toFixed(0)}% confianza
                            </small>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {isFail && r.error ? (
                      <small style={{ fontSize: 10, color: "var(--bad)", marginTop: 6, display: "block" }}>
                        {r.error}
                      </small>
                    ) : null}
                  </div>
                </div>
              );
            })}
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
            <button className={`button compact ${filter === "pendientes" ? "" : "ghost"}`} onClick={() => setFilter("pendientes")} title="Subidas pero aún sin guardar como gasto/ingreso">Sin guardar · {stats.pending}</button>
            <button className={`button compact ${filter === "vinculadas" ? "" : "ghost"}`} onClick={() => setFilter("vinculadas")} title="Ya están en tu listado de gastos/ingresos">Guardadas · {stats.ok}</button>
            <button className={`button compact ${filter === "descartadas" ? "" : "ghost"}`} onClick={() => setFilter("descartadas")}>Descartadas · {stats.rejected}</button>
            <a href="?tab=gastos" className="button compact ghost" style={{ marginLeft: "auto" }} title="Ver listado completo con filtro Pendiente/Cobrada">Ver en Gastos →</a>
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
                <th>{modo === "ingreso" ? "Cliente" : "Proveedor"}</th>
                <th>NIF</th>
                <th>Fecha</th>
                <th className="num">Base</th>
                <th className="num">IVA</th>
                <th className="num">Total</th>
                <th>Estado</th>
                <th style={{ width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const d = e.datos_extraidos ?? {};
                const conf = e.confidence ?? 0;
                const okScan = conf >= 70 && e.status !== "failed";
                const linked = e.factura_id || e.gasto_id;
                return (
                  <tr key={e.id}>
                    <td><strong>{d.vendor_name ?? "—"}</strong></td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{d.vendor_nif ?? "—"}</td>
                    <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{d.issue_date ?? "—"}</td>
                    <td className="num">{d.base != null ? EUR(d.base) : "—"}</td>
                    <td className="num">{d.iva != null ? EUR(d.iva) : "—"}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{d.total != null ? EUR(d.total) : "—"}</td>
                    <td>
                      {e.status === "failed" ? (
                        <span className="pill bad" style={{ fontSize: 11 }}>No leída</span>
                      ) : okScan ? (
                        <span className="pill good" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Check size={11} strokeWidth={2.5} /> Escaneada correctamente
                        </span>
                      ) : (
                        <span className="pill warn" style={{ fontSize: 11 }}>Revisa los datos</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "inline-flex", gap: 4, alignItems: "center", whiteSpace: "nowrap" }}>
                        {/* Acción primaria (varía según estado) */}
                        {linked ? (
                          <span
                            className="pill good"
                            style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}
                            title="Ya está en tu listado de gastos"
                          >
                            <Check size={11} /> Guardado
                          </span>
                        ) : e.status === "rejected" ? (
                          <span className="muted" style={{ fontSize: 11 }}>Deshecho</span>
                        ) : e.status === "queued" ? (
                          <span className="pill warn" style={{ fontSize: 11 }} title={`Reintento ${(e.retry_count ?? 0) + 1}`}>
                            en espera · ~{Math.max(1, Math.round((e.eta_seconds ?? 1800) / 60))}min
                          </span>
                        ) : (
                          <button
                            className="button compact"
                            onClick={() => confirmar(e.id, modo === "ingreso" ? "factura" : "gasto")}
                            title={
                              e.status === "needs_manual_review"
                                ? `Guardar pese al aviso · ${(e.match_warnings ?? []).join(" · ") || "datos no coinciden"}`
                                : "Guardar y generar asiento contable"
                            }
                            style={{
                              padding: "4px 12px",
                              fontWeight: 600,
                              ...(e.status === "needs_manual_review"
                                ? { background: "color-mix(in srgb, #f59e0b 15%, transparent)", border: "1px solid #f59e0b66", color: "#f59e0b" }
                                : null),
                            }}
                          >
                            Guardar
                          </button>
                        )}
                        {/* Acciones secundarias en iconos */}
                        {e.storage_path && (
                          <button
                            className="icon-btn"
                            onClick={() => visualizar(e.id)}
                            title="Ver factura"
                            aria-label="Ver factura"
                          >
                            <Eye size={14} strokeWidth={1.8} />
                          </button>
                        )}
                        {!linked && e.status !== "rejected" && (
                          <button
                            className="icon-btn"
                            onClick={() => descartar(e.id)}
                            title="Deshacer (no borra)"
                            aria-label="Deshacer"
                            style={{ opacity: 0.7 }}
                          >
                            <X size={14} strokeWidth={2} />
                          </button>
                        )}
                        <button
                          className="icon-btn"
                          onClick={() => borrar(e.id)}
                          title="Borrar definitivamente"
                          aria-label="Borrar"
                          style={{ color: "var(--bad, #ef4444)" }}
                        >
                          <Trash2 size={14} strokeWidth={1.8} />
                        </button>
                      </div>
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

        /* Barrido de escáner sobre la imagen mientras procesa */
        @keyframes ocr-scan-anim {
          0% { transform: translateY(-20%); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(120%); opacity: 0; }
        }
        .ocr-scanline {
          position: absolute;
          left: -2%;
          right: -2%;
          top: 0;
          height: 22%;
          background: linear-gradient(
            to bottom,
            transparent 0%,
            color-mix(in srgb, var(--accent) 35%, transparent) 30%,
            color-mix(in srgb, var(--accent) 75%, transparent) 50%,
            color-mix(in srgb, var(--accent) 35%, transparent) 70%,
            transparent 100%
          );
          filter: blur(2px);
          mix-blend-mode: screen;
          animation: ocr-scan-anim 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          pointer-events: none;
        }

        /* Cuadrícula tenue sobre la imagen para efecto "analizando" */
        @keyframes ocr-grid-anim {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.5; }
        }
        .ocr-grid-overlay {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(to right, color-mix(in srgb, var(--accent) 22%, transparent) 1px, transparent 1px),
            linear-gradient(to bottom, color-mix(in srgb, var(--accent) 22%, transparent) 1px, transparent 1px);
          background-size: 18px 18px;
          mix-blend-mode: overlay;
          animation: ocr-grid-anim 2.4s ease-in-out infinite;
          pointer-events: none;
        }

        /* Punto pulsante junto al texto de fase */
        @keyframes ocr-dot-anim {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.4); opacity: 1; }
        }
        .ocr-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
          flex-shrink: 0;
          animation: ocr-dot-anim 0.9s ease-in-out infinite;
        }

        /* Reveal del resultado extraído (entrada suave con stagger) */
        @keyframes ocr-reveal-anim {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ocr-reveal {
          animation: ocr-reveal-anim 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .ocr-reveal > * {
          animation: ocr-reveal-anim 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .ocr-reveal > *:nth-child(2) { animation-delay: 0.08s; }
        .ocr-reveal > *:nth-child(3) { animation-delay: 0.16s; }

        /* Glow del tile mientras procesa */
        .ocr-tile[data-state="uploading"] {
          animation: ocr-tile-glow 1.8s ease-in-out infinite;
        }
        @keyframes ocr-tile-glow {
          0%, 100% { box-shadow: 0 8px 26px -16px color-mix(in srgb, var(--accent) 40%, transparent); }
          50% { box-shadow: 0 12px 36px -16px color-mix(in srgb, var(--accent) 80%, transparent); }
        }

        @media (prefers-reduced-motion: reduce) {
          .ocr-scanline, .ocr-grid-overlay, .ocr-shimmer, .ocr-dot { animation: none; display: none; }
          .ocr-reveal, .ocr-reveal > * { animation: none; }
          .ocr-tile[data-state="uploading"] { animation: none; }
        }
      `}</style>

      {/* Modal de previsualización del archivo (pequeño, integrado) */}
      {previewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewUrl(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
            display: "grid", placeItems: "center", padding: 16, zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(560px, 100%)",
              maxHeight: "82vh",
              background: "var(--card, #fff)",
              borderRadius: 12,
              border: "1px solid color-mix(in srgb, currentColor 14%, transparent)",
              padding: 12,
              display: "grid",
              gap: 8,
              boxShadow: "0 20px 50px -10px rgba(0,0,0,0.40)",
            }}
          >
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <strong style={{ fontSize: 13 }}>Vista previa</strong>
              <div style={{ display: "flex", gap: 6 }}>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button ghost compact"
                  style={{ fontSize: 11 }}
                >
                  Abrir grande
                </a>
                <button
                  onClick={() => setPreviewUrl(null)}
                  aria-label="Cerrar"
                  className="icon-btn"
                  style={{ width: 28, height: 28 }}
                >
                  <X size={14} />
                </button>
              </div>
            </header>
            <div style={{ overflow: "auto", maxHeight: "74vh", background: "color-mix(in srgb, currentColor 4%, transparent)", borderRadius: 8 }}>
              {previewMime?.startsWith("image/") || (!previewMime && /\.(png|jpe?g|webp|heic)$/i.test(previewUrl)) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Factura" style={{ display: "block", width: "100%", height: "auto" }} />
              ) : (
                <iframe
                  src={previewUrl}
                  title="Vista previa"
                  style={{ width: "100%", height: "70vh", border: 0, display: "block" }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
