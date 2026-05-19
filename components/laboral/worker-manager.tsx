"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { PayrollPanel } from "@/components/laboral/payroll-panel";
import { NominasMasivasPanel } from "@/components/laboral/nominas-masivas-panel";
import { SiltraFanPanel } from "@/components/laboral/siltra-fan-panel";
import { WorkerActionsModal } from "@/components/laboral/worker-actions-modal";
import { CuadrantePanel } from "@/components/laboral/cuadrante-panel";
import { VacacionesSaldoPanel } from "@/components/laboral/vacaciones-saldo-panel";
import { DeduccionesActivasPanel } from "@/components/laboral/deducciones-activas-panel";
import { CalendarioLaboral } from "@/components/laboral/calendario-laboral";
import { FiniquitoModal } from "@/components/laboral/finiquito-modal";
import { BonificacionesModal } from "@/components/laboral/bonificaciones-modal";
import { AtrasosModal } from "@/components/laboral/atrasos-modal";
import { ConceptosCatalogPanel } from "@/components/laboral/conceptos-catalog-panel";
import { HistoricoSalarialModal } from "@/components/laboral/historico-salarial-modal";

type Empresa = { id: string; nombre: string; nif?: string };
type Trabajador = {
  id: string;
  nombre: string;
  dni?: string;
  nss?: string;
  puesto?: string;
  email?: string;
  telefono?: string;
  fecha_alta?: string;
  fecha_baja?: string;
  tipo_contrato?: string;
  jornada_horas?: number;
  salario_bruto_anual?: number;
  irpf_pct?: number;
  activo: boolean;
};
type Ausencia = { id: string; trabajador_id: string; tipo: string; fecha_inicio: string; fecha_fin: string; dias: number; estado: string };
type Fichaje = { id: string; trabajador_id: string; fecha: string; hora_entrada?: string; hora_salida?: string; horas_total?: number };

const TIPO_CONTRATO = ["indefinido", "temporal", "obra y servicio", "formacion", "practicas", "fijo discontinuo"];
const TIPO_AUSENCIA = ["vacaciones", "it", "permiso", "maternidad", "paternidad", "excedencia", "otro"];

type LaboralTab = "trabajadores" | "ausencias" | "horario" | "nominas" | "cuadrante" | "calendario";

export function WorkerManager({ empresas, initialTab = "trabajadores" }: { empresas: Empresa[]; initialTab?: LaboralTab }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const { confirm } = useConfirm();
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [tab, setTabRaw] = useState<LaboralTab>(initialTab);
  const [, startTabTransition] = useTransition();
  function setTab(t: LaboralTab) {
    startTabTransition(() => setTabRaw(t));
  }
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [fichajes, setFichajes] = useState<Fichaje[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [finiquitoTrabajador, setFiniquitoTrabajador] = useState<Trabajador | null>(null);
  const [atrasosTrabajador, setAtrasosTrabajador] = useState<Trabajador | null>(null);
  const [histSalarioTrab, setHistSalarioTrab] = useState<Trabajador | null>(null);
  const [bonisTrabajador, setBonisTrabajador] = useState<Trabajador | null>(null);
  const [accionRapida, setAccionRapida] = useState<{ trabajador: Trabajador; accion: "contrata" | "parte-it" | "anticipo" | "embargo" } | null>(null);

  const [nuevo, setNuevo] = useState({
    nombre: "",
    dni: "",
    nss: "",
    puesto: "",
    email: "",
    telefono: "",
    tipo_contrato: "indefinido",
    jornada_horas: 40,
    salario_bruto_anual: 0,
    irpf_pct: 0,
    fecha_alta: new Date().toISOString().slice(0, 10),
    convenio_codigo: "",
    categoria_convenio: "",
    grupo_cotizacion: 0,
    pagas_anuales: 12 as 12 | 14,
    pagas_prorrateadas: true,
    trienio_importe: 0,
  });

  const [convenios, setConvenios] = useState<Array<{ codigo: string; nombre: string; categorias: Array<{ code: string; nombre: string; bruto_anual: number; grupo_cotizacion: number }>; jornada_semanal: number }>>([]);
  useEffect(() => {
    (async () => {
      const tk = await token();
      try {
        const res = await fetch("/api/laboral/convenios", { headers: { Authorization: `Bearer ${tk}` } });
        const j = await res.json();
        if (j.ok) setConvenios(j.items ?? []);
      } catch {
        // catálogo es opcional
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const convenioSel = convenios.find((c) => c.codigo === nuevo.convenio_codigo) ?? null;

  function aplicarCategoria(code: string) {
    const cat = convenioSel?.categorias.find((x) => x.code === code);
    if (!cat) {
      setNuevo((prev) => ({ ...prev, categoria_convenio: code }));
      return;
    }
    setNuevo((prev) => ({
      ...prev,
      categoria_convenio: code,
      salario_bruto_anual: cat.bruto_anual,
      grupo_cotizacion: cat.grupo_cotizacion,
      jornada_horas: convenioSel?.jornada_semanal ?? prev.jornada_horas,
    }));
  }

  const [nuevaAusencia, setNuevaAusencia] = useState({
    trabajador_id: "",
    tipo: "vacaciones",
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fecha_fin: new Date().toISOString().slice(0, 10),
    motivo: "",
  });

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function loadAll() {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    const tk = await token();
    try {
      const [tRes, aRes, hRes] = await Promise.all([
        fetch(`/api/laboral/trabajadores?empresa_id=${empresaId}`, { headers: { Authorization: `Bearer ${tk}` } }),
        fetch(`/api/laboral/ausencias?empresa_id=${empresaId}`, { headers: { Authorization: `Bearer ${tk}` } }),
        fetch(`/api/laboral/horario?empresa_id=${empresaId}`, { headers: { Authorization: `Bearer ${tk}` } }),
      ]);
      const tJson = await tRes.json();
      const aJson = await aRes.json();
      const hJson = await hRes.json();
      if (!tJson.ok) throw new Error(tJson.error ?? "Error trabajadores");
      setTrabajadores(tJson.items ?? []);
      setAusencias(aJson.items ?? []);
      setFichajes(hJson.items ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  async function altaTrabajador() {
    if (!empresaId || !nuevo.nombre) {
      setError("Nombre obligatorio");
      return;
    }
    const tk = await token();
    const res = await fetch("/api/laboral/trabajadores", {
      method: "POST",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        empresa_id: empresaId,
        ...nuevo,
        jornada_horas: Number(nuevo.jornada_horas),
        salario_bruto_anual: Number(nuevo.salario_bruto_anual),
        irpf_pct: Number(nuevo.irpf_pct),
      }),
    });
    const json = await res.json();
    if (!json.ok) {
      setError(json.error ?? "Error");
      return;
    }
    setSuccess("Trabajador dado de alta.");
    setNuevo({ ...nuevo, nombre: "", dni: "", nss: "", puesto: "", email: "", telefono: "" });
    loadAll();
  }

  async function bajaTrabajador(id: string) {
    if (!(await confirm({ title: "¿Dar de baja a este trabajador?", tone: "danger", confirmLabel: "Confirmar" }))) return;
    const tk = await token();
    const res = await fetch(`/api/laboral/trabajadores/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tk}` },
    });
    const json = await res.json();
    if (!json.ok) setError(json.error ?? "Error");
    else loadAll();
  }

  async function crearAusencia() {
    if (!nuevaAusencia.trabajador_id) {
      setError("Selecciona trabajador.");
      return;
    }
    const tk = await token();
    const res = await fetch("/api/laboral/ausencias", {
      method: "POST",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({ empresa_id: empresaId, ...nuevaAusencia }),
    });
    const json = await res.json();
    if (!json.ok) {
      setError(json.error ?? "Error");
      return;
    }
    setSuccess("Ausencia registrada.");
    loadAll();
  }

  async function actualizarAusencia(id: string, estado: string) {
    const tk = await token();
    const res = await fetch(`/api/laboral/ausencias?id=${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    const json = await res.json();
    if (!json.ok) setError(json.error ?? "Error");
    else loadAll();
  }

  async function descargarPdf(url: string, filename: string) {
    const tk = await token();
    setError(null);
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Error ${res.status}`);
      }
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(objUrl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  async function fichar(trabajadorId: string, accion: "entrada" | "salida") {
    const tk = await token();
    const res = await fetch("/api/laboral/horario", {
      method: "POST",
      headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({ empresa_id: empresaId, trabajador_id: trabajadorId, accion, fuente: "web" }),
    });
    const json = await res.json();
    if (!json.ok) setError(json.error ?? "Error");
    else {
      setSuccess(`Fichaje de ${accion} registrado.`);
      loadAll();
    }
  }

  return (
    <section className="card span-12">
      <div className="topbar" style={{ marginBottom: 12 }}>
        <div>
          <span className="eyebrow">Laboral</span>
          <h2 className="title" style={{ fontSize: 22 }}>Gestión de personal</h2>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <label className="sr-only" htmlFor="empresa-select">Empresa</label>
          <select id="empresa-select" className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>{e.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      <div role="tablist" style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {(["trabajadores", "ausencias", "horario", "cuadrante", "nominas", "calendario"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`button ${tab === t ? "" : "secondary"} compact`}
            onClick={() => setTab(t)}
          >
            {t === "trabajadores" ? "Trabajadores" : t === "ausencias" ? "Ausencias" : t === "horario" ? "Fichajes" : t === "cuadrante" ? "Cuadrante" : t === "nominas" ? "Nóminas" : "Calendario"}
          </button>
        ))}
      </div>

      {error ? <p role="alert" style={{ color: "var(--danger)", marginBottom: 12 }}>{error}</p> : null}
      {success ? <p role="status" style={{ color: "var(--brand)", marginBottom: 12 }}>{success}</p> : null}
      {loading ? <p className="muted">Cargando…</p> : null}

      {tab === "trabajadores" ? (
        <div style={{ display: "grid", gap: 18 }}>
          <details>
            <summary className="button compact" style={{ display: "inline-flex" }}>+ Alta de trabajador</summary>
            <div style={{ marginTop: 12, display: "grid", gap: 16 }}>
              <fieldset style={fsStyle}>
                <legend style={legendStyle}>Datos personales</legend>
                <div className="form two-cols">
                  <input className="input" placeholder="Nombre y apellidos" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
                  <input className="input" placeholder="DNI / NIE" value={nuevo.dni} onChange={(e) => setNuevo({ ...nuevo, dni: e.target.value })} />
                  <input className="input" placeholder="Nº SS" value={nuevo.nss} onChange={(e) => setNuevo({ ...nuevo, nss: e.target.value })} />
                  <input className="input" placeholder="Puesto" value={nuevo.puesto} onChange={(e) => setNuevo({ ...nuevo, puesto: e.target.value })} />
                  <input className="input" placeholder="Email" type="email" value={nuevo.email} onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })} />
                  <input className="input" placeholder="Teléfono" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} />
                </div>
              </fieldset>

              <fieldset style={fsStyle}>
                <legend style={legendStyle}>Contrato y convenio</legend>
                <div className="form two-cols">
                  <select className="input" value={nuevo.tipo_contrato} onChange={(e) => setNuevo({ ...nuevo, tipo_contrato: e.target.value })}>
                    {TIPO_CONTRATO.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <label className="label">
                    Fecha de alta
                    <input className="input" type="date" value={nuevo.fecha_alta} onChange={(e) => setNuevo({ ...nuevo, fecha_alta: e.target.value })} />
                  </label>
                  <label className="label">
                    Jornada (h/sem)
                    <input className="input" type="number" value={nuevo.jornada_horas} onChange={(e) => setNuevo({ ...nuevo, jornada_horas: Number(e.target.value) })} />
                  </label>
                  <select className="input" value={nuevo.convenio_codigo} onChange={(e) => setNuevo({ ...nuevo, convenio_codigo: e.target.value, categoria_convenio: "" })}>
                    <option value="">— Convenio colectivo (opcional) —</option>
                    {convenios.map((c) => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}
                  </select>
                  <select className="input span-form" value={nuevo.categoria_convenio} onChange={(e) => aplicarCategoria(e.target.value)} disabled={!convenioSel}>
                    <option value="">{convenioSel ? "— Categoría del convenio —" : "Selecciona convenio primero"}</option>
                    {convenioSel?.categorias.map((cat) => (
                      <option key={cat.code} value={cat.code}>
                        {cat.nombre} · {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cat.bruto_anual)}
                      </option>
                    ))}
                  </select>
                </div>
              </fieldset>

              <fieldset style={fsStyle}>
                <legend style={legendStyle}>Nómina y retribución</legend>
                <div className="form two-cols">
                  <label className="label">
                    Salario bruto anual (€)
                    <input className="input" type="number" value={nuevo.salario_bruto_anual} onChange={(e) => setNuevo({ ...nuevo, salario_bruto_anual: Number(e.target.value) })} />
                  </label>
                  <label className="label">
                    IRPF % (override)
                    <input className="input" type="number" placeholder="auto" value={nuevo.irpf_pct} onChange={(e) => setNuevo({ ...nuevo, irpf_pct: Number(e.target.value) })} step="0.1" />
                  </label>
                  <label className="label">
                    Pagas anuales
                    <select
                      className="input"
                      value={String(nuevo.pagas_anuales)}
                      onChange={(e) => setNuevo({ ...nuevo, pagas_anuales: Number(e.target.value) as 12 | 14 })}
                    >
                      <option value="12">12 pagas</option>
                      <option value="14">14 pagas (jun + dic)</option>
                    </select>
                  </label>
                  <label className="label">
                    Trienio anual (€)
                    <input
                      className="input"
                      type="number"
                      min={0}
                      step="0.01"
                      title="Importe anual de UN trienio (según convenio). Se prorratea /12."
                      value={nuevo.trienio_importe}
                      onChange={(e) => setNuevo({ ...nuevo, trienio_importe: Number(e.target.value) })}
                    />
                  </label>
                  <label className="label span-form" style={{ flexDirection: "row", alignItems: "center", gap: 8, fontSize: 13, opacity: nuevo.pagas_anuales === 12 ? 0.5 : 1 }}>
                    <input
                      type="checkbox"
                      checked={nuevo.pagas_prorrateadas}
                      onChange={(e) => setNuevo({ ...nuevo, pagas_prorrateadas: e.target.checked })}
                      disabled={nuevo.pagas_anuales === 12}
                    />
                    Prorratear pagas extras en las 12 mensualidades (si NO, se cobran en junio + diciembre)
                  </label>
                </div>
              </fieldset>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="button" onClick={altaTrabajador}>Crear trabajador</button>
              </div>
            </div>
          </details>

          <table className="table" style={{ tableLayout: "auto" }}>
            <thead>
              <tr><th>Nombre</th><th>DNI</th><th>Puesto</th><th>Contrato</th><th>Salario</th><th>Estado</th><th style={{ width: 1, whiteSpace: "nowrap" }}>Acciones</th><th></th></tr>
            </thead>
            <tbody>
              {trabajadores.length === 0 ? <tr><td colSpan={8} className="muted">Sin trabajadores aún.</td></tr> : null}
              {trabajadores.map((t) => (
                <tr key={t.id}>
                  <td>{t.nombre}</td>
                  <td>{t.dni ?? "-"}</td>
                  <td>{t.puesto ?? "-"}</td>
                  <td>{t.tipo_contrato ?? "-"}</td>
                  <td>{t.salario_bruto_anual ? `${t.salario_bruto_anual} €` : "-"}</td>
                  <td><span className={`status ${t.activo ? "" : "warning"}`}>{t.activo ? "activo" : "baja"}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                      <button
                        className="button secondary compact"
                        title="Calcular finiquito"
                        onClick={() => setFiniquitoTrabajador(t)}
                      >Finiquito</button>
                      <button
                        className="button secondary compact"
                        title="Histórico salarial del trabajador"
                        onClick={() => setHistSalarioTrab(t)}
                      >Histórico</button>
                      <details className="action-menu" style={{ position: "relative", display: "inline-block" }}>
                        <summary
                          className="button secondary compact"
                          style={{ listStyle: "none", cursor: "pointer", userSelect: "none" }}
                          title="Más acciones"
                        >Más ▾</summary>
                        <div
                          style={{
                            position: "absolute",
                            right: 0,
                            top: "calc(100% + 4px)",
                            zIndex: 50,
                            background: "var(--panel, #fff)",
                            border: "1px solid var(--line, #e5e7eb)",
                            borderRadius: 10,
                            boxShadow: "0 18px 40px -24px rgba(0,0,0,0.35)",
                            padding: 6,
                            display: "grid",
                            gap: 2,
                            minWidth: 200,
                          }}
                        >
                          <MenuItem onClick={() => descargarPdf(`/api/laboral/modelo-145?trabajador_id=${t.id}`, `modelo-145-${t.dni ?? t.id.slice(0, 8)}.pdf`)}>📄 Descargar Modelo 145</MenuItem>
                          <MenuItem onClick={() => setBonisTrabajador(t)}>💸 Bonificaciones SS</MenuItem>
                          <MenuItem onClick={() => setAtrasosTrabajador(t)}>📈 Atrasos retroactivos</MenuItem>
                          <MenuItem onClick={() => setAccionRapida({ trabajador: t, accion: "contrata" })}>📨 Generar Contrat@ (SEPE)</MenuItem>
                          <MenuItem onClick={() => setAccionRapida({ trabajador: t, accion: "parte-it" })}>🏥 Parte IT (Delt@)</MenuItem>
                          <MenuItem onClick={() => setAccionRapida({ trabajador: t, accion: "anticipo" })}>💰 Anticipo nómina</MenuItem>
                          <MenuItem onClick={() => setAccionRapida({ trabajador: t, accion: "embargo" })}>⚖️ Embargo judicial</MenuItem>
                        </div>
                      </details>
                    </div>
                  </td>
                  <td>
                    {t.activo ? <button className="button danger compact" onClick={() => bajaTrabajador(t.id)}>Dar de baja</button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "ausencias" ? (
        <div style={{ display: "grid", gap: 18 }}>
          <VacacionesSaldoPanel empresaId={empresaId} />
          <div className="form two-cols">
            <select className="input" value={nuevaAusencia.trabajador_id} onChange={(e) => setNuevaAusencia({ ...nuevaAusencia, trabajador_id: e.target.value })}>
              <option value="">Trabajador…</option>
              {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <select className="input" value={nuevaAusencia.tipo} onChange={(e) => setNuevaAusencia({ ...nuevaAusencia, tipo: e.target.value })}>
              {TIPO_AUSENCIA.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="input" type="date" value={nuevaAusencia.fecha_inicio} onChange={(e) => setNuevaAusencia({ ...nuevaAusencia, fecha_inicio: e.target.value })} />
            <input className="input" type="date" value={nuevaAusencia.fecha_fin} onChange={(e) => setNuevaAusencia({ ...nuevaAusencia, fecha_fin: e.target.value })} />
            <input className="input span-form" placeholder="Motivo" value={nuevaAusencia.motivo} onChange={(e) => setNuevaAusencia({ ...nuevaAusencia, motivo: e.target.value })} />
            <div className="span-form">
              <button className="button" onClick={crearAusencia}>Registrar ausencia</button>
            </div>
          </div>

          <table className="table">
            <thead>
              <tr><th>Trabajador</th><th>Tipo</th><th>Inicio</th><th>Fin</th><th>Días</th><th>Estado</th><th></th></tr>
            </thead>
            <tbody>
              {ausencias.length === 0 ? <tr><td colSpan={7} className="muted">Sin ausencias.</td></tr> : null}
              {ausencias.map((a) => (
                <tr key={a.id}>
                  <td>{trabajadores.find((t) => t.id === a.trabajador_id)?.nombre ?? "-"}</td>
                  <td>{a.tipo}</td>
                  <td>{a.fecha_inicio}</td>
                  <td>{a.fecha_fin}</td>
                  <td>{a.dias}</td>
                  <td><span className={`status ${a.estado === "aprobada" ? "" : "warning"}`}>{a.estado}</span></td>
                  <td>
                    {a.estado === "pendiente" ? (
                      <>
                        <button className="button compact" onClick={() => actualizarAusencia(a.id, "aprobada")}>Aprobar</button>{" "}
                        <button className="button secondary compact" onClick={() => actualizarAusencia(a.id, "rechazada")}>Rechazar</button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "horario" ? (
        <div style={{ display: "grid", gap: 16 }}>
          <p className="muted">
            Fichaje de hoy (cumplimiento RD 8/2019, registro horario obligatorio).{" "}
            <strong>Descarga el PDF mensual</strong> con un clic desde cada trabajador.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            {trabajadores.filter((t) => t.activo).map((t) => {
              const today = new Date().toISOString().slice(0, 10);
              const todayFichajes = fichajes.filter((f) => f.trabajador_id === t.id && f.fecha === today);
              const abierto = todayFichajes.find((f) => !f.hora_salida);
              return (
                <div key={t.id} className="setting-box" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <strong>{t.nombre}</strong>
                    <small style={{ display: "block" }} className="muted">
                      {abierto ? `Entrada: ${new Date(abierto.hora_entrada ?? "").toLocaleTimeString("es-ES")}` : todayFichajes.length === 0 ? "Sin fichaje hoy" : "Jornada cerrada"}
                    </small>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button className="button compact" onClick={() => fichar(t.id, "entrada")} disabled={!!abierto}>Entrada</button>
                    <button className="button secondary compact" onClick={() => fichar(t.id, "salida")} disabled={!abierto}>Salida</button>
                    <button
                      className="button ghost compact"
                      title="Registro horario mensual (PDF firmable)"
                      onClick={() => {
                        const periodo = new Date().toISOString().slice(0, 7);
                        descargarPdf(
                          `/api/laboral/registro-horario/pdf?empresa_id=${empresaId}&trabajador_id=${t.id}&periodo=${periodo}`,
                          `registro-horario-${t.dni ?? t.id.slice(0, 8)}-${periodo}.pdf`,
                        );
                      }}
                    >
                      PDF mes
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <details>
            <summary className="muted">Histórico (últimos)</summary>
            <table className="table">
              <thead><tr><th>Fecha</th><th>Trabajador</th><th>Entrada</th><th>Salida</th><th>Horas</th></tr></thead>
              <tbody>
                {fichajes.slice(0, 50).map((f) => (
                  <tr key={f.id}>
                    <td>{f.fecha}</td>
                    <td>{trabajadores.find((t) => t.id === f.trabajador_id)?.nombre ?? "-"}</td>
                    <td>{f.hora_entrada ? new Date(f.hora_entrada).toLocaleTimeString("es-ES") : "-"}</td>
                    <td>{f.hora_salida ? new Date(f.hora_salida).toLocaleTimeString("es-ES") : "-"}</td>
                    <td>{f.horas_total ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>
      ) : null}

      {tab === "nominas" ? (
        <div style={{ display: "grid", gap: 18 }}>
          <DeduccionesActivasPanel empresaId={empresaId} trabajadores={trabajadores} />
          <NominasMasivasPanel empresaId={empresaId} />
          <SiltraFanPanel empresaId={empresaId} />
          <PayrollPanel empresaId={empresaId} trabajadores={trabajadores} />
          <ConceptosCatalogPanel />
        </div>
      ) : null}

      {tab === "cuadrante" ? <CuadrantePanel empresaId={empresaId} trabajadores={trabajadores} /> : null}

      {tab === "calendario" ? <CalendarioLaboral /> : null}

      {finiquitoTrabajador ? (
        <FiniquitoModal
          empresaId={empresaId}
          trabajador={finiquitoTrabajador}
          onClose={() => setFiniquitoTrabajador(null)}
        />
      ) : null}

      {atrasosTrabajador ? (
        <AtrasosModal
          empresaId={empresaId}
          trabajador={atrasosTrabajador}
          onClose={() => setAtrasosTrabajador(null)}
        />
      ) : null}

      {histSalarioTrab ? (
        <HistoricoSalarialModal
          empresaId={empresaId}
          trabajador={histSalarioTrab}
          onClose={() => { setHistSalarioTrab(null); }}
        />
      ) : null}

      {accionRapida ? (
        <WorkerActionsModal
          empresaId={empresaId}
          trabajador={accionRapida.trabajador}
          accion={accionRapida.accion}
          onClose={() => setAccionRapida(null)}
        />
      ) : null}

      {bonisTrabajador ? (
        <BonificacionesModal
          trabajador={bonisTrabajador}
          onClose={() => setBonisTrabajador(null)}
        />
      ) : null}
    </section>
  );
}

const fsStyle: React.CSSProperties = {
  border: "1px solid var(--line, #e5e7eb)",
  borderRadius: 10,
  padding: 14,
  margin: 0,
};
const legendStyle: React.CSSProperties = {
  padding: "0 8px",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  opacity: 0.7,
  fontWeight: 600,
};

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        // Cierra el <details> padre tras click
        const det = (e.currentTarget.closest("details") as HTMLDetailsElement | null);
        if (det) det.open = false;
        onClick();
      }}
      style={{
        background: "transparent",
        border: 0,
        textAlign: "left",
        padding: "8px 10px",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 13,
        color: "var(--ink, #111)",
        width: "100%",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "color-mix(in srgb, var(--accent) 8%, transparent)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}
