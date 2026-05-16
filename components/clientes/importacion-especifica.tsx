"use client";

import { useState } from "react";
import { FileCode, FileSpreadsheet, BookOpen, Banknote, type LucideIcon } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Tipo = "modelos_aeat" | "cuentas_anuales" | "pgc" | "banco";

type Spec = {
  title: string;
  description: string;
  formats: string[];
  hint: string;
  destino: "facturas_emitidas" | "facturas_recibidas" | "gastos" | null;
  icon: LucideIcon;
};

const SPECS: Record<Tipo, Spec> = {
  modelos_aeat: {
    title: "Modelos AEAT presentados",
    description: "Importa el fichero TXT/XML del modelo que ya presentaste en AEAT para que aparezca en tu histórico (303, 111, 115, 130, 200, 390, 347, 349…).",
    formats: ["TXT posicional AEAT", "XML SII", "Borrador Renta CSV"],
    hint: "Tras subirlo, M26 lo guarda como declaración 'presentado' con la fecha que indiques y lo enlaza con tus facturas/gastos del periodo.",
    destino: null,
    icon: FileCode,
  },
  cuentas_anuales: {
    title: "Cuentas anuales (XBRL / Excel)",
    description: "Sube el balance, PyG y memoria de ejercicios anteriores para arrancar tu histórico contable.",
    formats: ["XBRL Registro Mercantil", "Excel A3 / Contasol", "CSV genérico"],
    hint: "Los saldos importados generan asientos de apertura en el ejercicio que indiques.",
    destino: null,
    icon: FileSpreadsheet,
  },
  pgc: {
    title: "Plan General Contable personalizado",
    description: "Si traes tu propio plan de cuentas (PGC PYMES adaptado, subcuentas analíticas), súbelo aquí.",
    formats: ["CSV cuenta;nombre;tipo", "TXT A3 ECO", "Excel PGC"],
    hint: "Las cuentas se añaden sin sobrescribir las del plan estándar.",
    destino: null,
    icon: BookOpen,
  },
  banco: {
    title: "Movimientos bancarios (conciliación)",
    description: "Importa extractos para conciliarlos con tus facturas y gastos.",
    formats: ["Norma 43 (.q43, .n43)", "CSV banco", "OFX / QIF"],
    hint: "M26 detecta movimientos duplicados y casa automáticamente con facturas existentes.",
    destino: null,
    icon: Banknote,
  },
};

export function ImportacionEspecifica({ empresaId, tipo }: { empresaId: string; tipo: string }) {
  const spec = SPECS[tipo as Tipo];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!spec) {
    return (
      <article className="card span-12">
        <p className="muted">Selecciona una sub-pestaña de importación.</p>
      </article>
    );
  }

  const Icon = spec.icon;

  async function recibir(file: File) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createBrowserSupabase();
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      // De momento subimos el archivo a la tabla de extracciones como 'manual' para
      // dejar registro y poder procesarlo después con el agente correspondiente.
      const buffer = await file.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        text = new TextDecoder("windows-1252").decode(buffer);
      }
      const res = await fetch("/api/agents/quick-capture", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresaId,
          source: "manual",
          payload_type: tipo,
          payload_filename: file.name,
          payload_text: text.slice(0, 100_000),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setMessage("Archivo recibido. Lo procesará el agente correspondiente y aparecerá en tu auditoría.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid">
      <article className="card span-12">
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div
            aria-hidden="true"
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "color-mix(in srgb, var(--accent) 14%, transparent)",
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <Icon size={22} strokeWidth={1.8} color="var(--accent)" aria-hidden="true" />
          </div>
          <div style={{ flex: 1 }}>
            <span className="card-eyebrow">Importaciones</span>
            <h2 style={{ fontSize: 18, margin: "4px 0 0" }}>{spec.title}</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{spec.description}</p>
          </div>
        </div>

        <div className="form three-cols" style={{ marginTop: 18 }}>
          <div>
            <span className="card-eyebrow">Formatos aceptados</span>
            <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
              {spec.formats.map((f) => <li key={f}>{f}</li>)}
            </ul>
          </div>
          <label className="label">
            Subir archivo
            <input
              type="file"
              className="input"
              accept=".csv,.txt,.xml,.xbrl,.xlsx,.xls,.q43,.n43,.ofx,.qif,.dat"
              onChange={(e) => e.target.files?.[0] && recibir(e.target.files[0])}
              disabled={busy}
            />
          </label>
          <div>
            <span className="card-eyebrow">Qué pasa después</span>
            <p style={{ fontSize: 12, marginTop: 8, color: "var(--muted)", lineHeight: 1.5 }}>{spec.hint}</p>
          </div>
        </div>

        {busy ? <p className="muted" style={{ marginTop: 12 }}>Procesando…</p> : null}
        {message ? <p role="status" style={{ color: "var(--good)", marginTop: 12 }}>{message}</p> : null}
        {error ? <p role="alert" style={{ color: "var(--bad)", marginTop: 12 }}>{error}</p> : null}
      </article>
    </section>
  );
}
