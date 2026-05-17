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
      <div className="lm-row">
        {LOGOS.map((name, i) => (
          <span key={i} className="lm-item">
            <span className="lm-dot" />
            {name}
          </span>
        ))}
      </div>
      <style jsx global>{`
        .lm-wrap {
          width: 100%;
          padding: 14px 0;
          mask-image: linear-gradient(90deg, transparent, black 6%, black 94%, transparent);
        }
        .lm-row {
          display: flex;
          flex-wrap: wrap;
          gap: 32px 44px;
          justify-content: center;
          align-items: center;
        }
        .lm-item {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 600;
          color: var(--muted);
          font-family: var(--mono);
          letter-spacing: -0.01em;
          opacity: 0.65;
          transition: opacity 0.2s, color 0.2s;
          white-space: nowrap;
        }
        .lm-item:hover { opacity: 1; color: var(--ink); }
        .lm-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--accent);
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
