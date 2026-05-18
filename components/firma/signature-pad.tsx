"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Check, X } from "lucide-react";

/**
 * Pad de firma manuscrita: canvas con soporte ratón y táctil.
 * Devuelve la imagen PNG en base64 al firmar.
 *
 * Uso típico:
 *   <SignaturePad onConfirm={(base64) => fetch(...)} />
 */
export function SignaturePad({
  width = 480,
  height = 180,
  onConfirm,
  onCancel,
  cta = "Confirmar firma",
}: {
  width?: number;
  height?: number;
  onConfirm: (pngBase64: string) => void | Promise<void>;
  onCancel?: () => void;
  cta?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Pinta fondo blanco para que el PNG no sea transparente (más legible al firmar)
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#0a0612";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function pointer(e: PointerEvent | React.PointerEvent): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function down(e: React.PointerEvent) {
    const p = pointer(e);
    if (!p) return;
    drawing.current = true;
    last.current = p;
    setEmpty(false);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const p = pointer(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!p || !ctx || !last.current) return;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }

  function up() {
    drawing.current = false;
    last.current = null;
  }

  function limpiar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
  }

  async function confirmar() {
    const canvas = canvasRef.current;
    if (!canvas || empty) return;
    setConfirming(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const b64 = dataUrl.split(",")[1] ?? "";
      await onConfirm(b64);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8, maxWidth: width }}>
      <div
        style={{
          position: "relative",
          borderRadius: 10,
          border: "1px solid color-mix(in srgb, currentColor 20%, transparent)",
          background: "#fff",
          overflow: "hidden",
          touchAction: "none",
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          style={{ display: "block", width: "100%", height: "auto", cursor: "crosshair" }}
        />
        {empty && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", color: "#aaa", fontSize: 13 }}>
            Firma aquí con el dedo o el ratón
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={limpiar}
          className="button ghost compact"
          disabled={empty}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Eraser size={13} /> Borrar
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          {onCancel && (
            <button type="button" onClick={onCancel} className="button ghost compact" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <X size={13} /> Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={confirmar}
            className="button"
            disabled={empty || confirming}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Check size={13} /> {confirming ? "Guardando…" : cta}
          </button>
        </div>
      </div>
    </div>
  );
}
