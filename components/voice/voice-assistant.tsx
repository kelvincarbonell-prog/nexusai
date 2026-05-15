"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type SpeechRecognitionEvent = { results: { [index: number]: { [index: number]: { transcript: string } } } & { length: number } };
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type WindowWithSR = Window & {
  SpeechRecognition?: { new (): SpeechRecognitionInstance };
  webkitSpeechRecognition?: { new (): SpeechRecognitionInstance };
};

export function VoiceAssistant({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as WindowWithSR;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setSupported(true);
    const r = new Ctor();
    r.lang = "es-ES";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? "";
      setTranscript(text);
      askM26(text);
    };
    r.onerror = (event) => {
      setError(event.error);
      setListening(false);
    };
    r.onend = () => setListening(false);
    recognitionRef.current = r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function askM26(query: string) {
    if (!empresaId) {
      setError("Selecciona una empresa antes de preguntar.");
      return;
    }
    setThinking(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const tk = session.session?.access_token ?? "";
      const res = await fetch("/api/voice/query", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId, query }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setResponse(json.response);
      speak(json.response);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setThinking(false);
    }
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "es-ES";
    utter.rate = 1.05;
    window.speechSynthesis.speak(utter);
  }

  function toggle() {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      setTranscript("");
      setResponse("");
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch {
        // already started
      }
    }
  }

  return (
    <div className="card" style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <span className="eyebrow">Asistente de voz</span>
          <h3 style={{ margin: "4px 0 0" }}>Pregúntale a M26</h3>
        </div>
        <button className="button" onClick={toggle} disabled={!supported || thinking} aria-pressed={listening}>
          {listening ? "Escuchando…" : thinking ? "Pensando…" : "🎤 Hablar"}
        </button>
      </div>
      {!supported ? <p className="muted">Tu navegador no soporta reconocimiento de voz. Prueba con Chrome o Safari en móvil.</p> : null}
      {transcript ? <p><strong>Tú:</strong> {transcript}</p> : null}
      {response ? <p><strong>M26:</strong> {response}</p> : null}
      {error ? <p role="alert" style={{ color: "var(--danger)" }}>{error}</p> : null}
      <details>
        <summary className="muted">Ejemplos</summary>
        <ul>
          <li>«¿Cuánto IVA llevo este trimestre?»</li>
          <li>«Facturas pendientes»</li>
          <li>«Gastos en transporte este mes»</li>
          <li>«Trabajadores activos»</li>
          <li>«Fichajes abiertos hoy»</li>
        </ul>
      </details>
    </div>
  );
}
