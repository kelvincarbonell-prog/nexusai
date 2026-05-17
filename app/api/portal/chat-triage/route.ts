import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { bestAvailableJSON } from "@/lib/agents/llm";
import { CATALOGO_SOLICITUDES } from "@/lib/solicitudes/catalogo";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  message: z.string().min(2).max(2000),
});

type TriageResult = {
  intent: string;
  suggested_solicitud_keys: string[];
  quick_answer: string;
  suggested_actions: Array<
    | { kind: "crear_solicitud"; label: string; solicitud_key: string }
    | { kind: "hablar_gestor"; label: string }
    | { kind: "ver_documento"; label: string; doc_tipo: string }
  >;
  should_escalate: boolean;
  confianza: number;
};

const HEURISTICAS: Array<{ keywords: RegExp; intent: string; solicitudes: string[]; answer: string }> = [
  {
    keywords: /\b(alta|contrat[ar]?|empleo|fichar)\b.*\b(trabajador|empleado|persona)\b|nuevo\s+empleado/i,
    intent: "alta_trabajador",
    solicitudes: ["alta_ss"],
    answer:
      "Para dar de alta a un trabajador necesito su **DNI, fecha de nacimiento, dirección, tipo de contrato y salario**. Te abro la solicitud y lo cierro yo con tu gestor en menos de 24h.",
  },
  {
    keywords: /\b(baj[ao]|despido|finaliza[ar]?|cese)\b.*\b(trabajador|empleado)\b/i,
    intent: "baja_trabajador",
    solicitudes: ["baja_ss", "finiquito"],
    answer:
      "Para la baja necesito el **motivo** (fin de contrato, despido objetivo/disciplinario, baja voluntaria) y la **fecha**. Si quieres calculo el finiquito al mismo tiempo.",
  },
  {
    keywords: /\b(baj[ao]\s+m[eé]dica|enfermedad|IT|accidente)\b/i,
    intent: "parte_it",
    solicitudes: ["it_baja"],
    answer:
      "Para tramitar la baja médica necesito el **parte del médico** y la **fecha de inicio**. Hay plazo legal (3 días para enfermedad común, 24h si es accidente de trabajo).",
  },
  {
    keywords: /\b(vacacion|festivo|libre)\b/i,
    intent: "vacaciones",
    solicitudes: ["vacaciones"],
    answer:
      "Para vacaciones dime las **fechas exactas** y el **trabajador**. Te confirmo el saldo disponible y comunicamos al resto del equipo.",
  },
  {
    keywords: /\b(nomin[ao]|salar|pago)\b/i,
    intent: "nomina",
    solicitudes: ["nominas"],
    answer:
      "Las nóminas se publican en tu portal cada mes. Si necesitas la de un mes concreto, te la genero ahora.",
  },
  {
    keywords: /\b(iva|303|trimestre)\b/i,
    intent: "iva",
    solicitudes: ["iva_trimestral"],
    answer:
      "Para el IVA trimestral necesito que estén **subidas todas las facturas del trimestre**. Si te falta alguna, súbela al lector de gastos y la incluyo.",
  },
  {
    keywords: /\b(renta|declaraci[óo]n|100)\b/i,
    intent: "renta",
    solicitudes: ["renta"],
    answer:
      "Para tu Renta necesito **borrador AEAT, certificado retenciones y datos de hipoteca/donaciones**. Hay tiempo hasta el 30 de junio.",
  },
  {
    keywords: /\b(autonomo|aut[óo]nom[oa])\b.*\b(alta|inicio|empezar)\b|alta\s+autonom/i,
    intent: "alta_autonomo",
    solicitudes: ["alta_autonomo"],
    answer:
      "Para darte de alta como autónomo necesito tu **DNI, epígrafe IAE/CNAE, dirección fiscal y fecha de inicio**. Tarda 24-48h en estar operativo en AEAT y SS.",
  },
  {
    keywords: /\b(factur[ar]?\s+rect|anular|abono)\b/i,
    intent: "factura_rectificativa",
    solicitudes: ["factura_rectificativa"],
    answer:
      "Para rectificar una factura dime el **número original** y el **motivo del cambio**. La rectificativa va con número de serie diferente.",
  },
  {
    keywords: /\b(retenci[óo]n|111|115)\b/i,
    intent: "retenciones",
    solicitudes: ["retenciones_111", "alquileres_115"],
    answer:
      "Las retenciones se ingresan cada trimestre. El 111 si tienes trabajadores o profesionales, el 115 si pagas alquiler de local.",
  },
  {
    keywords: /\b(347)\b/i,
    intent: "modelo_347",
    solicitudes: ["modelo_347"],
    answer:
      "El 347 es anual (febrero) y declara operaciones >3.005,06€ con cada tercero. Yo lo calculo automáticamente desde tus facturas.",
  },
  {
    keywords: /\b(precio|cuanto|cuesta|tarifa|presupuesto)\b/i,
    intent: "presupuesto",
    solicitudes: ["presupuesto"],
    answer:
      "Te pido presupuesto detallado a tu gestor. Indícame qué servicio te interesa (alta autónomo, gestión mensual, declaración renta, asesoramiento…).",
  },
];

function detectarHeuristica(message: string): TriageResult | null {
  for (const h of HEURISTICAS) {
    if (h.keywords.test(message)) {
      const sugeridas = h.solicitudes.filter((k) => CATALOGO_SOLICITUDES.some((s) => s.key === k));
      const acciones: TriageResult["suggested_actions"] = sugeridas.map((k) => {
        const cat = CATALOGO_SOLICITUDES.find((s) => s.key === k);
        return { kind: "crear_solicitud" as const, label: `Crear solicitud: ${cat?.label ?? k}`, solicitud_key: k };
      });
      acciones.push({ kind: "hablar_gestor", label: "Hablar con un asesor" });
      return {
        intent: h.intent,
        suggested_solicitud_keys: sugeridas,
        quick_answer: h.answer,
        suggested_actions: acciones,
        should_escalate: false,
        confianza: 0.85,
      };
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  // 1. Intento heurístico rápido (sin coste IA)
  const heuristica = detectarHeuristica(parsed.data.message);
  if (heuristica && heuristica.confianza >= 0.8) {
    return NextResponse.json({ ok: true, source: "heuristic", ...heuristica });
  }

  // 2. Fallback IA: clasifica el mensaje
  const catalogo = CATALOGO_SOLICITUDES.map((s) => `${s.key} (${s.grupo}): ${s.label}`).join("\n");
  const prompt = `Eres un asistente de una gestoría española. Recibes un mensaje de un cliente y debes clasificarlo según este catálogo de tipos de solicitud:

${catalogo}

Mensaje del cliente:
"""${parsed.data.message.slice(0, 1500)}"""

Devuelve SOLO JSON con esta forma exacta:
{
  "intent": "texto corto del tema detectado",
  "suggested_solicitud_keys": ["clave1", "clave2"],
  "quick_answer": "respuesta breve útil en español, máximo 2 frases, indicando qué datos necesita o cómo proceder",
  "should_escalate": false,
  "confianza": 0.0
}

- "suggested_solicitud_keys" deben ser claves exactas del catálogo (o lista vacía si no encaja ninguna).
- "should_escalate" es true si la pregunta requiere análisis personalizado (recursos, situación atípica, queja).
- "confianza" entre 0 y 1. Si <0.6 dejas should_escalate=true.
- "quick_answer" en tono cercano pero profesional. No prometas plazos exactos.
- Si el mensaje es un saludo o sin contenido, intent="saludo", suggested_solicitud_keys=[], should_escalate=false.`;

  try {
    const llm = await bestAvailableJSON(prompt);
    if (llm.ok && llm.text) {
      // Extrae JSON del texto (puede venir envuelto en ```json fences)
      const match = llm.text.match(/\{[\s\S]*\}/);
      const json = match ? JSON.parse(match[0]) : null;
      if (json) {
        const keys: string[] = Array.isArray(json.suggested_solicitud_keys) ? json.suggested_solicitud_keys : [];
        const sugeridas = keys.filter((k: string) => CATALOGO_SOLICITUDES.some((s) => s.key === k));
        const acciones: TriageResult["suggested_actions"] = sugeridas.map((k: string) => {
          const cat = CATALOGO_SOLICITUDES.find((s) => s.key === k);
          return { kind: "crear_solicitud" as const, label: `Crear solicitud: ${cat?.label ?? k}`, solicitud_key: k };
        });
        acciones.push({ kind: "hablar_gestor", label: "Hablar con un asesor" });
        const conf = Number(json.confianza ?? 0.5);
        return NextResponse.json({
          ok: true,
          source: "ai",
          intent: String(json.intent ?? "general"),
          suggested_solicitud_keys: sugeridas,
          quick_answer: String(json.quick_answer ?? "Tu gestor recibe tu consulta. Te respondemos en breve."),
          suggested_actions: acciones,
          should_escalate: Boolean(json.should_escalate) || conf < 0.6,
          confianza: conf,
        });
      }
    }
  } catch {
    // ignora, cae al fallback
  }

  // 3. Fallback final si no hay IA disponible
  return NextResponse.json({
    ok: true,
    source: "fallback",
    intent: "general",
    suggested_solicitud_keys: [],
    quick_answer: "He recibido tu mensaje. Tu gestor te responderá en breve.",
    suggested_actions: [{ kind: "hablar_gestor", label: "Hablar con un asesor" }],
    should_escalate: true,
    confianza: 0.2,
  });
}
