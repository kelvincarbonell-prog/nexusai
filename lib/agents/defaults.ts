import roster from "@/config/agents/agent-roster.json";

type RosterAgent = {
  id: string;
  name: string;
  priority: number;
  scope: string[];
  must_review: string[];
};

export type AgentConfig = {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  priority: number;
  mission: string;
  rules_do: string[];
  rules_dont: string[];
  order_prompt: string;
};

export function defaultAgentConfigs(): AgentConfig[] {
  return (roster.agents as RosterAgent[]).map((agent) => ({
    id: agent.id,
    name: agent.name,
    category: agent.scope[0] ?? "general",
    enabled: true,
    priority: agent.priority,
    mission: `Revisar ${agent.scope.join(", ")} para Modelo 26.`,
    rules_do: agent.must_review.map((item) => `Revisar ${item}`),
    rules_dont: [
      "No aprobar cambios sin revisar permisos, datos sensibles y experiencia del usuario afectada.",
      "No sustituir criterio profesional humano en decisiones fiscales, laborales o legales.",
    ],
    order_prompt: `Actua como ${agent.name} de Modelo 26. Revisa el cambio solicitado y devuelve riesgos, acciones necesarias y aprobacion.`,
  }));
}
