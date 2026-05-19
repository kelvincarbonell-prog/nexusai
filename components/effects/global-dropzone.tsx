"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { UploadCloud, X, FileText, Loader2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Drop zone global: arrastrar y soltar archivos en cualquier parte de la
 * app autenticada activa el modo OCR. Se autodetecta la empresa actual
 * desde la URL (/clientes/[id] o ?empresa=...).
 *
 * Si no hay empresa en contexto, pide elegirla en el momento.
 */
export function GlobalDropzone() {
  const pathname = usePathname() ?? "";
  const supabase = useRef(createBrowserSupabase()).current;
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; status: "uploading" | "done" | "error"; msg?: string }[]>([]);
  const [empresaContext, setEmpresaContext] = useState<{ id: string; nombre: string } | null>(null);
  const [empresas, setEmpresas] = useState<Array<{ id: string; nombre: string }>>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const dragCounter = useRef(0);

  // Detecta empresa actual desde URL
  useEffect(() => {
    const match = pathname.match(/^\/clientes\/([0-9a-f-]{36})/i);
    if (match) {
      setEmpresaContext({ id: match[1], nombre: "" });
    } else if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const id = sp.get("empresa");
      if (id) setEmpresaContext({ id, nombre: "" });
      else setEmpresaContext(null);
    }
  }, [pathname]);

  // Listeners globales
  useEffect(() => {
    function isFile(e: DragEvent) {
      return e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
    }
    function onEnter(e: DragEvent) {
      if (!isFile(e)) return;
      e.preventDefault();
      dragCounter.current++;
      setDragging(true);
    }
    function onOver(e: DragEvent) {
      if (!isFile(e)) return;
      e.preventDefault();
    }
    function onLeave(e: DragEvent) {
      if (!isFile(e)) return;
      e.preventDefault();
      dragCounter.current = Math.max(0, dragCounter.current - 1);
      if (dragCounter.current === 0) setDragging(false);
    }
    function onDrop(e: DragEvent) {
      if (!isFile(e)) return;
      e.preventDefault();
      dragCounter.current = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length === 0) return;
      handleFiles(files);
    }
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  async function handleFiles(files: File[]) {
    let empresaId = empresaContext?.id;
    if (!empresaId) {
      // Pedir empresa
      if (empresas.length === 0) {
        const { data: sess } = await supabase.auth.getSession();
        const tk = sess.session?.access_token ?? "";
        const res = await fetch("/api/clientes", { headers: { Authorization: `Bearer ${tk}` } });
        const j = await res.json();
        if (j.ok) setEmpresas((j.items ?? []).slice(0, 100).map((e: { id: string; nombre: string }) => ({ id: e.id, nombre: e.nombre })));
      }
      setPickerOpen(true);
      // Almacenamos los archivos hasta que se elija
      pendingFilesRef.current = files;
      return;
    }
    await procesar(files, empresaId);
  }

  const pendingFilesRef = useRef<File[]>([]);

  async function procesar(files: File[], empresaId: string) {
    setUploading((arr) => [...arr, ...files.map((f) => ({ name: f.name, status: "uploading" as const }))]);
    const { data: sess } = await supabase.auth.getSession();
    const tk = sess.session?.access_token ?? "";
    for (const f of files) {
      try {
        const base64 = await fileToBase64(f);
        const res = await fetch("/api/agents/extract-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
          body: JSON.stringify({
            empresa_id: empresaId,
            source: "dropzone",
            filename: f.name,
            mime_type: f.type || "application/octet-stream",
            base64,
          }),
        });
        const j = await res.json();
        setUploading((arr) =>
          arr.map((u) =>
            u.name === f.name && u.status === "uploading"
              ? { name: f.name, status: j.ok ? "done" : "error", msg: j.error }
              : u,
          ),
        );
      } catch (err: unknown) {
        setUploading((arr) =>
          arr.map((u) => (u.name === f.name && u.status === "uploading" ? { name: f.name, status: "error", msg: err instanceof Error ? err.message : "Error" } : u)),
        );
      }
    }
    // Limpia después de 6s
    setTimeout(() => setUploading((arr) => arr.filter((u) => u.status === "uploading")), 6000);
  }

  async function fileToBase64(f: File): Promise<string> {
    return await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result ?? "").split(",")[1] ?? "");
      r.onerror = () => rej(r.error);
      r.readAsDataURL(f);
    });
  }

  return (
    <>
      {/* Overlay durante drag */}
      {dragging && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "color-mix(in srgb, var(--accent, #6366f1) 14%, rgba(0,0,0,0.45))",
            zIndex: 9998,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              padding: 30,
              borderRadius: 20,
              border: "2px dashed var(--accent, #6366f1)",
              background: "color-mix(in srgb, var(--bg) 90%, transparent)",
              textAlign: "center",
              maxWidth: 380,
            }}
          >
            <UploadCloud size={48} color="var(--accent, #6366f1)" />
            <h3 style={{ margin: "10px 0 4px", fontSize: 17 }}>Suelta para procesar con OCR</h3>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
              {empresaContext?.id
                ? "Se subirá al cliente actual"
                : "Te pediremos a qué cliente subir"}
            </p>
          </div>
        </div>
      )}

      {/* Toaster de uploads */}
      {uploading.length > 0 && (
        <div style={{ position: "fixed", right: 16, bottom: 90, zIndex: 9997, display: "grid", gap: 6, width: 280 }}>
          {uploading.map((u, i) => (
            <div
              key={`${u.name}-${i}`}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                background: u.status === "done" ? "#10b98112" : u.status === "error" ? "#ef444412" : "var(--panel, #fff)",
                border: `1px solid ${u.status === "done" ? "#10b98155" : u.status === "error" ? "#ef444455" : "color-mix(in srgb, currentColor 12%, transparent)"}`,
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                boxShadow: "0 6px 20px -6px rgba(0,0,0,0.25)",
              }}
            >
              {u.status === "uploading" ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} color={u.status === "done" ? "#10b981" : "#ef4444"} />}
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {u.name}
                {u.msg ? <span style={{ display: "block", fontSize: 10, opacity: 0.7 }}>{u.msg}</span> : null}
              </span>
              {u.status !== "uploading" && (
                <button onClick={() => setUploading((arr) => arr.filter((_, idx) => idx !== i))} style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", padding: 0 }}>
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Picker de empresa si no hay contexto */}
      {pickerOpen && (
        <div role="dialog" aria-modal="true" onClick={() => setPickerOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "grid", placeItems: "center", zIndex: 9999, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "min(420px, 100%)", background: "var(--panel, #fff)", borderRadius: 14, border: "1px solid color-mix(in srgb, currentColor 14%, transparent)", padding: 16, display: "grid", gap: 10 }}>
            <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <strong style={{ fontSize: 14 }}>¿A qué cliente lo subimos?</strong>
              <button onClick={() => setPickerOpen(false)} aria-label="Cerrar" style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit" }}><X size={14} /></button>
            </header>
            <div style={{ maxHeight: 360, overflow: "auto", display: "grid", gap: 4 }}>
              {empresas.length === 0 ? (
                <span style={{ fontSize: 12, opacity: 0.7 }}>Cargando lista de clientes…</span>
              ) : (
                empresas.map((e) => (
                  <button
                    key={e.id}
                    onClick={async () => {
                      setPickerOpen(false);
                      const files = pendingFilesRef.current;
                      pendingFilesRef.current = [];
                      await procesar(files, e.id);
                    }}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "color-mix(in srgb, currentColor 4%, transparent)",
                    }}
                  >
                    {e.nombre}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
