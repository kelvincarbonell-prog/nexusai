"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Revela un texto letra a letra cuando entra en el viewport (scroll-triggered).
 * Divide automáticamente el children por caracteres, respetando espacios y palabras.
 */
export function LetterReveal({
  children,
  as: Tag = "h2",
  className,
  style,
  delayStep = 28,
}: {
  children: string;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  delayStep?: number;
}) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.lr = "in";
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Component = Tag as React.ElementType;
  const text = String(children);
  const words = text.split(" ");

  // Render: cada palabra es un span inline-block (para no romper), entre
  // palabras un text-node de espacio real (no inline-block) para que el
  // navegador respete los espacios.
  const pieces: ReactNode[] = [];
  let charIdx = 0;
  words.forEach((word, wi) => {
    pieces.push(
      <span key={`w-${wi}`} className="lr-word">
        {[...word].map((ch, ci) => {
          const delay = charIdx * delayStep;
          charIdx++;
          return (
            <span key={ci} className="lr-char" style={{ transitionDelay: `${delay}ms` }}>
              {ch}
            </span>
          );
        })}
      </span>,
    );
    if (wi < words.length - 1) {
      pieces.push(<span key={`s-${wi}`}>{" "}</span>);
      charIdx++; // contar el espacio para que el siguiente char tenga el delay correcto
    }
  });

  return (
    <Component ref={ref as never} className={`lr-text ${className ?? ""}`} data-lr="out" style={style}>
      {pieces}
      <style jsx global>{`
        .lr-text { overflow: hidden; word-spacing: normal; }
        .lr-word { display: inline-block; white-space: nowrap; }
        .lr-char {
          display: inline-block;
          opacity: 0;
          transform: translateY(0.6em);
          transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lr-text[data-lr="in"] .lr-char {
          opacity: 1;
          transform: translateY(0);
        }
        @media (prefers-reduced-motion: reduce) {
          .lr-char { opacity: 1; transform: none; transition: none; }
        }
      `}</style>
    </Component>
  );
}
