"use client";

import { useEffect, useRef, useState } from "react";

const SCRIPT = [
  { who: "user", text: "Nexus, ¿cuánto IVA llevo este trimestre?", duration: 1800 },
  { who: "thinking", text: "Consultando facturas y libros IVA…", duration: 1400 },
  { who: "nexus", text: "Repercutido 4.230 €. Soportado 1.890 €. A pagar 2.340 € · vence 20 julio.", duration: 3600 },
  { who: "user", text: "Recuérdame avisar 3 días antes.", duration: 1800 },
  { who: "nexus", text: "Hecho. Te aviso el 17 de julio.", duration: 2200 },
];

export function LiveDemoVoice() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [step, setStep] = useState(-1);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;
    if (step === -1) {
      const t = setTimeout(() => setStep(0), 400);
      return () => clearTimeout(t);
    }
    if (step >= SCRIPT.length) {
      const t = setTimeout(() => setStep(-1), 1200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep(step + 1), SCRIPT[step].duration);
    return () => clearTimeout(t);
  }, [step, active]);

  return (
    <div ref={ref} className="live-demo voice-demo" aria-hidden="true">
      <div className="demo-window phone">
        <div className="demo-phone-bar">
          <span>20:14</span>
          <span className="demo-muted">●●●● 5G</span>
        </div>
        <div className="demo-voice-wrap">
          <span className="demo-eyebrow">Asistente de voz</span>
          <strong className="demo-title">«Hablar con Nexus»</strong>

          <div className={`mic ${step >= 0 && step <= 1 ? "listening" : step === 2 || step === 4 ? "speaking" : ""}`}>
            <svg viewBox="0 0 60 60" width="60" height="60">
              <circle className="mic-pulse" cx="30" cy="30" r="22" />
              <circle className="mic-pulse" cx="30" cy="30" r="22" style={{ animationDelay: "0.8s" }} />
              <circle cx="30" cy="30" r="18" fill="var(--accent)" />
              <path d="M30 22v8m0 0a4 4 0 0 1-4-4V20a4 4 0 1 1 8 0v6a4 4 0 0 1-4 4Zm-8 0a8 8 0 0 0 16 0" stroke="white" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            </svg>
          </div>

          <div className="waveform" data-active={step >= 0 && step < SCRIPT.length}>
            {Array.from({ length: 26 }).map((_, i) => (
              <span key={i} style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>

          <div className="conversation">
            {SCRIPT.slice(0, Math.max(0, step + 1)).map((line, i) => (
              <div key={i} className={`bubble ${line.who} ${i === step ? "current" : ""}`}>
                {line.who === "thinking" ? <span className="thinking-dots"><span /><span /><span /></span> : null}
                <span>{line.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
