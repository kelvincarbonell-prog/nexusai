import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";

const AiRequest = z.object({
  prompt: z.string().min(1).max(12000),
  system: z.string().max(4000).optional(),
  model: z.enum(["fast", "pro"]).default("fast"),
  json: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = AiRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Body inválido");

  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if (!geminiKey && !groqKey) return jsonError("No hay proveedor IA configurado", 503);

  const { prompt, system, model, json } = parsed.data;
  const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;

  if (geminiKey) {
    const geminiModel = model === "pro" ? "gemini-2.5-pro" : "gemini-2.5-flash";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 4000,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      return NextResponse.json({ ok: true, provider: "gemini", text });
    }
  }

  if (groqKey) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model === "pro" ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant",
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: prompt },
        ],
        temperature: 0.25,
        max_tokens: 4000,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ ok: true, provider: "groq", text: data?.choices?.[0]?.message?.content ?? "" });
    }
  }

  return jsonError("No se pudo obtener respuesta IA", 502);
}
