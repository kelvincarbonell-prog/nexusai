type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type LLMResult = {
  ok: boolean;
  provider: "gemini" | "groq" | "openai" | "anthropic" | "none";
  text: string;
  raw?: unknown;
  error?: string;
};

const FAST_MODEL = "gemini-2.5-flash";
const PRO_MODEL = "gemini-2.5-pro";

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

export async function bestAvailableJSON(
  prompt: string,
  options: { system?: string; images?: { mimeType: string; data: string }[]; preferVision?: boolean } = {},
): Promise<LLMResult> {
  const hasImages = (options.images?.length ?? 0) > 0;
  const order: Array<() => Promise<LLMResult>> = [];

  if (process.env.OPENAI_API_KEY) {
    order.push(() => openaiChat(prompt, { model: "pro", system: options.system, json: true, images: options.images }));
  }
  if (process.env.ANTHROPIC_API_KEY) {
    order.push(() =>
      anthropicChat(prompt + "\n\nResponde ÚNICAMENTE con JSON válido, sin texto adicional.", {
        model: "pro",
        system: options.system,
        images: options.images,
      }),
    );
  }
  if (process.env.GEMINI_API_KEY) {
    order.push(() =>
      geminiGenerate(
        [
          ...(options.images ?? []).map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
          { text: prompt },
        ],
        { model: "pro", json: true, system: options.system },
      ),
    );
  }
  if (!hasImages && process.env.GROQ_API_KEY) {
    order.push(() => groqChat(prompt, { model: "pro", system: options.system, json: true }));
  }

  let lastErr: LLMResult | null = null;
  for (const run of order) {
    const result = await run();
    if (result.ok && result.text) return result;
    lastErr = result;
  }
  return lastErr ?? { ok: false, provider: "none", text: "", error: "No hay proveedor IA configurado" };
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
