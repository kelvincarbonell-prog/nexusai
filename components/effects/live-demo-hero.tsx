"use client";

import { useEffect, useRef, useState } from "react";

type Phase =
  | "idle"
  | "email"
  | "extracting"
  | "extracted"
  | "categorizing"
  | "posted"
  | "iva";

const PHASE_DURATIONS: Record<Phase, number> = {
  idle: 600,
  email: 1400,
  extracting: 1600,
  extracted: 2200,
  categorizing: 1600,
  posted: 2000,
  iva: 2400,
};

const NEXT: Record<Phase, Phase> = {
  idle: "email",
  email: "extracting",
  extracting: "extracted",
  extracted: "categorizing",
  categorizing: "posted",
  posted: "iva",
  iva: "idle",
};

export function LiveDemoHero() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return;
    const timeout = setTimeout(() => setPhase(NEXT[phase]), PHASE_DURATIONS[phase]);
    return () => clearTimeout(timeout);
  }, [phase, active]);

  const after = (p: Phase) => phaseRank(phase) >= phaseRank(p);

  return (
    <div ref={ref} className="live-demo hero-demo" aria-hidden="true">
      <div className="demo-window">
        <div className="demo-chrome">
          <span className="dot red" />
          <span className="dot amber" />
          <span className="dot green" />
          <span className="demo-url">m26.app/innova-apps</span>
          <span className="demo-live"><span className="pulse-dot" /> en vivo</span>
        </div>

        <div className="demo-body">
          <div className="demo-side">
            <div className="demo-side-row">
              <span className="demo-side-dot accent" />
              <strong>Innova Apps</strong>
            </div>
            <div className="demo-side-row muted"><span className="demo-side-dot" />Reditorial</div>
            <div className="demo-side-row muted"><span className="demo-side-dot" />J. Romero</div>
            <div className="demo-side-row muted"><span className="demo-side-dot" />Vertical Studio</div>
            <div className="demo-side-row muted"><span className="demo-side-dot warn" />Sastrería Pons</div>
          </div>

          <div className="demo-main">
            <div className="demo-main-head">
              <div>
                <span className="demo-eyebrow">Innova Apps · IVA 2T</span>
                <strong className="demo-title">Bandeja de entrada</strong>
              </div>
              <span className={`demo-status ${after("posted") ? "good" : after("extracting") ? "warn" : ""}`}>
                ● {after("posted") ? "Contabilizado" : after("email") ? "Procesando" : "Esperando"}
              </span>
            </div>

            <div className={`demo-card email ${after("email") ? "show" : ""}`}>
              <div className="demo-row">
                <span className="demo-pill">📧 Email</span>
                <span className="demo-muted">facturas-9k2x@inbox.m26.app</span>
              </div>
              <strong>Telefónica España S.A.U. — Factura marzo</strong>
              <span className="demo-muted">Adjunto · TF-2603419.pdf · 84 KB</span>
            </div>

            <div className={`demo-card extract ${after("extracting") ? "show" : ""}`}>
              <div className="demo-row">
                <span className="demo-pill accent">
                  {after("extracted") ? "✓ Extraído" : <><span className="spinner" /> Extrayendo…</>}
                </span>
                <span className="demo-muted">GPT-4o · vision</span>
              </div>
              <div className="demo-fields">
                <Field label="Proveedor" value="Telefónica España S.A.U." show={after("extracting")} delay={0} />
                <Field label="NIF" value="A82018474" show={after("extracting")} delay={200} />
                <Field label="Nº factura" value="TF-2603419" show={after("extracting")} delay={400} />
                <Field label="Fecha" value="03·03·2026" show={after("extracting")} delay={600} />
                <Field label="Base" value="€ 128,93" show={after("extracted")} delay={0} />
                <Field label="IVA 21%" value="€ 27,07" show={after("extracted")} delay={200} mark />
                <Field label="Total" value="€ 156,00" show={after("extracted")} delay={400} strong />
              </div>
            </div>

            <div className={`demo-card categorize ${after("categorizing") ? "show" : ""}`}>
              <div className="demo-row">
                <span className="demo-pill accent">
                  {after("posted") ? "✓ Asignado" : <><span className="spinner" /> Categorizando…</>}
                </span>
                <span className="demo-muted">basado en historial · 12 facturas previas</span>
              </div>
              <div className="demo-account">
                <span className="demo-code">629</span>
                <div>
                  <strong>Comunicaciones</strong>
                  <span className="demo-muted">cuenta PGC · 99 % confianza</span>
                </div>
                {after("posted") ? <span className="demo-check">✓</span> : null}
              </div>
            </div>

            <div className={`demo-toast ${after("iva") ? "show" : ""}`}>
              <span className="pulse-dot" />
              <strong>IVA 2T actualizado</strong>
              <span className="demo-muted">+€27,07 soportado · ahorra €5,68 a Innova</span>
            </div>
          </div>
        </div>
      </div>

      <div className="demo-caption">
        <span className="pulse-dot" /> Demo en vivo · proceso real de M26
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  show,
  delay,
  mark,
  strong,
}: {
  label: string;
  value: string;
  show: boolean;
  delay: number;
  mark?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={`demo-field ${show ? "show" : ""} ${mark ? "mark" : ""} ${strong ? "strong" : ""}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <span className="demo-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function phaseRank(p: Phase): number {
  return ["idle", "email", "extracting", "extracted", "categorizing", "posted", "iva"].indexOf(p);
}
