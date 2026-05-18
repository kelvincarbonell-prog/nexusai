"use client";

import { useEffect, useRef, useState } from "react";
import { Shield, ExternalLink, FileSignature, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * Botón "Firmar con certificado" usando MiniApplet @firma del Ministerio.
 *
 * Carga la librería oficial (autoscript.js) que abre Autofirma local
 * cuando el usuario tiene el certificado instalado en su equipo o
 * navegador. Funciona en Chrome/Firefox/Edge/Safari + Windows/Mac/Linux.
 *
 * Si el usuario no tiene Autofirma instalado, mostramos el link de descarga
 * oficial. La firma resultante es CAdES o XAdES según `formato`.
 */

declare global {
  interface Window {
    AutoScript?: {
      cargarAppAfirma: () => void;
      sign: (
        dataB64: string,
        algorithm: string,
        format: string,
        params: string | null,
        onSuccess: (signatureB64: string, certB64: string) => void,
        onError: (errorType: string, errorMessage: string) => void,
      ) => void;
    };
  }
}

type Props = {
  /** Datos en base64 a firmar (el TXT del modelo AEAT, o el XML SII, etc.). */
  contenidoBase64: string;
  /** Algoritmo de firma. */
  algoritmo?: "SHA256withRSA" | "SHA512withRSA";
  /** Formato de firma. */
  formato?: "CAdES" | "XAdES" | "PAdES";
  /** Endpoint donde POSTear el resultado firmado para persistir. */
  endpointPersistir?: string;
  /** Metadata extra para mandar al endpoint. */
  extra?: Record<string, unknown>;
  /** Texto del botón. */
  label?: string;
  /** Callback con el resultado de la firma. */
  onSigned?: (result: { signature_b64: string; certificate_b64: string }) => void;
};

export function AutofirmaButton({
  contenidoBase64,
  algoritmo = "SHA256withRSA",
  formato = "CAdES",
  endpointPersistir,
  extra,
  label = "Firmar con certificado",
  onSigned,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const triedRef = useRef(false);

  useEffect(() => {
    if (triedRef.current) return;
    triedRef.current = true;
    // Carga el autoscript de MiniApplet
    const s = document.createElement("script");
    s.src = "https://administracionelectronica.gob.es/ctt/resources/Soluciones/138/Descargas/MiniApplet/configuracion/autoscript.js";
    s.async = true;
    s.onload = () => {
      try {
        window.AutoScript?.cargarAppAfirma();
        setLoaded(true);
      } catch {
        setLoaded(false);
      }
    };
    s.onerror = () => setError("No se pudo cargar la librería de firma del Gobierno.");
    document.head.appendChild(s);
  }, []);

  async function firmar() {
    setError(null);
    setDone(false);
    if (!window.AutoScript) {
      setError("Autofirma no está disponible. Instálalo o pulsa el botón verde abajo.");
      return;
    }
    setBusy(true);
    try {
      await new Promise<void>((resolve, reject) => {
        window.AutoScript!.sign(
          contenidoBase64,
          algoritmo,
          formato,
          null,
          async (signatureB64, certB64) => {
            try {
              if (endpointPersistir) {
                const res = await fetch(endpointPersistir, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ signature_b64: signatureB64, certificate_b64: certB64, formato, algoritmo, ...extra }),
                });
                if (!res.ok) {
                  const j = await res.json().catch(() => ({}));
                  throw new Error(j.error ?? "No se pudo guardar la firma.");
                }
              }
              onSigned?.({ signature_b64: signatureB64, certificate_b64: certB64 });
              setDone(true);
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          (errorType, errorMessage) => {
            reject(new Error(`${errorType}: ${errorMessage}`));
          },
        );
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al firmar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button
        type="button"
        onClick={firmar}
        disabled={busy || done || !loaded}
        className="button"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : done ? <CheckCircle2 size={14} /> : <Shield size={14} />}
        {done ? "Firmado ✓" : busy ? "Abriendo Autofirma…" : label}
      </button>

      {!loaded && !error && (
        <span style={{ fontSize: 11, opacity: 0.7, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={11} className="animate-spin" /> Cargando librería oficial @firma…
        </span>
      )}

      {error && (
        <div style={{ padding: 10, borderRadius: 8, background: "#ef444412", border: "1px solid #ef444455", color: "#ef4444", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={13} /> {error}
        </div>
      )}

      <a
        href="https://firmaelectronica.gob.es/Home/Descargas.html"
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 11, opacity: 0.75, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "underline" }}
      >
        <FileSignature size={11} /> ¿No tienes Autofirma? Descárgalo oficial
        <ExternalLink size={10} />
      </a>
    </div>
  );
}
