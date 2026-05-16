/**
 * Cliente Stripe minimal. Usa la REST API directamente (form-encoded) para evitar
 * la dependencia 'stripe' SDK y mantener el bundle pequeño.
 * Requiere STRIPE_SECRET_KEY en env.
 */

const STRIPE_BASE = "https://api.stripe.com/v1";

function encodeForm(obj: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) params.append(k, String(v));
  }
  return params.toString();
}

async function stripeFetch<T = unknown>(path: string, body?: Record<string, string | number | undefined>): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY no configurada");
  const res = await fetch(`${STRIPE_BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? encodeForm(body) : undefined,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Stripe ${res.status}: ${errText.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export type CheckoutSession = {
  id: string;
  url: string;
  payment_intent: string | null;
};

export async function createCheckoutSession(input: {
  amountCents: number;
  currency: string;
  description: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}): Promise<CheckoutSession> {
  const body: Record<string, string | number> = {
    mode: "payment",
    "line_items[0][price_data][currency]": input.currency.toLowerCase(),
    "line_items[0][price_data][product_data][name]": input.description,
    "line_items[0][price_data][unit_amount]": input.amountCents,
    "line_items[0][quantity]": 1,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  };
  if (input.customerEmail) body.customer_email = input.customerEmail;
  for (const [k, v] of Object.entries(input.metadata ?? {})) {
    body[`metadata[${k}]`] = v;
  }
  const res = await stripeFetch<CheckoutSession>("/checkout/sessions", body);
  return res;
}

/**
 * Verificación criptográfica del webhook Stripe usando HMAC-SHA256.
 * Stripe envía un header 'stripe-signature' con formato:
 *   t=<timestamp>,v1=<signature>[,v0=<sig>]
 * La firma es HMAC-SHA256 de "<timestamp>.<body>" usando STRIPE_WEBHOOK_SECRET.
 */
import { createHmac, timingSafeEqual } from "crypto";

const TOLERANCE_MS = 5 * 60 * 1000;

export type StripeVerifyResult = { ok: true } | { ok: false; reason: string };

export function verifyStripeSignature(rawBody: string, signatureHeader: string | null): StripeVerifyResult {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") return { ok: true };
    return { ok: false, reason: "STRIPE_WEBHOOK_SECRET no configurado" };
  }
  if (!signatureHeader) return { ok: false, reason: "Falta header stripe-signature" };

  const parts: Record<string, string> = {};
  for (const seg of signatureHeader.split(",")) {
    const [k, v] = seg.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return { ok: false, reason: "Header con formato inválido" };

  const tsMs = Number(t) * 1000;
  if (Number.isNaN(tsMs)) return { ok: false, reason: "Timestamp inválido" };
  if (Math.abs(Date.now() - tsMs) > TOLERANCE_MS) return { ok: false, reason: "Timestamp fuera de ventana" };

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(v1, "utf8");
  if (expectedBuf.length !== providedBuf.length) return { ok: false, reason: "Firma inválida" };
  if (!timingSafeEqual(expectedBuf, providedBuf)) return { ok: false, reason: "Firma inválida" };
  return { ok: true };
}

// Compatibilidad con el wrapper antiguo
export function isWebhookAuthorized(signature: string | null): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!signature) return false;
  return signature.includes(secret) || signature === secret;
}
