import { bestAvailableJSON, safeJSON } from "@/lib/agents/llm";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;

export type CategorizationInput = {
  empresa_id: string;
  vendor_name?: string;
  vendor_nif?: string;
  concepto?: string;
  total?: number;
};

export type CategorizationResult = {
  pgc_account_code: string;
  pgc_account_id?: string;
  pgc_account_name?: string;
  confidence: number;
  source: "history" | "rule" | "ai";
  explanation?: string;
};

// 1. Try history first (same vendor in this company → reuse). Boost confidence with frequency.
async function lookupHistory(admin: SupabaseAdmin, input: CategorizationInput) {
  if (!input.vendor_nif && !input.vendor_name) return null;
  const query = admin
    .from("expense_categorization_history")
    .select("pgc_account_code")
    .eq("empresa_id", input.empresa_id);
  const result = input.vendor_nif
    ? await query.eq("vendor_nif", input.vendor_nif).limit(50)
    : await query.ilike("vendor_name", `%${(input.vendor_name ?? "").slice(0, 40)}%`).limit(50);
  if (result.error || !result.data || result.data.length === 0) return null;
  const counts = new Map<string, number>();
  for (const row of result.data) {
    counts.set(row.pgc_account_code, (counts.get(row.pgc_account_code) ?? 0) + 1);
  }
  const [topCode, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const confidence = Math.min(99, 60 + topCount * 8);
  return { code: topCode, confidence };
}

// 2. Lightweight rule engine for common Spanish expense patterns.
const RULES: { test: (text: string) => boolean; code: string; label: string }[] = [
  { test: (t) => /telef[oó]nica|movistar|orange|vodafone|jazztel|yoigo|m[aá]smovil/.test(t), code: "629", label: "Comunicaciones" },
  { test: (t) => /endesa|iberdrola|naturgy|repsol electricidad|edp|electricidad|gas natural/.test(t), code: "628", label: "Suministros" },
  { test: (t) => /amazon|aliexpress|pccomponentes|fnac|media markt|el corte ingl[eé]s|carrefour/.test(t), code: "629", label: "Otros servicios" },
  { test: (t) => /correos|seur|mrw|nacex|gls|dhl|ups|transporte/.test(t), code: "624", label: "Transportes" },
  { test: (t) => /renfe|iberia|vueling|ryanair|air europa|booking|airbnb|hotel|tren|avi[oó]n/.test(t), code: "629", label: "Viajes" },
  { test: (t) => /repsol|cepsa|galp|bp|shell|gasolinera|carburante|combustible/.test(t), code: "628", label: "Suministros / Carburante" },
  { test: (t) => /asesor[ií]a|notar[ií]a|abogad|registr/.test(t), code: "623", label: "Servicios profesionales" },
  { test: (t) => /seguro|mapfre|axa|allianz|mutua|catalana occidente/.test(t), code: "625", label: "Primas de seguros" },
  { test: (t) => /alquiler|renta arrendamiento|arrendamient/.test(t), code: "621", label: "Arrendamientos" },
  { test: (t) => /publicidad|marketing|google ads|meta ads|facebook ads/.test(t), code: "627", label: "Publicidad y propaganda" },
  { test: (t) => /reparaci[oó]n|mantenimient|conserva/.test(t), code: "622", label: "Reparaciones y conservación" },
  { test: (t) => /banco|comisi[oó]n bancaria|caixa|sabadell|santander|bbva|bankinter/.test(t), code: "626", label: "Servicios bancarios" },
  { test: (t) => /material oficina|papeler[ií]a|t[oó]ner|impresi[oó]n/.test(t), code: "629", label: "Material de oficina" },
  { test: (t) => /software|microsoft|adobe|github|aws|google workspace|notion|figma|saas|suscripci[oó]n/.test(t), code: "629", label: "Software / SaaS" },
];

function matchRule(input: CategorizationInput) {
  const text = [input.vendor_name, input.concepto].filter(Boolean).join(" ").toLowerCase();
  if (!text) return null;
  for (const rule of RULES) {
    if (rule.test(text)) return { code: rule.code, label: rule.label, confidence: 78 };
  }
  return null;
}

// 3. LLM fallback. Receives the company PGC chart and asks for a single 3-digit group.
async function aiSuggest(admin: SupabaseAdmin, input: CategorizationInput) {
  const { data: accounts } = await admin
    .from("pgc_accounts")
    .select("code,name,is_expense")
    .or(`empresa_id.is.null,empresa_id.eq.${input.empresa_id}`)
    .order("code");
  const palette = (accounts ?? [])
    .filter((a: { is_expense?: boolean; code: string }) => a.is_expense || a.code.startsWith("6"))
    .slice(0, 80)
    .map((a: { code: string; name: string }) => `${a.code} ${a.name}`)
    .join("\n");

  const prompt = `Eres el agente categorizador de gastos de NexusAI para asesorías españolas (PGC PYMES).
Devuelve SOLO un JSON con: { "code": "XXX", "confidence": 0-100, "explanation": "..." }
- code: código de cuenta PGC más adecuado (3-4 dígitos, grupo 6).
- Usa los códigos válidos del catálogo proporcionado.

Catálogo (código  nombre):
${palette || "Sin catálogo. Usa 600-629 estándar."}

Gasto:
- Proveedor: ${input.vendor_name ?? "?"}
- NIF: ${input.vendor_nif ?? "?"}
- Concepto: ${input.concepto ?? "?"}
- Importe: ${input.total ?? "?"} EUR`;

  const res = await bestAvailableJSON(prompt);
  if (!res.ok) return null;
  const parsed = safeJSON<{ code: string; confidence?: number; explanation?: string }>(res.text);
  if (!parsed?.code) return null;
  return {
    code: parsed.code,
    confidence: Math.min(95, Math.max(40, parsed.confidence ?? 70)),
    explanation: parsed.explanation,
  };
}

export async function categorizeExpense(input: CategorizationInput): Promise<CategorizationResult | null> {
  const admin = createSupabaseAdmin();
  const history = await lookupHistory(admin, input);
  let chosen: { code: string; confidence: number; source: CategorizationResult["source"]; explanation?: string } | null = null;
  if (history) chosen = { ...history, source: "history" };

  if (!chosen) {
    const rule = matchRule(input);
    if (rule) chosen = { code: rule.code, confidence: rule.confidence, source: "rule", explanation: rule.label };
  }

  if (!chosen) {
    const ai = await aiSuggest(admin, input);
    if (ai) chosen = { code: ai.code, confidence: ai.confidence, source: "ai", explanation: ai.explanation };
  }

  if (!chosen) return null;

  const { data: account } = await admin
    .from("pgc_accounts")
    .select("id,code,name")
    .or(`empresa_id.is.null,empresa_id.eq.${input.empresa_id}`)
    .eq("code", chosen.code)
    .maybeSingle();

  return {
    pgc_account_code: chosen.code,
    pgc_account_id: account?.id,
    pgc_account_name: account?.name,
    confidence: chosen.confidence,
    source: chosen.source,
    explanation: chosen.explanation,
  };
}
