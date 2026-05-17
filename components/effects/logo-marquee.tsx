"use client";

/**
 * Marquee infinito de logos / nombres de clientes ficticios.
 * Doble copia para que el loop sea sin saltos.
 */
const LOGOS = [
  "Gabinete Sánchez",
  "Cloudly Workspace",
  "Innova Apps",
  "Reditorial",
  "Singular Bank",
  "Globant ES",
  "Sastrería Pons",
  "Despacho Marín",
  "Asesoría Mediterránea",
  "Berriak Consultores",
  "Albea & Asociados",
  "Vector Fiscal",
];

export function LogoMarquee() {
  return (
    <div className="lm-wrap" aria-hidden="true">
      <div className="lm-track">
        {[...LOGOS, ...LOGOS].map((name, i) => (
          <span key={i} className="lm-item">
            <span className="lm-dot" />
            {name}
          </span>
        ))}
      </div>
      <style jsx global>{`
        .lm-wrap {
          width: 100%;
          overflow: hidden;
          mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent);
          padding: 18px 0;
        }
        .lm-track {
          display: flex;
          gap: 56px;
          width: max-content;
          animation: lm-scroll 40s linear infinite;
        }
        .lm-item {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 600;
          color: var(--muted);
          font-family: var(--mono);
          letter-spacing: -0.01em;
          opacity: 0.65;
          transition: opacity 0.2s, color 0.2s;
        }
        .lm-item:hover { opacity: 1; color: var(--ink); }
        .lm-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
          flex-shrink: 0;
        }
        @keyframes lm-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .lm-track { animation: none; }
        }
      `}</style>
    </div>
  );
}
