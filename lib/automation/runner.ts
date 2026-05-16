/**
 * Runner de reglas de automatización.
 * Evalúa todas las reglas activas para un evento concreto y ejecuta las
 * que matcheen los filtros.
 *
 * Acciones soportadas (MVP):
 *  - email_recordatorio: simulado (loguea en automation_executions)
 *  - crear_tarea: inserta en tabla tareas
 *  - notificar_gestor: inserta en push_messages
 *  - asignar_categoria: actualiza metadata.cuenta_pgc del gasto
 *  - webhook: hace POST al webhook configurado
 *  - whatsapp: simulado
 */

import { createSupabaseAdmin } from "@/lib/supabase/admin";

export type TriggerPayload = {
  trigger_event: string;
  empresa_id?: string;
  factura?: { id: string; total: number; dias_vencida?: number; contacto_nombre?: string };
  gasto?: { id: string; total: number; concepto?: string };
  trabajador?: { id: string; nombre: string };
  modelo?: { codigo: string; ejercicio: number; periodo: string; dias_para_vencer: number };
  custom?: Record<string, unknown>;
};

export async function runRulesForEvent(payload: TriggerPayload): Promise<{ matched: number; executed: number; failed: number }> {
  const admin = createSupabaseAdmin();
  const { data: rules } = await admin
    .from("automation_rules")
    .select("*")
    .eq("trigger_event", payload.trigger_event)
    .eq("estado", "activa")
    .eq("empresa_id", payload.empresa_id ?? "");

  let executed = 0;
  let failed = 0;

  for (const rule of rules ?? []) {
    try {
      // Aplica filtros: comparación simple campo-valor
      const filters = (rule.trigger_filters ?? {}) as Record<string, unknown>;
      if (!matchesFilters(filters, payload)) {
        await admin.from("automation_executions").insert({
          rule_id: rule.id,
          empresa_id: payload.empresa_id ?? null,
          trigger_payload: payload as unknown as Record<string, unknown>,
          action_result: { reason: "filtered_out" },
          status: "skipped",
        });
        continue;
      }

      const result = await executeAction(rule.action_type, rule.action_config ?? {}, payload, admin);

      await admin.from("automation_executions").insert({
        rule_id: rule.id,
        empresa_id: payload.empresa_id ?? null,
        trigger_payload: payload as unknown as Record<string, unknown>,
        action_result: result,
        status: "success",
      });
      await admin
        .from("automation_rules")
        .update({
          num_ejecuciones: (rule.num_ejecuciones ?? 0) + 1,
          ultima_ejecucion: new Date().toISOString(),
        })
        .eq("id", rule.id);
      executed++;
    } catch (e: unknown) {
      failed++;
      await admin.from("automation_executions").insert({
        rule_id: rule.id,
        empresa_id: payload.empresa_id ?? null,
        trigger_payload: payload as unknown as Record<string, unknown>,
        action_result: {},
        status: "failed",
        error: e instanceof Error ? e.message : "Error",
      });
    }
  }

  return { matched: rules?.length ?? 0, executed, failed };
}

function matchesFilters(filters: Record<string, unknown>, payload: TriggerPayload): boolean {
  for (const [key, expected] of Object.entries(filters)) {
    if (key === "min_total" && payload.factura) {
      if (Number(payload.factura.total) < Number(expected)) return false;
    }
    if (key === "min_dias_vencida" && payload.factura?.dias_vencida != null) {
      if (Number(payload.factura.dias_vencida) < Number(expected)) return false;
    }
    if (key === "categoria" && payload.gasto?.concepto) {
      if (!payload.gasto.concepto.toLowerCase().includes(String(expected).toLowerCase())) return false;
    }
  }
  return true;
}

async function executeAction(
  type: string,
  config: Record<string, unknown>,
  payload: TriggerPayload,
  admin: ReturnType<typeof createSupabaseAdmin>,
): Promise<Record<string, unknown>> {
  if (type === "crear_tarea") {
    const titulo = (config.titulo as string | undefined) ?? `Tarea automática · ${payload.trigger_event}`;
    const prioridad = (config.prioridad as "baja" | "media" | "alta" | "urgente" | undefined) ?? "media";
    const { data } = await admin
      .from("tareas")
      .insert({
        empresa_id: payload.empresa_id ?? null,
        titulo,
        prioridad,
        descripcion: JSON.stringify(payload).slice(0, 1000),
        origen: `regla:${payload.trigger_event}`,
        estado: "pendiente",
      })
      .select("id")
      .single();
    return { tarea_id: data?.id };
  }
  if (type === "webhook") {
    const url = config.url as string | undefined;
    if (!url) throw new Error("URL de webhook no configurada");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: payload.trigger_event, payload }),
    });
    return { url, status: res.status };
  }
  if (type === "notificar_gestor") {
    // Necesitaríamos el gestor_id de la empresa
    if (payload.empresa_id) {
      const { data: e } = await admin.from("empresas").select("gestor_id").eq("id", payload.empresa_id).single();
      if (e?.gestor_id) {
        await admin.from("push_messages").insert({
          user_id: e.gestor_id,
          empresa_id: payload.empresa_id,
          title: (config.title as string | undefined) ?? `Aviso · ${payload.trigger_event}`,
          body: (config.body as string | undefined) ?? JSON.stringify(payload).slice(0, 200),
          payload: payload as unknown as Record<string, unknown>,
        });
        return { notificado: true };
      }
    }
    return { notificado: false };
  }
  if (type === "email_recordatorio" || type === "whatsapp") {
    // En MVP solo loggeamos. El envío real lo hace un servicio externo.
    return { simulado: true, type, destinatario: config.destinatario, mensaje: config.mensaje };
  }
  if (type === "asignar_categoria") {
    if (payload.gasto?.id) {
      const cuenta = config.cuenta_pgc as string | undefined;
      if (cuenta) {
        const { data: g } = await admin.from("gastos").select("metadata").eq("id", payload.gasto.id).single();
        const meta = (g?.metadata ?? {}) as Record<string, unknown>;
        await admin.from("gastos").update({ metadata: { ...meta, cuenta_pgc: cuenta, asignado_por: "regla_automatica" } }).eq("id", payload.gasto.id);
        return { cuenta_pgc: cuenta };
      }
    }
    return { aplicado: false };
  }
  return { tipo: type, status: "no_implementado" };
}
