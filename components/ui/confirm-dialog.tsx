"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AlertTriangle, X, Check } from "lucide-react";

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "warn" | "info";
};

type Ctx = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<Ctx>({ confirm: async () => false });

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((res) => {
      resolverRef.current = res;
    });
  }, []);

  function close(result: boolean) {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOpts(null);
  }

  const tone = opts?.tone ?? "danger";
  const toneColor = tone === "danger" ? "#ef4444" : tone === "warn" ? "#f59e0b" : "#6366f1";

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {opts && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => close(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
            display: "grid", placeItems: "center", zIndex: 10000, padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") close(true);
              if (e.key === "Escape") close(false);
            }}
            tabIndex={-1}
            ref={(el) => el?.focus()}
            style={{
              width: "min(440px, 100%)", background: "var(--card, #fff)",
              borderRadius: 14, border: "1px solid color-mix(in srgb, currentColor 14%, transparent)",
              padding: 18, display: "grid", gap: 12,
              boxShadow: "0 20px 60px -10px rgba(0,0,0,0.45)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: `color-mix(in srgb, ${toneColor} 14%, transparent)`,
                color: toneColor,
                display: "grid", placeItems: "center", flexShrink: 0,
              }}>
                <AlertTriangle size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: 15 }}>{opts.title}</strong>
                {opts.message && <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.8, lineHeight: 1.45 }}>{opts.message}</p>}
              </div>
              <button onClick={() => close(false)} aria-label="Cerrar" style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", padding: 4 }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => close(false)} className="button ghost compact">
                {opts.cancelLabel ?? "Cancelar"}
              </button>
              <button
                onClick={() => close(true)}
                style={{
                  padding: "8px 14px", borderRadius: 8, border: "none",
                  background: toneColor, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                <Check size={13} /> {opts.confirmLabel ?? "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
