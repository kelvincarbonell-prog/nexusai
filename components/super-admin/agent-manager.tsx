"use client";

import { useState, useTransition } from "react";
import { Plus, Save, Send, Trash2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import type { AgentConfig } from "@/lib/agents/defaults";

function lines(value: string[]) {
  return value.join("\n");
}

function splitLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

export function AgentManager({ initialAgents }: { initialAgents: AgentConfig[] }) {
  const [agents, setAgents] = useState(initialAgents);
  const [selectedId, setSelectedId] = useState(initialAgents[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const selected = agents.find((agent) => agent.id === selectedId) ?? agents[0];

  async function authHeaders() {
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    };
  }

  function patchSelected(patch: Partial<AgentConfig>) {
    if (!selected) return;
    setAgents((current) => current.map((agent) => (agent.id === selected.id ? { ...agent, ...patch } : agent)));
  }

  function saveAgent() {
    if (!selected) return;
    setMessage("");
    startTransition(async () => {
      const res = await fetch("/api/super-admin/agents", {
        method: "PUT",
        headers: await authHeaders(),
        body: JSON.stringify(selected),
      });
      setMessage(res.ok ? "Agente guardado." : "No se pudo guardar el agente.");
    });
  }

  function deleteAgent() {
    if (!selected) return;
    setMessage("");
    startTransition(async () => {
      const res = await fetch(`/api/super-admin/agents?id=${encodeURIComponent(selected.id)}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
      if (res.ok) {
        setAgents((current) => current.filter((agent) => agent.id !== selected.id));
        setSelectedId(agents.find((agent) => agent.id !== selected.id)?.id ?? "");
        setMessage("Agente eliminado.");
      } else {
        setMessage("No se pudo eliminar el agente.");
      }
    });
  }

  function addAgent() {
    const id = `custom-${Date.now()}`;
    const next: AgentConfig = {
      id,
      name: "Nuevo agente",
      category: "custom",
      enabled: true,
      priority: agents.length + 1,
      mission: "Define la misión del agente.",
      rules_do: ["Revisar los cambios asignados."],
      rules_dont: ["No aprobar cambios sin criterios claros."],
      order_prompt: "Actua como agente especialista de NexusAI y revisa la tarea asignada.",
    };
    setAgents((current) => [...current, next]);
    setSelectedId(id);
  }

  function sendOrder() {
    if (!selected) return;
    setMessage(`Orden preparada para ${selected.name}: ${selected.order_prompt}`);
  }

  if (!selected) {
    return (
      <section className="card span-12">
        <h2>Agentes</h2>
        <p className="muted">Todavia no hay agentes configurados.</p>
        <button className="button" onClick={addAgent} type="button">
          <Plus size={16} />
          Añadir agente
        </button>
      </section>
    );
  }

  return (
    <section className="card span-12 admin-workbench" id="agents">
      <div className="admin-list">
        <div className="topbar">
          <div>
            <div className="eyebrow">Agentes</div>
            <h2>Normas configurables</h2>
          </div>
          <button className="button secondary" onClick={addAgent} type="button" title="Añadir agente">
            <Plus size={16} />
          </button>
        </div>
        <div className="agent-list">
          {[...agents].sort((a, b) => a.priority - b.priority).map((agent) => (
            <button
              type="button"
              key={agent.id}
              className={`agent-row ${agent.id === selected.id ? "active" : ""}`}
              onClick={() => setSelectedId(agent.id)}
            >
              <span>{agent.name}</span>
              <small>{agent.enabled ? "Activo" : "Pausado"}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="admin-editor">
        <div className="topbar">
          <div>
            <div className="eyebrow">{selected.category}</div>
            <h2>{selected.name}</h2>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={selected.enabled}
              onChange={(event) => patchSelected({ enabled: event.target.checked })}
            />
            Activo
          </label>
        </div>

        <div className="form two-cols">
          <label>
            Nombre
            <input className="input" value={selected.name} onChange={(event) => patchSelected({ name: event.target.value })} />
          </label>
          <label>
            Prioridad
            <input
              className="input"
              type="number"
              value={selected.priority}
              onChange={(event) => patchSelected({ priority: Number(event.target.value) || 1 })}
            />
          </label>
          <label className="span-form">
            Misión
            <textarea className="input textarea" value={selected.mission} onChange={(event) => patchSelected({ mission: event.target.value })} />
          </label>
          <label>
            Lo que debe hacer
            <textarea
              className="input textarea"
              value={lines(selected.rules_do)}
              onChange={(event) => patchSelected({ rules_do: splitLines(event.target.value) })}
            />
          </label>
          <label>
            Lo que no debe hacer
            <textarea
              className="input textarea"
              value={lines(selected.rules_dont)}
              onChange={(event) => patchSelected({ rules_dont: splitLines(event.target.value) })}
            />
          </label>
          <label className="span-form">
            Orden base
            <textarea
              className="input textarea"
              value={selected.order_prompt}
              onChange={(event) => patchSelected({ order_prompt: event.target.value })}
            />
          </label>
        </div>

        <div className="button-row">
          <button className="button" type="button" onClick={saveAgent} disabled={isPending}>
            <Save size={16} />
            Guardar
          </button>
          <button className="button secondary" type="button" onClick={sendOrder}>
            <Send size={16} />
            Dar orden
          </button>
          <button className="button danger" type="button" onClick={deleteAgent} disabled={isPending}>
            <Trash2 size={16} />
            Eliminar
          </button>
        </div>
        {message ? <p className="muted">{message}</p> : null}
      </div>
    </section>
  );
}
