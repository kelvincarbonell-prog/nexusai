import { bestAvailableJSON, safeJSON } from "@/lib/agents/llm";

export type ExtractedInvoice = {
  vendor_name?: string;
  vendor_nif?: string;
  invoice_number?: string;
  issue_date?: string;
  due_date?: string;
  concepto?: string;
  base?: number;
  iva?: number;
  iva_pct?: number;
  irpf?: number;
  irpf_pct?: number;
  total?: number;
  currency?: string;
  payment_method?: string;
  iban?: string;
  notes?: string;
};

const EXTRACTION_SCHEMA_PROMPT = `Extrae los datos clave de la factura del documento adjunto y devuelve un JSON con esta forma EXACTA:
{
  "vendor_name": string,
  "vendor_nif": string,
  "invoice_number": string,
  "issue_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD" o null,
  "concepto": string descriptivo del bien o servicio,
  "base": número (base imponible, sin IVA),
  "iva": número (importe de IVA),
  "iva_pct": número (porcentaje de IVA, ej. 21),
  "irpf": número o 0,
  "irpf_pct": número o 0,
  "total": número (importe total a pagar),
  "currency": "EUR" por defecto,
  "payment_method": string o null,
  "iban": string o null,
  "notes": string opcional con observaciones
}
Reglas:
- Si un dato no aparece en el documento, omítelo del JSON.
- NIF/CIF español: formato típico letra+8 dígitos o 8 dígitos+letra; mantén el formato del documento.
- Importes con dos decimales y punto decimal (no coma).
- Fechas siempre ISO YYYY-MM-DD.
- Solo el JSON. Sin texto previo ni posterior.`;

export async function extractInvoiceFromImage(
  mimeType: string,
  base64: string,
): Promise<{ ok: boolean; data?: ExtractedInvoice; raw?: string; error?: string; provider: string }> {
  const res = await bestAvailableJSON(EXTRACTION_SCHEMA_PROMPT, {
    images: [{ mimeType, data: base64 }],
    preferVision: true,
  });
  if (!res.ok) return { ok: false, error: res.error, provider: res.provider };
  const data = safeJSON<ExtractedInvoice>(res.text);
  if (!data) return { ok: false, error: "Respuesta IA no parseable", raw: res.text, provider: res.provider };
  return { ok: true, data: normaliseExtraction(data), raw: res.text, provider: res.provider };
}

export async function extractInvoiceFromText(rawText: string) {
  const prompt = `${EXTRACTION_SCHEMA_PROMPT}\n\nTexto de la factura:\n---\n${rawText.slice(0, 14000)}`;
  const res = await bestAvailableJSON(prompt);
  if (!res.ok) return { ok: false, error: res.error, provider: res.provider };
  const data = safeJSON<ExtractedInvoice>(res.text);
  if (!data) return { ok: false, error: "Respuesta IA no parseable", raw: res.text, provider: res.provider };
  return { ok: true, data: normaliseExtraction(data), raw: res.text, provider: res.provider };
}

function normaliseExtraction(data: ExtractedInvoice): ExtractedInvoice {
  const clean = { ...data };
  if (clean.vendor_nif) clean.vendor_nif = String(clean.vendor_nif).toUpperCase().replace(/\s+/g, "");
  if (typeof clean.base === "string") clean.base = Number(clean.base);
  if (typeof clean.iva === "string") clean.iva = Number(clean.iva);
  if (typeof clean.total === "string") clean.total = Number(clean.total);
  if (typeof clean.irpf === "string") clean.irpf = Number(clean.irpf);
  if (!clean.currency) clean.currency = "EUR";
  return clean;
}

export function confidenceScore(data: ExtractedInvoice): number {
  let score = 0;
  if (data.vendor_name) score += 15;
  if (data.vendor_nif) score += 15;
  if (data.invoice_number) score += 10;
  if (data.issue_date) score += 10;
  if (typeof data.total === "number" && data.total > 0) score += 25;
  if (typeof data.base === "number" && data.base > 0) score += 10;
  if (typeof data.iva === "number") score += 5;
  if (data.concepto) score += 10;

  if (typeof data.base === "number" && typeof data.iva === "number" && typeof data.total === "number") {
    const expected = Number((data.base + data.iva - (data.irpf ?? 0)).toFixed(2));
    const delta = Math.abs(expected - data.total);
    if (delta <= 0.05) score = Math.min(100, score + 5);
    else if (delta > 1) score = Math.max(0, score - 10);
  }
  return Math.min(100, score);
}
