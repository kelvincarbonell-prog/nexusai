"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  { label: "Abriendo Nexus móvil", duration: 900 },
  { label: "Fichaje entrada", duration: 1100 },
  { label: "Jornada en curso · 8 h 14 m", duration: 2400 },
  { label: "Fichaje salida · firma con Cl@ve", duration: 1800 },
  { label: "Registrado en libro de horas · listo para AEAT", duration: 1800 },
];

export function LiveDemoFichaje() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setStep((step + 1) % STEPS.length), STEPS[step].duration);
    return () => clearTimeout(t);
  }, [step, active]);

  const entradaDone = step >= 1;
  const salidaDone = step >= 3;

  return (
    <div ref={ref} className="live-demo fichaje-demo" aria-hidden="true">
      <div className="demo-window phone narrow">
        <div className="demo-phone-bar">
          <span>09:02</span>
          <span className="demo-muted">●●●● 5G</span>
        </div>

        <div className="fichaje-body">
          <span className="demo-eyebrow">Innova Apps · móvil</span>
          <strong className="demo-title">Fichaje del día</strong>

          <div className="fichaje-clock">
            {step <= 1 ? "09:02" : step === 2 ? "13:48" : step === 3 ? "18:01" : "18:01"}
            <small>{step <= 1 ? "lunes" : step === 2 ? "en curso" : "cerrada"}</small>
          </div>

          <div className="fichaje-buttons">
            <button className={`fichaje-btn entrada ${entradaDone ? "done" : "active"}`}>
              <span className="check">{entradaDone ? "✓" : "→"}</span>
              <span>Entrada {entradaDone ? "· 09:02" : ""}</span>
            </button>
            <button className={`fichaje-btn salida ${salidaDone ? "done" : entradaDone ? "active" : ""}`} disabled={!entradaDone}>
              <span className="check">{salidaDone ? "✓" : "—"}</span>
              <span>Salida {salidaDone ? "· 18:01" : ""}</span>
            </button>
          </div>

          <div className="fichaje-step">
            <span className="pulse-dot" />
            {STEPS[step].label}
          </div>

          <div className={`fichaje-toast ${step === 4 ? "show" : ""}`}>
            <strong>✓ Jornada registrada</strong>
            <span className="demo-muted">RD 8/2019 cumplido · 8 h 59 m</span>
          </div>
        </div>
      </div>
    </div>
  );
}
