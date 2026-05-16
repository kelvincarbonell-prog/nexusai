"use client";

import { useMemo, useState } from "react";
import * as Icons from "lucide-react";
import { Sparkles, Check, AlertCircle, ChevronRight } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { AGENT_CATALOG, agentsByCategory, type AgentSpec } from "@/lib/agents/catalogo";

type Empresa = { id: string; nombre: string };
type Trabajador = { id: string; nombre: string };

const CAT_LABELS: Record<AgentSpec["category"], string> = {
  fiscal: "Fiscales",
  laboral: "Laborales",
  facturacion: "Facturación",
  contabilidad: "Contabilidad",
  analisis: "Análisis e inteligencia",
};

const CAT_COLORS: Record<AgentSpec["category"], string> = {
  fiscal: "var(--accent)",
  laboral: "var(--good)",
  facturacion: "var(--warn)",
  contabilidad: "var(--bad)",
  analisis: "color-mix(in srgb, var(--accent) 70%, var(--good))",
};

function getIcon(name: string): React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }> {
  const lib = Icons as unknown as Record<string, React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>>;
  return lib[name] ?? Sparkles;
}

export function AgentPanel({ empresas }: { empresas: Empresa[] }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<AgentSpec["category"] | "todas">("todas");
  const [activeAgent, setActiveAgent] = useState<AgentSpec | null>(null);
  const [inputs, setInputs] = useState<Record<string, string | number>>({});
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [phase, setPhase] = useState<"idle" | "ejecutando" | "ok" | "error">("idle");
  const [result, setResult] = useState<unknown>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const grouped = useMemo(() => agentsByCategory(), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return AGENT_CATALOG.filter((a) => {
      if (category !== "todas" && a.category !== category) return false;
      if (!q) return true;
      return a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || a.id.includes(q);
    });
  }, [search, category]);

  async function loadTrabajadoresIfNeeded(agent: AgentSpec) {
    if (!agent.inputs.some((i) => i.type === "trabajador")) return;
    if (!empresaId) return;
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch(`/api/laboral/trabajadores?empresa_id=${empresaId}`, { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (json.ok) setTrabajadores(json.items ?? []);
    } catch {
      // ignore
    }
  }

  function abrir(agent: AgentSpec) {
    setActiveAgent(agent);
    setResult(null);
    setErrorMsg(null);
    setPhase("idle");
    const defaults: Record<string, string | number> = {};
    for (const i of agent.inputs) if (i.defaultValue !== undefined) defaults[i.name] = i.defaultValue;
    setInputs(defaults);
    loadTrabajadoresIfNeeded(agent);
  }

  function cerrar() {
    setActiveAgent(null);
    setResult(null);
    setErrorMsg(null);
    setPhase("idle");
  }

  async function ejecutar() {
    if (!activeAgent || !empresaId) return;
    // Validar required
    for (const i of activeAgent.inputs) {
      if (i.required && (inputs[i.name] === undefined || inputs[i.name] === "")) {
        setErrorMsg(`El campo "${i.label}" es obligatorio.`);
        return;
      }
    }
    setPhase("ejecutando");
    setErrorMsg(null);
    setResult(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: activeAgent.id, empresa_id: empresaId, inputs }),
      });
      const json = await res.json();
      if (!json.ok) {
        setPhase("error");
        setErrorMsg(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setPhase("ok");
      setResult(json.result);
    } catch (e: unknown) {
      setPhase("error");
      setErrorMsg(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <article className="card" style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <span className="card-eyebrow">Catálogo de agentes</span>
            <h2 style={{ fontSize: 20, margin: "4px 0 0" }}>{AGENT_CATALOG.length} agentes listos para ejecutar</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Selecciona empresa, busca un agente, rellena los datos y ejecútalo. Cada acción queda registrada en el historial.
            </p>
          </div>
          <label className="label" style={{ minWidth: 280 }}>
            Cliente
            <select className="input" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
              {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="input"
            placeholder="🔍 Buscar agente: «303», «nómina», «finiquito»…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 220 }}
          />
          <button className={`button compact ${category === "todas" ? "" : "ghost"}`} onClick={() => setCategory("todas")}>Todos · {AGENT_CATALOG.length}</button>
          {(Object.keys(grouped) as AgentSpec["category"][]).map((c) => (
            <button key={c} className={`button compact ${category === c ? "" : "ghost"}`} onClick={() => setCategory(c)}>
              {CAT_LABELS[c]} · {grouped[c].length}
            </button>
          ))}
        </div>
      </article>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {filtered.map((a) => {
          const Icon = getIcon(a.icon);
          const color = CAT_COLORS[a.category];
          return (
            <button
              key={a.id}
              onClick={() => abrir(a)}
              className="card agent-card"
              style={{
                all: "unset",
                cursor: "pointer",
                padding: 16,
                borderRadius: 12,
                border: "1px solid var(--line)",
                background: "var(--bg-soft, transparent)",
                display: "grid",
                gap: 10,
                alignContent: "start",
                transition: "border-color 0.15s ease, transform 0.12s ease, box-shadow 0.2s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div
                  aria-hidden="true"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: `color-mix(in srgb, ${color} 14%, transparent)`,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Icon size={18} strokeWidth={1.8} color={color} />
                </div>
                <span className="pill plain" style={{ fontSize: 10, fontFamily: "var(--mono)", textTransform: "uppercase" }}>
                  {CAT_LABELS[a.category]}
                </span>
              </div>
              <strong style={{ fontSize: 14, lineHeight: 1.3 }}>{a.title}</strong>
              <p className="muted" style={{ fontSize: 12, margin: 0, lineHeight: 1.5 }}>{a.description}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--accent)", fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                Ejecutar <ChevronRight size={13} strokeWidth={2} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Modal de ejecución */}
      {activeAgent ? (
        <div
          onClick={cerrar}
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 200,
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ maxWidth: 720, width: "100%", maxHeight: "85vh", overflowY: "auto", display: "grid", gap: 14 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <span className="card-eyebrow">{CAT_LABELS[activeAgent.category]}</span>
                <h2 style={{ fontSize: 20, margin: "4px 0 0" }}>{activeAgent.title}</h2>
                <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{activeAgent.description}</p>
              </div>
              <button className="button ghost compact" onClick={cerrar} aria-label="Cerrar">✕</button>
            </div>

            {activeAgent.inputs.length > 0 ? (
              <div className="form two-cols">
                {activeAgent.inputs.map((i) => (
                  <label key={i.name} className="label">
                    {i.label} {i.required ? <span style={{ color: "var(--bad)" }}>*</span> : null}
                    {i.type === "select" ? (
                      <select className="input" value={String(inputs[i.name] ?? "")} onChange={(e) => setInputs((p) => ({ ...p, [i.name]: e.target.value }))}>
                        {(i.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    ) : i.type === "trabajador" ? (
                      <select className="input" value={String(inputs[i.name] ?? "")} onChange={(e) => setInputs((p) => ({ ...p, [i.name]: e.target.value }))}>
                        <option value="">Selecciona trabajador…</option>
                        {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                      </select>
                    ) : i.type === "textarea" ? (
                      <textarea className="input textarea" value={String(inputs[i.name] ?? "")} onChange={(e) => setInputs((p) => ({ ...p, [i.name]: e.target.value }))} placeholder={i.placeholder} style={{ minHeight: 80 }} />
                    ) : (
                      <input
                        type={i.type === "number" ? "number" : i.type === "date" ? "date" : "text"}
                        className="input"
                        value={String(inputs[i.name] ?? "")}
                        onChange={(e) => setInputs((p) => ({ ...p, [i.name]: i.type === "number" ? Number(e.target.value) : e.target.value }))}
                        placeholder={i.placeholder}
                      />
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: 13 }}>Este agente no necesita datos. Pulsa Ejecutar.</p>
            )}

            {errorMsg ? <p role="alert" style={{ color: "var(--bad)" }}>{errorMsg}</p> : null}

            {phase === "ok" && result ? (
              <article className="card" style={{ background: "color-mix(in srgb, var(--good) 8%, transparent)", borderColor: "var(--good)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--good)", color: "white", display: "grid", placeItems: "center", animation: "agent-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>
                    <Check size={16} strokeWidth={2.6} />
                  </div>
                  <strong>Ejecutado con éxito</strong>
                </div>
                <pre style={{ fontFamily: "var(--mono)", fontSize: 11, maxHeight: 280, overflow: "auto", background: "var(--bg-soft, transparent)", padding: 10, borderRadius: 8, margin: 0 }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </article>
            ) : null}

            {phase === "error" ? (
              <article className="card" style={{ background: "color-mix(in srgb, var(--bad) 8%, transparent)", borderColor: "var(--bad)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertCircle size={18} color="var(--bad)" />
                  <strong>No se pudo ejecutar</strong>
                </div>
                {errorMsg ? <small style={{ display: "block", marginTop: 6, color: "var(--bad)" }}>{errorMsg}</small> : null}
              </article>
            ) : null}

            <div className="button-row" style={{ justifyContent: "flex-end" }}>
              <button className="button secondary" onClick={cerrar} disabled={phase === "ejecutando"}>Cerrar</button>
              <button
                className="button"
                onClick={ejecutar}
                disabled={phase === "ejecutando" || !empresaId}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, position: "relative", overflow: "hidden", minWidth: 160, justifyContent: "center" }}
              >
                {phase === "ejecutando" ? (
                  <>
                    <Sparkles size={14} strokeWidth={1.8} className="agent-spin" />
                    Ejecutando…
                    <span className="agent-shimmer" aria-hidden="true" />
                  </>
                ) : phase === "ok" ? (
                  <><Check size={14} strokeWidth={2.4} /> Repetir</>
                ) : (
                  <>Ejecutar agente</>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .agent-card:hover {
          border-color: var(--accent) !important;
          transform: translateY(-2px);
          box-shadow: 0 12px 30px -16px color-mix(in srgb, var(--accent) 45%, transparent);
        }
        @keyframes agent-pop { 0% { transform: scale(0); } 70% { transform: scale(1.15); } 100% { transform: scale(1); } }
        @keyframes agent-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .agent-spin { animation: agent-spin 1.2s linear infinite; }
        @keyframes agent-shimmer-anim { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        .agent-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%);
          animation: agent-shimmer-anim 1.4s linear infinite;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .agent-spin, .agent-shimmer { animation: none; }
        }
      `}</style>
    </section>
  );
}
