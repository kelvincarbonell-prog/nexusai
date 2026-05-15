import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { createCheckoutSession } from "@/lib/payments/stripe";

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;

  const admin = createSupabaseAdmin();
  const { data: factura } = await admin
    .from("facturas")
    .select("id,empresa_id,numero,contacto_nombre,total,estado,payment_status,metadata")
    .eq("id", id)
    .single();
  if (!factura) return jsonError("Factura no encontrada", 404);
  if (!(await isGestorOrAdmin(admin, user.id, factura.empresa_id))) return jsonError("Sin permiso", 403);
  if (factura.payment_status === "paid") return jsonError("Factura ya pagada", 409);

  const amountCents = Math.round(Number(factura.total ?? 0) * 100);
  if (amountCents <= 0) return jsonError("Importe inválido", 400);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const meta = (factura.metadata ?? {}) as Record<string, unknown>;
  const customerEmail = typeof meta.cliente_email === "string" ? meta.cliente_email : undefined;

  try {
    const session = await createCheckoutSession({
      amountCents,
      currency: "eur",
      description: `Factura ${factura.numero ?? id.slice(0, 8)} · ${factura.contacto_nombre ?? "Cliente"}`,
      successUrl: `${baseUrl}/portal?paid=${id}`,
      cancelUrl: `${baseUrl}/portal?cancelled=${id}`,
      customerEmail,
      metadata: { factura_id: id, empresa_id: factura.empresa_id },
    });

    const { error } = await admin
      .from("facturas")
      .update({
        payment_link_url: session.url,
        payment_provider: "stripe",
        payment_intent_id: session.payment_intent,
        payment_status: "pending",
      })
      .eq("id", id);
    if (error) return jsonError(error.message, 500);

    return NextResponse.json({ ok: true, url: session.url, session_id: session.id });
  } catch (e: unknown) {
    return jsonError(e instanceof Error ? e.message : "Error Stripe", 502);
  }
}
