"use client";

import { useEffect, useRef, useState } from "react";

const ROWS = [
  { casilla: "01", label: "Base 4 %", value: "€ 0,00", delay: 0 },
  { casilla: "04", label: "Base 10 %", value: "€ 1.240,00", delay: 240 },
  { casilla: "07", label: "Base 21 %", value: "€ 18.620,00", delay: 480 },
  { casilla: "09", label: "Cuota IVA repercutido", value: "€ 4.034,20", delay: 720, accent: true },
  { casilla: "28", label: "Soportado operaciones interiores", value: "€ 1.722,40", delay: 960 },
  { casilla: "30", label: "Soportado bienes de inversión", value: "€ 168,00", delay: 1200 },
  { casilla: "45", label: "Total a deducir", value: "€ 1.890,40", delay: 1440 },
  { casilla: "64", label: "RESULTADO · A INGRESAR", value: "€ 2.143,80", delay: 1700, big: true },
];

export function LiveDemoModelo() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setTick((tick + 1) % 4), 5000);
    return () => clearTimeout(t);
  }, [active, tick]);

  return (
    <div ref={ref} className="live-demo modelo-demo" aria-hidden="true" key={tick}>
      <div className="demo-window">
        <div className="demo-chrome">
          <span className="dot red" />
          <span className="dot amber" />
          <span className="dot green" />
          <span className="demo-url">nexus.app/aeat/303</span>
          <span className="demo-live"><span className="pulse-dot" /> calculando</span>
        </div>
        <div className="modelo-head">
          <div>
            <span className="demo-eyebrow">Modelo 303 · IVA 2T 2026</span>
            <strong className="demo-title">Innova Apps S.L. · A82018474</strong>
          </div>
          <span className="demo-status good">● Validado AEAT</span>
        </div>

        <div className="modelo-rows">
          {ROWS.map((r, i) => (
            <div
              key={r.casilla}
              className={`modelo-row reveal ${r.accent ? "accent" : ""} ${r.big ? "big" : ""}`}
              style={{ animationDelay: `${r.delay}ms` }}
            >
              <span className="casilla">{r.casilla}</span>
              <span>{r.label}</span>
              <span className="value">{r.value}</span>
              <span className="check" style={{ animationDelay: `${r.delay + 200}ms` }}>✓</span>
            </div>
          ))}
        </div>

        <div className="modelo-actions reveal" style={{ animationDelay: "2000ms" }}>
          <span className="demo-muted">Generado en 7,2 s · auditoría: trazas guardadas</span>
          <div style={{ display: "flex", gap: 8 }}>
            <span className="demo-pill">📄 PDF</span>
            <span className="demo-pill">📁 Fichero AEAT</span>
            <span className="demo-pill accent">↵ Presentar</span>
          </div>
        </div>
      </div>
    </div>
  );
}
