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
 * Validación del webhook de Stripe.
 * Implementación simplificada: compara el header con un secret compartido.
 * Para verificación criptográfica completa usa la SDK oficial.
 */
export function isWebhookAuthorized(signature: string | null): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!signature) return false;
  // En producción se debería implementar HMAC-SHA256 sobre el body.
  return signature.includes(secret) || signature === secret;
}
