"use client";

import { useState, useMemo } from "react";
import { X, Loader2, Download, AlertTriangle, FileSignature, HeartPulse, Wallet, Gavel } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Trabajador = {
  id: string;
  nombre: string;
  dni?: string | null;
  nss?: string | null;
  fecha_nacimiento?: string | null;
};

type Accion = "contrata" | "parte-it" | "anticipo" | "embargo";

const TITULOS: Record<Accion, { titulo: string; icono: React.ReactNode; descripcion: string }> = {
  contrata: { titulo: "Generar Contrat@ (SEPE)", icono: <FileSignature size={16} />, descripcion: "XML de comunicación de contrato al SEPE." },
  "parte-it": { titulo: "Comunicar parte IT (Delt@)", icono: <HeartPulse size={16} />, descripcion: "XML de parte de baja/alta médica al Ministerio." },
  anticipo: { titulo: "Crear anticipo de nómina", icono: <Wallet size={16} />, descripcion: "Adelantar dinero al trabajador para descontar en próximas nóminas." },
  embargo: { titulo: "Registrar embargo judicial", icono: <Gavel size={16} />, descripcion: "Ley de Enjuiciamiento Civil — tramos sobre SMI o pensión de alimentos." },
};

export function WorkerActionsModal({
  empresaId,
  trabajador,
  accion,
  onClose,
}: {
  empresaId: string;
  trabajador: Trabajador;
  accion: Accion;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  // ---- estados por acción ----
  const [contrata, setContrata] = useState({
    tipo: "100",
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_fin: "",
    jornada_horas_semanales: 40,
    jornada_tipo: "completa" as "completa" | "parcial",
    salario_bruto_anual: 20000,
  });
  const [parteIT, setParteIT] = useState({
    tipo: "baja" as "baja" | "alta" | "confirmacion",
    contingencia: "cc" as "cc" | "ep" | "atrabajo" | "atrayecto",
    fecha_emision: new Date().toISOString().slice(0, 10),
    fecha_baja: new Date().toISOString().slice(0, 10),
    fecha_alta: "",
    diagnostico: "",
    duracion_estimada_dias: 7,
    causa_alta: "" as "" | "curacion" | "incomparecencia" | "fallecimiento" | "propuesta_inc_perm" | "agotamiento",
  });
  const [anticipo, setAnticipo] = useState({
    importe: 500,
    cuotas: 1,
    motivo: "",
    fecha: new Date().toISOString().slice(0, 10),
  });
  const [embargo, setEmbargo] = useState({
    juzgado: "",
    procedimiento: "",
    beneficiario: "",
    deuda_total: 1000,
    fecha_inicio: new Date().toISOString().slice(0, 10),
    pension_alimentos: false,
    porcentaje_pension: 0,
  });

  async function enviarContrata() {
    setBusy(true); setError(null); setErrores([]); setSuccess(null);
    try {
      const tk = await token();
      const body = {
        empresa_id: empresaId,
        trabajador_id: trabajador.id,
        formato: "xml",
        contrato: {
          tipo: contrata.tipo,
          fecha_inicio: contrata.fecha_inicio,
          fecha_fin: contrata.fecha_fin || undefined,
          jornada_horas_semanales: Number(contrata.jornada_horas_semanales),
          jornada_tipo: contrata.jornada_tipo,
          salario_bruto_anual: Number(contrata.salario_bruto_anual),
        },
      };
      const res = await fetch("/api/laboral/sepe/contrata", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j.errores) setErrores(j.errores);
        throw new Error(j.error ?? "No se pudo generar");
      }
      const blob = await res.blob();
      downloadBlob(blob, `contrata-${trabajador.dni ?? trabajador.id.slice(0, 8)}-${contrata.fecha_inicio}.xml`);
      setSuccess("XML Contrat@ descargado. Súbelo a la sede SEPE.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setBusy(false); }
  }

  async function enviarParteIT() {
    setBusy(true); setError(null); setErrores([]); setSuccess(null);
    try {
      const tk = await token();
      const body = {
        empresa_id: empresaId,
        trabajador_id: trabajador.id,
        tipo: parteIT.tipo,
        contingencia: parteIT.contingencia,
        formato: "xml",
        parte: {
          fecha_emision: parteIT.fecha_emision,
          fecha_baja: parteIT.fecha_baja,
          fecha_alta: parteIT.fecha_alta || undefined,
          diagnostico: parteIT.diagnostico || undefined,
          duracion_estimada_dias: parteIT.duracion_estimada_dias || undefined,
          causa_alta: parteIT.causa_alta || undefined,
        },
      };
      const res = await fetch("/api/laboral/delta/parte-it", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j.errores) setErrores(j.errores);
        throw new Error(j.error ?? "No se pudo generar");
      }
      const blob = await res.blob();
      downloadBlob(blob, `parte-it-${trabajador.dni ?? trabajador.id.slice(0, 8)}-${parteIT.fecha_baja}.xml`);
      setSuccess("XML Delt@ descargado. Súbelo a la sede del Ministerio en el plazo legal.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setBusy(false); }
  }

  async function enviarAnticipo() {
    setBusy(true); setError(null); setSuccess(null);
    try {
      const tk = await token();
      const res = await fetch("/api/laboral/anticipos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          empresa_id: empresaId,
          trabajador_id: trabajador.id,
          importe: Number(anticipo.importe),
          cuotas: Number(anticipo.cuotas),
          motivo: anticipo.motivo || undefined,
          fecha: anticipo.fecha,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Error");
      setSuccess(`Anticipo de ${anticipo.importe}€ creado en ${anticipo.cuotas} cuota${anticipo.cuotas === 1 ? "" : "s"}.`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setBusy(false); }
  }

  async function enviarEmbargo() {
    setBusy(true); setError(null); setSuccess(null);
    try {
      const tk = await token();
      const res = await fetch("/api/laboral/embargos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          empresa_id: empresaId,
          trabajador_id: trabajador.id,
          juzgado: embargo.juzgado,
          procedimiento: embargo.procedimiento || undefined,
          beneficiario: embargo.beneficiario || undefined,
          deuda_total: Number(embargo.deuda_total),
          fecha_inicio: embargo.fecha_inicio,
          pension_alimentos: embargo.pension_alimentos,
          porcentaje_pension: embargo.pension_alimentos ? Number(embargo.porcentaje_pension) : undefined,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Error");
      setSuccess(`Embargo registrado · juzgado ${embargo.juzgado}. Se descontará automáticamente de las próximas nóminas.`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally { setBusy(false); }
  }

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }

  const head = TITULOS[accion];

  return (
    <div role="dialog" aria-modal="true" onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={dialog}>
        <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {head.icono}
          <div style={{ display: "grid" }}>
            <strong style={{ fontSize: 15 }}>{head.titulo}</strong>
            <small style={{ opacity: 0.7, fontSize: 12 }}>
              {trabajador.nombre} · {trabajador.dni ?? "sin DNI"}
            </small>
          </div>
          <button onClick={onClose} aria-label="Cerrar" style={iconBtn}><X size={16} /></button>
        </header>

        <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>{head.descripcion}</p>

        {accion === "contrata" && (
          <div style={grid}>
            <Field label="Tipo SEPE (3 dígitos)">
              <select value={contrata.tipo} onChange={(e) => setContrata({ ...contrata, tipo: e.target.value })} style={input}>
                <option value="100">100 · Indefinido tiempo completo</option>
                <option value="189">189 · Indefinido tiempo parcial</option>
                <option value="200">200 · Temporal por producción</option>
                <option value="401">401 · Formativo en alternancia</option>
                <option value="501">501 · Práctica profesional</option>
              </select>
            </Field>
            <Field label="Jornada"><select value={contrata.jornada_tipo} onChange={(e) => setContrata({ ...contrata, jornada_tipo: e.target.value as "completa" | "parcial" })} style={input}><option value="completa">Completa</option><option value="parcial">Parcial</option></select></Field>
            <Field label="Fecha inicio"><input type="date" value={contrata.fecha_inicio} onChange={(e) => setContrata({ ...contrata, fecha_inicio: e.target.value })} style={input} /></Field>
            <Field label="Fecha fin (opcional)"><input type="date" value={contrata.fecha_fin} onChange={(e) => setContrata({ ...contrata, fecha_fin: e.target.value })} style={input} /></Field>
            <Field label="Horas semanales"><input type="number" value={contrata.jornada_horas_semanales} onChange={(e) => setContrata({ ...contrata, jornada_horas_semanales: Number(e.target.value) })} style={input} step="0.5" /></Field>
            <Field label="Salario bruto anual"><input type="number" value={contrata.salario_bruto_anual} onChange={(e) => setContrata({ ...contrata, salario_bruto_anual: Number(e.target.value) })} style={input} step="100" /></Field>
          </div>
        )}

        {accion === "parte-it" && (
          <div style={grid}>
            <Field label="Tipo"><select value={parteIT.tipo} onChange={(e) => setParteIT({ ...parteIT, tipo: e.target.value as typeof parteIT.tipo })} style={input}><option value="baja">Baja</option><option value="alta">Alta (fin IT)</option><option value="confirmacion">Confirmación</option></select></Field>
            <Field label="Contingencia"><select value={parteIT.contingencia} onChange={(e) => setParteIT({ ...parteIT, contingencia: e.target.value as typeof parteIT.contingencia })} style={input}><option value="cc">Común (enfermedad)</option><option value="ep">Enfermedad profesional</option><option value="atrabajo">Accidente de trabajo</option><option value="atrayecto">Accidente in itinere</option></select></Field>
            <Field label="Fecha emisión del parte"><input type="date" value={parteIT.fecha_emision} onChange={(e) => setParteIT({ ...parteIT, fecha_emision: e.target.value })} style={input} /></Field>
            <Field label="Fecha baja"><input type="date" value={parteIT.fecha_baja} onChange={(e) => setParteIT({ ...parteIT, fecha_baja: e.target.value })} style={input} /></Field>
            {parteIT.tipo === "alta" && (
              <>
                <Field label="Fecha alta"><input type="date" value={parteIT.fecha_alta} onChange={(e) => setParteIT({ ...parteIT, fecha_alta: e.target.value })} style={input} /></Field>
                <Field label="Causa alta"><select value={parteIT.causa_alta} onChange={(e) => setParteIT({ ...parteIT, causa_alta: e.target.value as typeof parteIT.causa_alta })} style={input}><option value="">—</option><option value="curacion">Curación</option><option value="incomparecencia">Incomparecencia</option><option value="propuesta_inc_perm">Propuesta IP</option><option value="agotamiento">Agotamiento</option><option value="fallecimiento">Fallecimiento</option></select></Field>
              </>
            )}
            <Field label="Duración estimada (días)"><input type="number" min={1} max={540} value={parteIT.duracion_estimada_dias} onChange={(e) => setParteIT({ ...parteIT, duracion_estimada_dias: Number(e.target.value) })} style={input} /></Field>
            <Field label="Diagnóstico CIE-10 (opcional)"><input value={parteIT.diagnostico} onChange={(e) => setParteIT({ ...parteIT, diagnostico: e.target.value })} style={input} placeholder="ej. M54.5" /></Field>
          </div>
        )}

        {accion === "anticipo" && (
          <div style={grid}>
            <Field label="Importe (€)"><input type="number" value={anticipo.importe} onChange={(e) => setAnticipo({ ...anticipo, importe: Number(e.target.value) })} style={input} step="50" /></Field>
            <Field label="Cuotas a descontar"><input type="number" value={anticipo.cuotas} onChange={(e) => setAnticipo({ ...anticipo, cuotas: Number(e.target.value) })} style={input} min={1} max={24} /></Field>
            <Field label="Fecha entrega"><input type="date" value={anticipo.fecha} onChange={(e) => setAnticipo({ ...anticipo, fecha: e.target.value })} style={input} /></Field>
            <Field label="Motivo (opcional)" full><input value={anticipo.motivo} onChange={(e) => setAnticipo({ ...anticipo, motivo: e.target.value })} style={input} placeholder="Adelanto de nómina" /></Field>
          </div>
        )}

        {accion === "embargo" && (
          <div style={grid}>
            <Field label="Juzgado" full><input value={embargo.juzgado} onChange={(e) => setEmbargo({ ...embargo, juzgado: e.target.value })} style={input} placeholder="Juzgado de Primera Instancia nº 3 de Madrid" /></Field>
            <Field label="Procedimiento"><input value={embargo.procedimiento} onChange={(e) => setEmbargo({ ...embargo, procedimiento: e.target.value })} style={input} placeholder="Ejecución 1234/2025" /></Field>
            <Field label="Beneficiario"><input value={embargo.beneficiario} onChange={(e) => setEmbargo({ ...embargo, beneficiario: e.target.value })} style={input} placeholder="Acreedor / cónyuge" /></Field>
            <Field label="Deuda total (€)"><input type="number" value={embargo.deuda_total} onChange={(e) => setEmbargo({ ...embargo, deuda_total: Number(e.target.value) })} style={input} step="100" /></Field>
            <Field label="Fecha inicio"><input type="date" value={embargo.fecha_inicio} onChange={(e) => setEmbargo({ ...embargo, fecha_inicio: e.target.value })} style={input} /></Field>
            <Field label="Pensión alimentos" full>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" checked={embargo.pension_alimentos} onChange={(e) => setEmbargo({ ...embargo, pension_alimentos: e.target.checked })} />
                Sí (todo el bruto es embargable según % fijado por juez)
              </label>
            </Field>
            {embargo.pension_alimentos && (
              <Field label="% pensión (LEC)"><input type="number" value={embargo.porcentaje_pension} onChange={(e) => setEmbargo({ ...embargo, porcentaje_pension: Number(e.target.value) })} style={input} min={0} max={100} step="0.5" /></Field>
            )}
          </div>
        )}

        {errores.length > 0 && (
          <div style={{ padding: 10, borderRadius: 8, background: "#f59e0b12", border: "1px solid #f59e0b55", display: "grid", gap: 4, fontSize: 12 }}>
            <strong style={{ display: "flex", alignItems: "center", gap: 6, color: "#f59e0b" }}>
              <AlertTriangle size={14} /> Datos incompletos
            </strong>
            <ul style={{ margin: 0, paddingLeft: 18 }}>{errores.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}
        {error && (
          <div style={{ padding: 10, borderRadius: 8, background: "#ef444412", border: "1px solid #ef444455", color: "#ef4444", fontSize: 13 }}>{error}</div>
        )}
        {success && (
          <div style={{ padding: 10, borderRadius: 8, background: "#10b98112", border: "1px solid #10b98155", color: "#10b981", fontSize: 13 }}>{success}</div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} className="button ghost compact">Cerrar</button>
          <button
            type="button"
            disabled={busy}
            className="button"
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={() => {
              if (accion === "contrata") enviarContrata();
              else if (accion === "parte-it") enviarParteIT();
              else if (accion === "anticipo") enviarAnticipo();
              else enviarEmbargo();
            }}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {accion === "contrata" || accion === "parte-it" ? (
              <><Download size={14} />{busy ? "Generando…" : "Descargar XML"}</>
            ) : (
              busy ? "Guardando…" : "Guardar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4, fontSize: 12, gridColumn: full ? "span 2" : undefined }}>
      <span style={{ opacity: 0.75 }}>{label}</span>
      {children}
    </label>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
  display: "grid", placeItems: "center", padding: 16, zIndex: 1000,
};
const dialog: React.CSSProperties = {
  width: "min(640px, 100%)", maxHeight: "90vh", overflow: "auto",
  background: "var(--card, #fff)", borderRadius: 14, border: "1px solid var(--border, #e5e7eb)",
  padding: 18, display: "grid", gap: 12,
};
const iconBtn: React.CSSProperties = {
  marginLeft: "auto", border: "none", background: "transparent",
  cursor: "pointer", display: "grid", placeItems: "center", padding: 6,
};
const grid: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
};
const input: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border, #e5e7eb)",
  background: "var(--card-bg, #fff)", fontSize: 13, width: "100%", boxSizing: "border-box",
};
