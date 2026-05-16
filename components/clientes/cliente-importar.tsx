"use client";

import { useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Preview = {
  numero?: string;
  contacto_nombre?: string;
  proveedor?: string;
  contacto_nif?: string;
  fecha_emision?: string;
  fecha?: string;
  base: number;
  iva: number;
  total: number;
};

type Result = {
  preview?: Preview[];
  total?: number;
  importados?: number;
  errores?: { fila: number; motivo: string }[];
};

const FORMATOS = [
  { id: "generico", label: "Genérico (CSV/Excel)", hint: "cualquier CSV con cabeceras estándar" },
  { id: "a3eco", label: "A3 ECO / A3 CON", hint: "exportación de A3 Software (TXT/CSV)" },
  { id: "contasol", label: "Contasol", hint: "exportación CSV/TXT de Contasol" },
  { id: "sage", label: "SAGE 50", hint: "exportación CSV con punto y coma" },
  { id: "quipu", label: "Quipu", hint: "exportación CSV de Quipu" },
  { id: "holded", label: "Holded / FacturaScripts", hint: "exportación CSV estándar" },
] as const;

export function ClienteImportar({ empresaId }: { empresaId: string }) {
  const [destino, setDestino] = useState<"facturas_emitidas" | "facturas_recibidas" | "gastos">("facturas_recibidas");
  const [formato, setFormato] = useState<typeof FORMATOS[number]["id"]>("generico");
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function token() {
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function leerArchivo(file: File) {
    setError(null);
    try {
      // Detectar encoding intentando UTF-8 primero, luego Latin-1 (común en A3/Contasol)
      const buffer = await file.arrayBuffer();
      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        // ANSI / Latin-1 (Windows-1252 prácticamente compatible)
        text = new TextDecoder("windows-1252").decode(buffer);
      }
      setCsvText(text);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo");
    }
  }

  async function importar(dryRun: boolean) {
    if (!csvText.trim()) {
      setError("Pega o sube un CSV.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const tk = await token();
      const res = await fetch("/api/billing/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ empresa_id: empresaId, csv_content: csvText, destino, dry_run: dryRun }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setResult(json);
      if (!dryRun) setSuccess(`Importados ${json.importados ?? 0} registros.`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid">
      <article className="card span-12">
        <span className="card-eyebrow">Importar desde A3 / Quipu / Contasol / SAGE / Holded</span>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          Sube el CSV/TXT que te genera tu antigua plataforma. M26 detecta el separador (coma o punto y coma),
          el encoding (UTF-8 o ANSI/Latin-1) y los nombres de columna comunes.
        </p>

        <div className="form three-cols" style={{ marginTop: 16 }}>
          <label className="label">
            Formato origen
            <select className="input" value={formato} onChange={(e) => setFormato(e.target.value as typeof formato)}>
              {FORMATOS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </label>
          <label className="label">
            Destino
            <select className="input" value={destino} onChange={(e) => setDestino(e.target.value as typeof destino)}>
              <option value="facturas_emitidas">Facturas emitidas</option>
              <option value="facturas_recibidas">Facturas recibidas</option>
              <option value="gastos">Gastos</option>
            </select>
          </label>
          <label className="label">
            Archivo
            <input
              type="file"
              accept=".csv,.txt,.tsv,.dat"
              className="input"
              onChange={(e) => e.target.files?.[0] && leerArchivo(e.target.files[0])}
            />
          </label>
        </div>

        <small className="muted" style={{ display: "block", marginTop: 6, fontSize: 11 }}>
          {FORMATOS.find((f) => f.id === formato)?.hint}
        </small>

        <label className="label" style={{ marginTop: 16 }}>
          O pega aquí el contenido CSV:
          <textarea
            className="input textarea"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="numero;cliente;nif;fecha;base;iva;total..."
            style={{ minHeight: 180, fontFamily: "var(--mono)", fontSize: 12 }}
          />
        </label>

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
        {success ? <p role="status" style={{ color: "var(--good)" }}>{success}</p> : null}

        <div className="button-row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button className="button secondary" onClick={() => importar(true)} disabled={busy || !csvText}>
            {busy ? "Analizando…" : "Previsualizar"}
          </button>
          <button className="button" onClick={() => importar(false)} disabled={busy || !csvText}>
            {busy ? "Importando…" : "Importar definitivamente"}
          </button>
        </div>
      </article>

      {result?.preview ? (
        <article className="card span-12">
          <span className="card-eyebrow">Previsualización · {result.total ?? result.preview.length} filas detectadas</span>
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Nº/Ref</th>
                <th>Contacto</th>
                <th>NIF</th>
                <th>Fecha</th>
                <th className="num">Base</th>
                <th className="num">IVA</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {result.preview.map((r, i) => (
                <tr key={i}>
                  <td>{r.numero ?? "—"}</td>
                  <td>{r.contacto_nombre ?? r.proveedor ?? "—"}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{r.contacto_nif ?? "—"}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{r.fecha_emision ?? r.fecha ?? "—"}</td>
                  <td className="num">{r.base.toFixed(2)} €</td>
                  <td className="num">{r.iva.toFixed(2)} €</td>
                  <td className="num">{r.total.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ) : null}

      {result?.errores && result.errores.length > 0 ? (
        <article className="card span-12" style={{ borderColor: "var(--warn)" }}>
          <span className="card-eyebrow warn">Filas con problemas ({result.errores.length})</span>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13 }}>
            {result.errores.slice(0, 20).map((e, i) => (
              <li key={i}>Fila {e.fila}: {e.motivo}</li>
            ))}
            {result.errores.length > 20 ? <li className="muted">… y {result.errores.length - 20} más</li> : null}
          </ul>
        </article>
      ) : null}
    </section>
  );
}
