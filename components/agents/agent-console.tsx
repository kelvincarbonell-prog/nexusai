"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Empresa = { id: string; nombre: string; inbox_alias?: string };
type Extraction = {
  id: string;
  source: string;
  filename?: string;
  status: string;
  confidence?: number;
  datos_extraidos?: Record<string, unknown>;
  created_at: string;
};
type Categorization = {
  pgc_account_code: string;
  pgc_account_name?: string;
  confidence: number;
  source: string;
  explanation?: string;
};

export function AgentConsole({ empresas }: { empresas: Empresa[] }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const empresa = empresas.find((e) => e.id === empresaId);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractions, setExtractions] = useState<Extraction[]>([]);

  const [catInput, setCatInput] = useState({ vendor_name: "", vendor_nif: "", concepto: "", total: "" });
  const [catResult, setCatResult] = useState<Categorization | null>(null);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function loadExtractions() {
    if (!empresaId) return;
    const tk = await token();
    const res = await fetch(`/api/agents/runs?empresa_id=${empresaId}`, { headers: { Authorization: `Bearer ${tk}` } });
    const json = await res.json();
    if (!json.ok) return;
    setExtractions(
      (json.items ?? []).filter((r: { agent_id: string }) => r.agent_id === "invoice-extractor").map((r: { id: string; created_at: string; output: { confidence?: number; status?: string }; input: { filename?: string } }) => ({
        id: r.id,
        source: "upload",
        filename: r.input?.filename ?? "—",
        status: r.output?.status ?? "",
        confidence: r.output?.confidence,
        created_at: r.created_at,
      })),
    );
  }

  useEffect(() => {
    loadExtractions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function uploadAndExtract() {
    if (!file || !empresaId) {
      setError("Selecciona empresa y archivo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const tk = await token();
      const res = await fetch("/api/agents/extract-invoice", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresaId,
          source: "upload",
          filename: file.name,
          mime_type: file.type || "image/png",
          base64,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error en extracción");
      await loadExtractions();
      setFile(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function categorizar() {
    if (!empresaId) return;
    setBusy(true);
    setError(null);
    setCatResult(null);
    try {
      const tk = await token();
      const res = await fetch("/api/agents/categorize-expense", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          empresa_id: empresaId,
          vendor_name: catInput.vendor_name || undefined,
          vendor_nif: catInput.vendor_nif || undefined,
          concepto: catInput.concepto || undefined,
          total: catInput.total ? Number(catInput.total) : undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setCatResult(json.result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card span-12" style={{ display: "grid", gap: 16 }}>
      <div className="topbar">
        <div>
          <span className="eyebrow">Agentes IA</span>
          <h2 className="title" style={{ fontSize: 22 }}>Operaciones automáticas</h2>
        </div>
        <select className="input" style={{ maxWidth: 320 }} value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </div>

      {empresa?.inbox_alias ? (
        <div className="setting-box">
          <strong>Buzón de facturas para esta empresa</strong>
          <code>{empresa.inbox_alias}@inbox.m26.app</code>
          <small className="muted">
            Reenvía las facturas recibidas a este alias y el agente las extraerá automáticamente. Configura el webhook del proveedor de email a <code>/api/inbound/email</code>.
          </small>
        </div>
      ) : null}

      <div className="grid">
        <div className="card span-6" style={{ display: "grid", gap: 10 }}>
          <strong>📄 Agente extractor de facturas</strong>
          <p className="muted">Sube un PDF o imagen. El agente extrae proveedor, NIF, base, IVA, total y fecha.</p>
          <input className="input" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button className="button" onClick={uploadAndExtract} disabled={busy || !file}>
            {busy ? "Procesando…" : "Extraer datos"}
          </button>
          <table className="table">
            <thead><tr><th>Archivo</th><th>Estado</th><th>Confianza</th></tr></thead>
            <tbody>
              {extractions.length === 0 ? <tr><td colSpan={3} className="muted">Sin extracciones aún.</td></tr> : null}
              {extractions.slice(0, 8).map((x) => (
                <tr key={x.id}>
                  <td>{x.filename}</td>
                  <td><span className={`status ${x.status === "extracted" ? "" : "warning"}`}>{x.status}</span></td>
                  <td>{typeof x.confidence === "number" ? `${x.confidence.toFixed(0)}%` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card span-6" style={{ display: "grid", gap: 10 }}>
          <strong>🏷️ Agente categorizador de gastos</strong>
          <p className="muted">Sugiere la cuenta PGC del grupo 6 a partir de proveedor/concepto. Aprende del histórico.</p>
          <input className="input" placeholder="Proveedor" value={catInput.vendor_name} onChange={(e) => setCatInput({ ...catInput, vendor_name: e.target.value })} />
          <input className="input" placeholder="NIF proveedor" value={catInput.vendor_nif} onChange={(e) => setCatInput({ ...catInput, vendor_nif: e.target.value })} />
          <input className="input" placeholder="Concepto" value={catInput.concepto} onChange={(e) => setCatInput({ ...catInput, concepto: e.target.value })} />
          <input className="input" type="number" placeholder="Importe" value={catInput.total} onChange={(e) => setCatInput({ ...catInput, total: e.target.value })} />
          <button className="button" onClick={categorizar} disabled={busy}>{busy ? "Pensando…" : "Sugerir cuenta"}</button>
          {catResult ? (
            <div className="setting-box">
              <strong>Cuenta {catResult.pgc_account_code}</strong>
              <span>{catResult.pgc_account_name ?? "(no definida en catálogo)"}</span>
              <small>Confianza: {catResult.confidence}% · Origen: {catResult.source}</small>
              {catResult.explanation ? <small className="muted">{catResult.explanation}</small> : null}
            </div>
          ) : null}
        </div>
      </div>

      {error ? <p role="alert" style={{ color: "var(--danger)" }}>{error}</p> : null}
    </section>
  );
}
