"use client";

import { useMemo, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2, Download } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export type ImportTarget = "trabajadores" | "contactos";

type ResultadoFila = { ok: boolean; fila: number; error?: string };

type ApiResponse = {
  ok: boolean;
  dry_run?: boolean;
  total?: number;
  a_insertar?: number;
  insertados?: number;
  duplicados?: number;
  errores?: number;
  resultados?: ResultadoFila[];
  error?: string;
};

const PLANTILLAS: Record<ImportTarget, { titulo: string; descripcion: string; headers: string; ejemplo: string }> = {
  trabajadores: {
    titulo: "Importar trabajadores",
    descripcion: "Sube un CSV con tus trabajadores. Si el DNI ya existe en la empresa, se omite.",
    headers: "nombre,apellidos,dni,nss,email,telefono,puesto,tipo_contrato,jornada_horas,salario_bruto_anual,irpf_pct,hijos,fecha_alta,fecha_nacimiento,convenio_codigo,categoria_convenio",
    ejemplo: `nombre,apellidos,dni,nss,email,telefono,puesto,tipo_contrato,jornada_horas,salario_bruto_anual,irpf_pct,hijos,fecha_alta,fecha_nacimiento,convenio_codigo,categoria_convenio
Carlos,Ruiz López,12345678A,281234567890,carlos@empresa.com,600123456,Oficial 1ª,indefinido,40,22000,8.5,1,2024-01-15,1985-03-20,99004585011982,OF1
Marta,Soler Gual,87654321B,281234567891,marta@empresa.com,600654321,Encargada,indefinido,40,28000,12,0,2023-06-01,1990-11-10,99004585011982,JEF`,
  },
  contactos: {
    titulo: "Importar contactos (clientes/proveedores)",
    descripcion: "Sube un CSV con tus contactos. Si NIF + tipo ya existen en la empresa, se omite.",
    headers: "tipo,nombre,nif,email,telefono,direccion,cp,ciudad,provincia,pais,iban,condiciones_pago_dias,irpf_pct,notas",
    ejemplo: `tipo,nombre,nif,email,telefono,direccion,cp,ciudad,provincia,pais,iban,condiciones_pago_dias,irpf_pct,notas
cliente,Innova Apps S.L.,B12345678,facturacion@innova.com,932000000,C/ Diagonal 123,08018,Barcelona,Barcelona,ES,,30,,Cliente recurrente
proveedor,Movistar,A28013138,,,Gran Vía 28,28013,Madrid,Madrid,ES,,30,,Telefonía oficina`,
  },
};

export function CSVImportPanel({ empresaId, target }: { empresaId: string; target: ImportTarget }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const conf = PLANTILLAS[target];
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ApiResponse | null>(null);
  const [imported, setImported] = useState<ApiResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function readFile(): Promise<string> {
    if (!file) throw new Error("Sin archivo");
    return await file.text();
  }

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function run(dry: boolean) {
    setBusy(true); setError(null);
    try {
      const csv = await readFile();
      const tk = await token();
      const res = await fetch(`/api/import/${target}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({ empresa_id: empresaId, csv, dry_run: dry }),
      });
      const j = (await res.json()) as ApiResponse;
      if (!j.ok) throw new Error(j.error ?? "Error");
      if (dry) { setPreview(j); setImported(null); }
      else { setImported(j); setPreview(null); }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setBusy(false); }
  }

  function descargarPlantilla() {
    const blob = new Blob([conf.ejemplo], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `plantilla-${target}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <FileSpreadsheet size={18} />
        <h3 style={{ margin: 0 }}>{conf.titulo}</h3>
        <button onClick={descargarPlantilla} className="button ghost compact" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Download size={13} /> Plantilla CSV
        </button>
      </header>
      <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
        {conf.descripcion}
      </p>
      <p style={{ margin: 0, fontSize: 11, opacity: 0.6, fontFamily: "var(--mono, monospace)" }}>
        Cabeceras esperadas: <code>{conf.headers}</code>
      </p>

      <div style={{ display: "grid", gap: 10, padding: 12, border: "1px dashed color-mix(in srgb, currentColor 22%, transparent)", borderRadius: 10 }}>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); setImported(null); }}
          style={{ fontSize: 13 }}
        />
        {file && (
          <span style={{ fontSize: 12, opacity: 0.7 }}>
            Seleccionado: <strong>{file.name}</strong> · {(file.size / 1024).toFixed(1)} KB
          </span>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => run(true)} disabled={!file || busy} className="button secondary compact" style={btnRow}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            1. Previsualizar
          </button>
          <button onClick={() => run(false)} disabled={!file || busy || !preview?.ok} className="button compact" style={btnRow}>
            <CheckCircle2 size={13} />
            2. Importar definitivamente
          </button>
        </div>
      </div>

      {error && (
        <div style={alertBox("error")}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {preview && (
        <div style={{ display: "grid", gap: 8 }}>
          <h4 style={{ margin: 0, fontSize: 13 }}>Previsualización · no se ha guardado nada todavía</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
            <Mini titulo="Filas en CSV" valor={String(preview.total ?? 0)} />
            <Mini titulo="A insertar" valor={String(preview.a_insertar ?? 0)} tono="ok" />
            <Mini titulo="Duplicados" valor={String(preview.duplicados ?? 0)} tono="warn" />
            <Mini titulo="Errores" valor={String(preview.errores ?? 0)} tono={preview.errores ? "error" : undefined} />
          </div>
          {Array.isArray(preview.resultados) && preview.resultados.filter((r) => !r.ok).length > 0 && (
            <details>
              <summary style={{ fontSize: 12, cursor: "pointer", opacity: 0.75 }}>Ver problemas ({preview.resultados.filter((r) => !r.ok).length})</summary>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12, color: "#ef4444" }}>
                {preview.resultados.filter((r) => !r.ok).slice(0, 30).map((r) => (
                  <li key={r.fila}>Fila {r.fila}: {r.error}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {imported?.ok && (
        <div style={alertBox("ok")}>
          <CheckCircle2 size={14} />
          {imported.insertados} {target === "trabajadores" ? "trabajadores" : "contactos"} importados.
          {imported.duplicados ? ` ${imported.duplicados} omitidos por duplicado.` : ""}
          {imported.errores ? ` ${imported.errores} con error.` : ""}
        </div>
      )}
    </section>
  );
}

function Mini({ titulo, valor, tono }: { titulo: string; valor: string; tono?: "ok" | "warn" | "error" }) {
  const border = tono === "ok" ? "#10b98155" : tono === "warn" ? "#f59e0b55" : tono === "error" ? "#ef444455" : "color-mix(in srgb, currentColor 14%, transparent)";
  const bg = tono === "ok" ? "#10b98108" : tono === "warn" ? "#f59e0b08" : tono === "error" ? "#ef444408" : "color-mix(in srgb, currentColor 4%, transparent)";
  return (
    <div style={{ padding: 10, borderRadius: 8, border: `1px solid ${border}`, background: bg, display: "grid", gap: 2 }}>
      <span style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.4 }}>{titulo}</span>
      <strong style={{ fontSize: 15 }}>{valor}</strong>
    </div>
  );
}

function alertBox(tone: "ok" | "error"): React.CSSProperties {
  const ok = tone === "ok";
  return {
    padding: 10, borderRadius: 8,
    background: ok ? "#10b98112" : "#ef444412",
    border: `1px solid ${ok ? "#10b98155" : "#ef444455"}`,
    color: ok ? "#10b981" : "#ef4444",
    fontSize: 13, display: "flex", alignItems: "center", gap: 6,
  };
}

const btnRow: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6 };
