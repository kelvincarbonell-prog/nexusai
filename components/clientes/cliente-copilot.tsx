"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Empresa = {
  id: string;
  nombre: string;
  nif: string | null;
  account_type: string | null;
};

type Sugerencia = {
  eyebrow: string;
  tone: "accent" | "warn" | "bad" | "good";
  title: string;
  body: string;
  actions?: { label: string; href?: string; primary?: boolean }[];
};

function loadCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("m26.copilot.collapsed") === "1";
}

function saveCollapsed(v: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("m26.copilot.collapsed", v ? "1" : "0");
}

export function ClienteCopilot({ empresa }: { empresa: Empresa }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(loadCollapsed());
  }, []);

  function toggle() {
    setCollapsed((v) => {
      saveCollapsed(!v);
      return !v;
    });
  }

  const sugerencias: Sugerencia[] = [
    {
      eyebrow: "OCR · subir factura",
      tone: "accent",
      title: "Procesa tus facturas con IA",
      body: "Arrastra una factura PDF o foto en la pestaña «Subir factura». La IA extrae proveedor, NIF, base, IVA y total en segundos.",
      actions: [{ label: "Ir a OCR", primary: true }],
    },
    {
      eyebrow: "Modelos AEAT",
      tone: "warn",
      title: "Calcula el IVA del trimestre",
      body: "En «IVA y modelos» tienes el 303, 111, 115, 130 y todos los anuales. M26 calcula y guarda borradores.",
    },
    {
      eyebrow: "Laboral",
      tone: "good",
      title: "Nóminas, finiquitos, M-145",
      body: "Crea trabajadores y descarga el Modelo 145 firmado, finiquito y bonificaciones SS con un clic.",
    },
  ];

  if (collapsed) {
    return (
      <button
        onClick={toggle}
        aria-label="Mostrar copilot"
        title="Mostrar copilot"
        style={{
          position: "fixed",
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: 32,
          height: 80,
          borderRadius: "10px 0 0 10px",
          border: "1px solid var(--line)",
          borderRight: 0,
          background: "var(--bg-soft, var(--bg, white))",
          color: "var(--ink)",
          cursor: "pointer",
          zIndex: 50,
          display: "grid",
          placeItems: "center",
          fontSize: 18,
          boxShadow: "0 6px 24px -16px var(--accent-glow)",
        }}
      >
        <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    );
  }

  return (
    <aside
      aria-label={`Copilot · ${empresa.nombre}`}
      style={{
        position: "fixed",
        right: 16,
        top: 80,
        bottom: 16,
        width: 340,
        maxWidth: "92vw",
        zIndex: 50,
        background: "var(--bg-soft, var(--bg, white))",
        border: "1px solid var(--line)",
        borderRadius: 14,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflowY: "auto",
        boxShadow: "0 18px 60px -24px rgba(0,0,0,0.45)",
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div>
          <span className="card-eyebrow">Copilot M26</span>
          <div className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11, marginTop: 2 }}>
            {empresa.nombre}
          </div>
        </div>
        <button
          className="button ghost compact"
          onClick={toggle}
          aria-label="Minimizar copilot"
          title="Minimizar"
          style={{ padding: "4px 8px", display: "inline-flex", alignItems: "center" }}
        >
          <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </header>

      {sugerencias.map((s, i) => (
        <article key={i} className="copilot-card" style={{ background: "color-mix(in srgb, var(--accent) 6%, transparent)" }}>
          <span className={`card-eyebrow ${s.tone === "bad" ? "bad" : s.tone === "warn" ? "warn" : ""}`}>{s.eyebrow}</span>
          <strong style={{ display: "block", marginTop: 4, fontSize: 14 }}>{s.title}</strong>
          <p style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}>{s.body}</p>
        </article>
      ))}

      <article className="copilot-card">
        <span className="card-eyebrow">Pregunta a M26</span>
        <input
          className="input"
          placeholder="¿Cuánto debo en IVA este trimestre?"
          style={{ marginTop: 8, fontSize: 13 }}
          disabled
        />
        <small className="muted" style={{ fontSize: 11, marginTop: 6, display: "block" }}>
          La consulta natural está disponible desde la cabecera ⌘K.
        </small>
      </article>
    </aside>
  );
}
