"use client";

import { useEffect, useState } from "react";

/**
 * Escribe un texto base y luego rota palabras al final como una "máquina de escribir".
 * Ejemplo: "Tecnología " + rotate(["fiscal", "laboral", "contable", "IA"])
 */
export function TypingHeadline({
  base,
  words,
  className,
  style,
}: {
  base: string;
  words: string[];
  className?: string;
  style?: React.CSSProperties;
}) {
  const [wordIdx, setWordIdx] = useState(0);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"typing" | "pausing" | "deleting">("typing");

  useEffect(() => {
    const current = words[wordIdx % words.length];
    let delay = 80;
    if (phase === "typing") {
      if (text.length < current.length) {
        delay = 80 + Math.random() * 40;
        const t = setTimeout(() => setText(current.slice(0, text.length + 1)), delay);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase("pausing"), 1400);
      return () => clearTimeout(t);
    }
    if (phase === "pausing") {
      const t = setTimeout(() => setPhase("deleting"), 600);
      return () => clearTimeout(t);
    }
    if (phase === "deleting") {
      if (text.length > 0) {
        const t = setTimeout(() => setText(text.slice(0, -1)), 40);
        return () => clearTimeout(t);
      }
      setWordIdx((i) => (i + 1) % words.length);
      setPhase("typing");
    }
  }, [text, phase, wordIdx, words]);

  return (
    <span className={className} style={style}>
      {base}
      <span className="th-rotating">{text}</span>
      <span className="th-cursor" aria-hidden="true">|</span>
      <style jsx global>{`
        .th-rotating {
          color: var(--accent);
        }
        .th-cursor {
          display: inline-block;
          margin-left: 2px;
          font-weight: 100;
          color: var(--accent);
          animation: th-blink 1s steps(2) infinite;
        }
        @keyframes th-blink {
          50% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .th-cursor { animation: none; }
        }
      `}</style>
    </span>
  );
}
