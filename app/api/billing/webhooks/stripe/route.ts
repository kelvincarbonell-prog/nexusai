import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Webhook de Stripe — marca facturas como pagadas cuando llega checkout.session.completed.
 * En producción debes configurar STRIPE_WEBHOOK_SECRET y enviar el header stripe-signature.
 * Aquí hacemos una validación pragmática para arrancar.
 */

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id?: string;
      payment_intent?: string;
      payment_status?: string;
      status?: string;
      amount_total?: number;
      currency?: string;
      metadata?: Record<string, string>;
    };
  };
};

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");

  if (secret) {
    // Validación simplificada — la SDK oficial usa HMAC-SHA256 sobre el body.
    // Aquí comparamos por presencia de la firma. En producción importar 'stripe'
    // y usar stripe.webhooks.constructEvent.
    if (!signature) {
      return NextResponse.json({ ok: false, error: "Firma ausente" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "Webhook no configurado" }, { status: 503 });
  }

  let event: StripeEvent;
  try {
    event = (await request.json()) as StripeEvent;
  } catch {
    return NextResponse.json({ ok: false, error: "Payload inválido" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // Idempotencia: si ya procesamos este evento, salir
  const { data: existing } = await admin
    .from("payment_events")
    .select("id")
    .eq("provider", "stripe")
    .eq("event_id", event.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, idempotent: true });

  const session = event.data.object;
  const facturaId = session.metadata?.factura_id;
  const empresaId = session.metadata?.empresa_id;

  let facturaIdResolved = facturaId ?? null;
  if (!facturaIdResolved && session.payment_intent) {
    const { data } = await admin
      .from("facturas")
      .select("id")
      .eq("payment_intent_id", session.payment_intent)
      .maybeSingle();
    facturaIdResolved = data?.id ?? null;
  }

  if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
    if (facturaIdResolved) {
      const amount = session.amount_total ? session.amount_total / 100 : null;
      await admin
        .from("facturas")
        .update({
          payment_status: "paid",
          estado: "cobrada",
          paid_at: new Date().toISOString(),
          paid_amount: amount,
        })
        .eq("id", facturaIdResolved);
    }
  } else if (event.type === "payment_intent.payment_failed") {
    if (facturaIdResolved) {
      await admin.from("facturas").update({ payment_status: "failed" }).eq("id", facturaIdResolved);
    }
  } else if (event.type === "charge.refunded") {
    if (facturaIdResolved) {
      await admin.from("facturas").update({ payment_status: "refunded" }).eq("id", facturaIdResolved);
    }
  }

  await admin.from("payment_events").insert({
    empresa_id: empresaId ?? null,
    factura_id: facturaIdResolved,
    provider: "stripe",
    event_id: event.id,
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true });
}
