type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type LLMResult = {
  ok: boolean;
  provider: "gemini" | "groq" | "openai" | "anthropic" | "mistral" | "openrouter" | "ocrspace" | "none";
  text: string;
  raw?: unknown;
  error?: string;
};

// NOTA: por defecto ambos modelos apuntan a 2.5-flash porque la mayoría de
// claves de Gemini solo tienen acceso a flash, no a pro. Si tu key tiene
// acceso a pro, fija GEMINI_PRO_MODEL=gemini-2.5-pro en Vercel.
const FAST_MODEL = process.env.GEMINI_FAST_MODEL ?? "gemini-2.5-flash";
const PRO_MODEL = process.env.GEMINI_PRO_MODEL ?? "gemini-2.5-flash";

export async function geminiGenerate(
  parts: GeminiPart[],
  options: {
    model?: "fast" | "pro";
    json?: boolean;
    system?: string;
    temperature?: number;
  } = {},
): Promise<LLMResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, provider: "none", text: "", error: "Gemini key missing" };

  const model = options.model === "pro" ? PRO_MODEL : FAST_MODEL;
  const body: Record<string, unknown> = {
    contents: [{ parts }],
    generationConfig: {
      temperature: options.temperature ?? 0.1,
      maxOutputTokens: 4096,
      ...(options.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (options.system) {
    body.systemInstruction = { parts: [{ text: options.system }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, provider: "gemini", text: "", error: `Gemini ${res.status}: ${errText.slice(0, 240)}` };
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  return { ok: true, provider: "gemini", text, raw: data };
}

export async function groqChat(
  prompt: string,
  options: { model?: "fast" | "pro"; system?: string; json?: boolean; temperature?: number } = {},
): Promise<LLMResult> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { ok: false, provider: "none", text: "", error: "Groq key missing" };

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model === "pro" ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant",
      messages: [
        ...(options.system ? [{ role: "system", content: options.system }] : []),
        { role: "user", content: prompt },
      ],
      temperature: options.temperature ?? 0.1,
      max_tokens: 4096,
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, provider: "groq", text: "", error: `Groq ${res.status}: ${errText.slice(0, 240)}` };
  }
  const data = await res.json();
  return { ok: true, provider: "groq", text: data?.choices?.[0]?.message?.content ?? "", raw: data };
}

export async function openaiChat(
  prompt: string,
  options: { model?: "fast" | "pro"; system?: string; json?: boolean; temperature?: number; images?: { mimeType: string; data: string }[] } = {},
): Promise<LLMResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, provider: "none", text: "", error: "OpenAI key missing" };

  const model = options.model === "pro" ? "gpt-4o" : "gpt-4o-mini";
  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [{ type: "text", text: prompt }];
  for (const img of options.images ?? []) {
    userContent.push({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.data}` } });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        ...(options.system ? [{ role: "system", content: options.system }] : []),
        { role: "user", content: userContent },
      ],
      temperature: options.temperature ?? 0.1,
      max_tokens: 4096,
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, provider: "openai", text: "", error: `OpenAI ${res.status}: ${errText.slice(0, 240)}` };
  }
  const data = await res.json();
  return { ok: true, provider: "openai", text: data?.choices?.[0]?.message?.content ?? "", raw: data };
}

export async function anthropicChat(
  prompt: string,
  options: { model?: "fast" | "pro"; system?: string; temperature?: number; images?: { mimeType: string; data: string }[] } = {},
): Promise<LLMResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { ok: false, provider: "none", text: "", error: "Anthropic key missing" };

  const model =
    options.model === "pro"
      ? process.env.ANTHROPIC_PRO_MODEL ?? "claude-opus-4-5"
      : process.env.ANTHROPIC_FAST_MODEL ?? "claude-haiku-4-5";

  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  for (const img of options.images ?? []) {
    content.unshift({ type: "image", source: { type: "base64", media_type: img.mimeType, data: img.data } });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      temperature: options.temperature ?? 0.1,
      ...(options.system ? { system: options.system } : {}),
      messages: [{ role: "user", content }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, provider: "anthropic", text: "", error: `Anthropic ${res.status}: ${errText.slice(0, 240)}` };
  }
  const data = await res.json();
  const text = (data?.content ?? []).map((b: { type: string; text?: string }) => (b.type === "text" ? b.text ?? "" : "")).join("");
  return { ok: true, provider: "anthropic", text, raw: data };
}

/**
 * Mistral (Pixtral vision · tier gratuito en La Plateforme).
 * https://docs.mistral.ai/capabilities/vision/
 */
export async function mistralChat(
  prompt: string,
  options: { model?: "fast" | "pro"; system?: string; json?: boolean; temperature?: number; images?: { mimeType: string; data: string }[] } = {},
): Promise<LLMResult> {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) return { ok: false, provider: "none", text: "", error: "Mistral key missing" };

  // pixtral-12b-2409 es el modelo de visión gratuito en La Plateforme.
  const model =
    options.model === "pro"
      ? process.env.MISTRAL_PRO_MODEL ?? "pixtral-large-latest"
      : process.env.MISTRAL_FAST_MODEL ?? "pixtral-12b-2409";

  const content: Array<{ type: string; text?: string; image_url?: string }> = [{ type: "text", text: prompt }];
  for (const img of options.images ?? []) {
    content.push({ type: "image_url", image_url: `data:${img.mimeType};base64,${img.data}` });
  }

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        ...(options.system ? [{ role: "system", content: options.system }] : []),
        { role: "user", content },
      ],
      temperature: options.temperature ?? 0.1,
      max_tokens: 4000,
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, provider: "mistral", text: "", error: `Mistral ${res.status}: ${errText.slice(0, 240)}` };
  }
  const data = await res.json();
  return { ok: true, provider: "mistral", text: data?.choices?.[0]?.message?.content ?? "", raw: data };
}

/**
 * OpenRouter — proxy a muchos modelos. Hay modelos con tier ":free" como
 * meta-llama/llama-3.2-11b-vision-instruct:free y google/gemini-2.0-flash-exp:free.
 * https://openrouter.ai/docs
 */
export async function openRouterChat(
  prompt: string,
  options: { model?: string; system?: string; json?: boolean; temperature?: number; images?: { mimeType: string; data: string }[] } = {},
): Promise<LLMResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false, provider: "none", text: "", error: "OpenRouter key missing" };

  const model = options.model ?? process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.2-11b-vision-instruct:free";

  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [{ type: "text", text: prompt }];
  for (const img of options.images ?? []) {
    content.push({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.data}` } });
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://modelo26.app",
      "X-Title": "Modelo 26",
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(options.system ? [{ role: "system", content: options.system }] : []),
        { role: "user", content },
      ],
      temperature: options.temperature ?? 0.1,
      max_tokens: 4000,
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, provider: "openrouter", text: "", error: `OpenRouter ${res.status}: ${errText.slice(0, 240)}` };
  }
  const data = await res.json();
  return { ok: true, provider: "openrouter", text: data?.choices?.[0]?.message?.content ?? "", raw: data };
}

/**
 * OCR.space — extracción pura de texto (sin LLM). Tier gratuito 25k req/mes
 * con API key gratuita "helloworld" (anónima) o registrarte para una propia.
 * Útil como puente: extrae texto del PDF/imagen, luego se pasa a Groq/Gemini
 * para que devuelva el JSON estructurado de la factura.
 * https://ocr.space/ocrapi
 */
export async function ocrSpaceExtract(
  mimeType: string,
  base64: string,
  options: { language?: string } = {},
): Promise<LLMResult> {
  const key = process.env.OCRSPACE_API_KEY ?? "helloworld";
  const form = new FormData();
  form.append("apikey", key);
  form.append("language", options.language ?? "spa");
  form.append("isOverlayRequired", "false");
  form.append("OCREngine", "2");
  form.append("base64Image", `data:${mimeType};base64,${base64}`);

  const res = await fetch("https://api.ocr.space/parse/image", { method: "POST", body: form });
  if (!res.ok) {
    return { ok: false, provider: "ocrspace", text: "", error: `OCR.space ${res.status}` };
  }
  const data = await res.json();
  if (data?.IsErroredOnProcessing) {
    return { ok: false, provider: "ocrspace", text: "", error: (data?.ErrorMessage ?? []).join(" ").slice(0, 240) };
  }
  const text = (data?.ParsedResults ?? []).map((p: { ParsedText?: string }) => p.ParsedText ?? "").join("\n");
  return { ok: true, provider: "ocrspace", text, raw: data };
}

/**
 * Orden de proveedores:
 * - OCR / visión: Gemini (flash, único que soporta imágenes con tus claves
 *   actuales) → si Gemini falla y tienes Anthropic/OpenAI, prueba esos.
 *   Groq se salta porque no soporta visión.
 * - Texto puro / JSON: Gemini flash → Groq (llama 70B pro → llama 8B fast).
 *   Anthropic / OpenAI son fallback adicional si los configuras.
 */
export async function bestAvailableJSON(
  prompt: string,
  options: { system?: string; images?: { mimeType: string; data: string }[]; preferVision?: boolean } = {},
): Promise<LLMResult> {
  const hasImages = (options.images?.length ?? 0) > 0;
  const order: Array<{ name: string; run: () => Promise<LLMResult> }> = [];

  // 1) Gemini flash primero (gratuito, visión incluida).
  if (process.env.GEMINI_API_KEY) {
    const buildGemini = (model: "fast" | "pro") => () =>
      geminiGenerate(
        [
          ...(options.images ?? []).map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
          { text: prompt },
        ],
        { model, json: true, system: options.system },
      );
    order.push({ name: "gemini-flash", run: buildGemini("fast") });
    if ((process.env.GEMINI_PRO_MODEL ?? "gemini-2.5-flash") !== "gemini-2.5-flash") {
      order.push({ name: "gemini-pro", run: buildGemini("pro") });
    }
  }

  // 2) Mistral Pixtral (gratuito con visión en La Plateforme).
  if (process.env.MISTRAL_API_KEY) {
    order.push({
      name: "mistral-pixtral-12b",
      run: () => mistralChat(prompt, { model: "fast", system: options.system, json: true, images: options.images }),
    });
    if (process.env.MISTRAL_PRO_MODEL) {
      order.push({
        name: "mistral-pixtral-large",
        run: () => mistralChat(prompt, { model: "pro", system: options.system, json: true, images: options.images }),
      });
    }
  }

  // 3) OpenRouter con modelo free (Llama 3.2 Vision o Gemini Flash free).
  if (process.env.OPENROUTER_API_KEY) {
    order.push({
      name: "openrouter-llama-vision-free",
      run: () =>
        openRouterChat(prompt, {
          model: "meta-llama/llama-3.2-11b-vision-instruct:free",
          system: options.system,
          json: true,
          images: options.images,
        }),
    });
    if (hasImages) {
      order.push({
        name: "openrouter-gemini-free",
        run: () =>
          openRouterChat(prompt, {
            model: "google/gemini-2.0-flash-exp:free",
            system: options.system,
            json: true,
            images: options.images,
          }),
      });
    }
  }

  // 4) OCR.space → Groq: extrae texto del documento y luego pide JSON a Groq.
  //    Solo se intenta si: hay imagen, y tenemos Groq (o cualquier text-only LLM).
  if (hasImages && options.images && options.images.length > 0 && process.env.GROQ_API_KEY) {
    order.push({
      name: "ocrspace-then-groq",
      run: async () => {
        const img = options.images![0];
        const ocr = await ocrSpaceExtract(img.mimeType, img.data);
        if (!ocr.ok || !ocr.text.trim()) return { ok: false, provider: "ocrspace", text: "", error: ocr.error ?? "OCR.space vacío" };
        const enriched = `${prompt}\n\nTexto extraído del documento (OCR):\n---\n${ocr.text.slice(0, 12000)}\n---\n\nResponde SOLO con el JSON pedido.`;
        return await groqChat(enriched, { model: "pro", system: options.system, json: true });
      },
    });
  }

  // 5) Groq texto puro (cuando no hay imagen).
  if (!hasImages && process.env.GROQ_API_KEY) {
    order.push({
      name: "groq-llama-70b",
      run: () => groqChat(prompt, { model: "pro", system: options.system, json: true }),
    });
    order.push({
      name: "groq-llama-8b",
      run: () => groqChat(prompt, { model: "fast", system: options.system, json: true }),
    });
  }

  // 6) OpenAI / Anthropic — solo si están configurados.
  if (process.env.OPENAI_API_KEY) {
    order.push({
      name: "openai",
      run: () => openaiChat(prompt, { model: "pro", system: options.system, json: true, images: options.images }),
    });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    order.push({
      name: "anthropic",
      run: () =>
        anthropicChat(prompt + "\n\nResponde ÚNICAMENTE con JSON válido, sin texto adicional.", {
          model: "pro",
          system: options.system,
          images: options.images,
        }),
    });
  }

  if (order.length === 0) {
    return {
      ok: false,
      provider: "none",
      text: "",
      error:
        "No hay proveedor IA configurado. Para OCR (visión) configura una de estas keys en Vercel (todas tienen tier gratuito): " +
        "GEMINI_API_KEY · MISTRAL_API_KEY (Pixtral) · OPENROUTER_API_KEY (Llama Vision free) · OCRSPACE_API_KEY. " +
        "Para texto basta GROQ_API_KEY.",
    };
  }

  const errors: string[] = [];
  for (const step of order) {
    const result = await step.run();
    if (result.ok && result.text) {
      if (process.env.NODE_ENV !== "production") {
        console.log(`[llm] OK via ${step.name}`);
      }
      return result;
    }
    errors.push(`${step.name}: ${result.error ?? "respuesta vacía"}`);
  }

  return {
    ok: false,
    provider: "none",
    text: "",
    error: `Todos los proveedores fallaron — ${errors.join(" | ").slice(0, 600)}`,
  };
}

export function safeJSON<T = unknown>(text: string): T | null {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "");
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}
