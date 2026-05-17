"use client";

import { type ReactNode } from "react";
import { Check } from "lucide-react";

export type Step = { key: string; label: string; icon?: ReactNode };

export function WelcomeShell({
  eyebrow,
  title,
  subtitle,
  steps,
  currentStep,
  children,
  footer,
  accent = "var(--accent)",
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  steps: Step[];
  currentStep: number;
  children: ReactNode;
  footer?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="welcome-bg">
      <div className="welcome-aurora" aria-hidden="true" />

      <main className="welcome-main">
        <header className="welcome-header">
          <span className="welcome-eyebrow">{eyebrow}</span>
          <h1 className="welcome-title">{title}</h1>
          {subtitle ? <p className="welcome-subtitle">{subtitle}</p> : null}
        </header>

        {/* Stepper */}
        <nav className="welcome-stepper" aria-label="Pasos del onboarding">
          {steps.map((s, i) => {
            const done = i < currentStep;
            const active = i === currentStep;
            return (
              <div key={s.key} className="welcome-step" data-state={done ? "done" : active ? "active" : "pending"}>
                <div
                  className="welcome-step-circle"
                  style={{
                    background: done ? "var(--good)" : active ? accent : "color-mix(in srgb, var(--line) 70%, transparent)",
                    color: done || active ? "white" : "var(--muted)",
                  }}
                >
                  {done ? <Check size={14} strokeWidth={3} /> : s.icon ?? <span style={{ fontSize: 11, fontWeight: 700 }}>{i + 1}</span>}
                </div>
                <span className="welcome-step-label">{s.label}</span>
                {i < steps.length - 1 ? <span className="welcome-step-divider" /> : null}
              </div>
            );
          })}
        </nav>

        <article className="welcome-card">{children}</article>

        {footer ? <div className="welcome-footer">{footer}</div> : null}
      </main>

      <style jsx global>{`
        .welcome-bg {
          min-height: 100vh;
          padding: 32px 20px;
          display: grid;
          place-items: start center;
          background: var(--bg);
          position: relative;
          overflow: hidden;
        }
        .welcome-aurora {
          position: absolute;
          inset: -10%;
          background:
            radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--accent) 22%, transparent) 0%, transparent 45%),
            radial-gradient(circle at 80% 80%, color-mix(in srgb, var(--good) 18%, transparent) 0%, transparent 50%);
          filter: blur(60px);
          opacity: 0.7;
          pointer-events: none;
          animation: welcome-float 16s ease-in-out infinite;
        }
        @keyframes welcome-float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-20px, 30px); }
        }
        .welcome-main {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 720px;
          display: grid;
          gap: 20px;
        }
        .welcome-header {
          text-align: center;
        }
        .welcome-eyebrow {
          display: inline-block;
          font-size: 11px;
          font-family: var(--mono);
          color: var(--accent);
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .welcome-title {
          font-size: clamp(22px, 4vw, 30px);
          margin: 0;
          line-height: 1.2;
        }
        .welcome-subtitle {
          font-size: 14px;
          color: var(--muted);
          margin: 8px 0 0;
          line-height: 1.5;
        }
        .welcome-stepper {
          display: flex;
          align-items: center;
          gap: 4px;
          justify-content: center;
          flex-wrap: wrap;
          padding: 16px 0;
        }
        .welcome-step {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .welcome-step-circle {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-weight: 700;
          transition: background 0.3s, transform 0.2s;
          flex-shrink: 0;
        }
        .welcome-step[data-state="active"] .welcome-step-circle {
          transform: scale(1.15);
          box-shadow: 0 4px 16px -4px color-mix(in srgb, var(--accent) 50%, transparent);
        }
        .welcome-step-label {
          font-size: 12px;
          color: var(--muted);
          font-weight: 500;
        }
        .welcome-step[data-state="active"] .welcome-step-label,
        .welcome-step[data-state="done"] .welcome-step-label {
          color: var(--ink);
          font-weight: 600;
        }
        .welcome-step-divider {
          width: 24px;
          height: 2px;
          background: color-mix(in srgb, var(--line) 70%, transparent);
          margin: 0 4px;
          border-radius: 1px;
        }
        .welcome-step[data-state="done"] + .welcome-step .welcome-step-divider {
          background: var(--good);
        }
        @media (max-width: 720px) {
          .welcome-step-label { display: none; }
        }
        .welcome-card {
          background: var(--bg-soft, var(--bg));
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 24px 60px -20px color-mix(in srgb, var(--accent) 25%, transparent);
        }
        .welcome-footer {
          text-align: center;
          font-size: 11px;
          color: var(--muted);
        }
        @media (prefers-reduced-motion: reduce) {
          .welcome-aurora { animation: none; }
        }
      `}</style>
    </div>
  );
}

/** Botón consistente con animación de carga */
export function WelcomeButton({
  children,
  onClick,
  loading,
  disabled,
  variant = "primary",
}: {
  children: ReactNode;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`button ${variant === "secondary" ? "secondary" : variant === "ghost" ? "ghost" : ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {children}
      {loading ? <span className="welcome-shimmer" aria-hidden="true" /> : null}
      <style jsx global>{`
        @keyframes welcome-shimmer-anim { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .welcome-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%);
          animation: welcome-shimmer-anim 1.4s linear infinite;
          pointer-events: none;
        }
      `}</style>
    </button>
  );
}

/** Hero card de éxito reusable */
export function WelcomeSuccess({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: ReactNode }) {
  return (
    <div style={{ textAlign: "center", display: "grid", gap: 14 }}>
      <div className="welcome-success-icon" aria-hidden="true">
        {icon ?? <Check size={42} strokeWidth={3} color="white" />}
      </div>
      <h2 style={{ fontSize: 22, margin: 0 }}>{title}</h2>
      {subtitle ? <p className="muted" style={{ fontSize: 13, margin: 0 }}>{subtitle}</p> : null}
      <style jsx global>{`
        .welcome-success-icon {
          width: 78px;
          height: 78px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--good) 0%, color-mix(in srgb, var(--good) 60%, var(--accent)) 100%);
          display: grid;
          place-items: center;
          margin: 0 auto;
          box-shadow: 0 12px 30px -8px color-mix(in srgb, var(--good) 50%, transparent);
          animation: welcome-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes welcome-pop {
          0% { transform: scale(0); opacity: 0; }
          70% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .welcome-success-icon { animation: none; }
        }
      `}</style>
    </div>
  );
}
