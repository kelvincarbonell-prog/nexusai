"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Toast = {
  id: number;
  kind: "info" | "good" | "warn" | "bad";
  title: string;
  body?: string;
  duration?: number;
};

type ToastContextValue = {
  push: (toast: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastContextValue>({ push: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, toasts[0].duration ?? 4500);
    return () => clearTimeout(t);
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span className="toast-dot" />
            <div style={{ flex: 1 }}>
              <strong>{t.title}</strong>
              {t.body ? <div className="toast-body">{t.body}</div> : null}
            </div>
            <button className="button ghost compact" onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
