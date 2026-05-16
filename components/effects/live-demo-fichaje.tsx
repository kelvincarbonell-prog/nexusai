"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  { label: "Detectada factura vencida hace 32 días", duration: 1200 },
  { label: "Redactando email personalizado con IA…", duration: 1800 },
  { label: "Generando enlace de pago Stripe", duration: 1400 },
  { label: "Enviado a Daniel · contabilidad@singular", duration: 1800 },
  { label: "✓ Cliente abrió el email · clic en pagar", duration: 2200 },
  { label: "💰 Cobrado · 3.180 € · conciliado al instante", duration: 2400 },
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

  const sent = step >= 3;
  const paid = step >= 5;

  return (
    <div ref={ref} className="live-demo fichaje-demo" aria-hidden="true">
      <div className="demo-window phone narrow">
        <div className="demo-phone-bar">
          <span>14:08</span>
          <span className="demo-muted">●●●● 5G</span>
        </div>

        <div className="fichaje-body">
          <span className="demo-eyebrow">Agente · cobros automáticos</span>
          <strong className="demo-title">Factura #0228 vencida</strong>

          <div className="fichaje-clock" style={{ fontSize: 36 }}>
            3.180 €
            <small style={{ color: paid ? "var(--good)" : "var(--bad)" }}>
              {paid ? "cobrada hoy" : "32 días vencida"}
            </small>
          </div>

          <div className="fichaje-buttons">
            <button className={`fichaje-btn entrada ${sent ? "done" : "active"}`} disabled>
              <span className="check">{sent ? "✓" : "→"}</span>
              <span>Recordar {sent ? "· enviado" : ""}</span>
            </button>
            <button className={`fichaje-btn salida ${paid ? "done" : sent ? "active" : ""}`} disabled>
              <span className="check">{paid ? "✓" : "—"}</span>
              <span>Cobrar {paid ? "· OK" : ""}</span>
            </button>
          </div>

          <div className="fichaje-step">
            <span className="pulse-dot" />
            {STEPS[step].label}
          </div>

          <div className={`fichaje-toast ${paid ? "show" : ""}`}>
            <strong>✓ €3.180 conciliados</strong>
            <span className="demo-muted">BBVA → factura #0228 · sin tocar nada</span>
          </div>
        </div>
      </div>
    </div>
  );
}
