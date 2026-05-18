import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, emailLayout } from "@/lib/email/send";

/**
 * Cron diario de recordatorios de cobro a clientes morosos.
 *
 * Escalado inteligente por antigüedad del vencimiento:
 *   0-7 días vencido    → 1º recordatorio amable
 *   8-30 días vencido   → 2º recordatorio firme (3, 7, 14, 21, 28 vencido)
 *   31-60 días vencido  → 3º recordatorio última gestión amistosa
 *   >60 días            → silencio (vía vía gestoría / judicial)
 *
 * Cooldown: no envía a la misma factura más de 1 vez cada 7 días.
 * Sugerido cron: 10:00 días laborables.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    const provided = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
    if (provided !== secret) return NextResponse.json({ ok: false }, { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false, error: "CRON_SECRET requerido" }, { status: 503 });
  }

  const admin = createSupabaseAdmin();
  const hoy = new Date();
  const hoyISO = hoy.toISOString().slice(0, 10);
  const hace7dIso = new Date(hoy.getTime() - 7 * 86_400_000).toISOString();

  const { data: facturas } = await admin
    .from("facturas")
    .select("id,empresa_id,numero,serie,contacto_nombre,contacto_email,total,fecha_emision,fecha_vencimiento,metadata")
    .in("tipo", ["emitida", "simplificada"])
    .neq("estado", "cobrada")
    .lt("fecha_vencimiento", hoyISO)
    .limit(2000);

  if (!facturas || facturas.length === 0) {
    return NextResponse.json({ ok: true, evaluadas: 0, enviadas: 0 });
  }

  // Carga empresas (datos del emisor)
  const empresaIds = Array.from(new Set(facturas.map((f) => f.empresa_id)));
  const { data: empresas } = await admin
    .from("empresas")
    .select("id,nombre,nif,email")
    .in("id", empresaIds);
  const empresaMap = new Map((empresas ?? []).map((e) => [e.id, e]));

  let enviadas = 0;
  const detalles: Array<{ factura_id: string; etapa: number; saltado?: string }> = [];

  for (const f of facturas) {
    if (!f.contacto_email) {
      detalles.push({ factura_id: f.id, etapa: 0, saltado: "sin email cliente" });
      continue;
    }
    const empresa = empresaMap.get(f.empresa_id);
    if (!empresa) continue;

    const dias = Math.floor((hoy.getTime() - new Date((f.fecha_vencimiento ?? hoyISO) + "T00:00:00").getTime()) / 86_400_000);
    let etapa: 1 | 2 | 3 | null = null;
    if (dias >= 0 && dias <= 7) etapa = 1;
    else if (dias <= 30) etapa = 2;
    else if (dias <= 60) etapa = 3;
    if (!etapa) {
      detalles.push({ factura_id: f.id, etapa: 0, saltado: ">60 días, escalado manual" });
      continue;
    }

    // Cooldown 7 días: si ya enviamos recordatorio reciente, saltar
    const meta = (f.metadata ?? {}) as Record<string, unknown>;
    const recordatorios = (meta.recordatorios_cobro as Array<{ at: string; etapa: number }> | undefined) ?? [];
    const ultimoIso = recordatorios.length > 0 ? recordatorios[recordatorios.length - 1].at : null;
    if (ultimoIso && ultimoIso > hace7dIso) {
      detalles.push({ factura_id: f.id, etapa, saltado: "cooldown 7 días" });
      continue;
    }

    const ref = `${f.serie ?? ""}${f.numero ?? f.id.slice(0, 8)}`;
    const total = Number(f.total ?? 0).toLocaleString("es-ES", { minimumFractionDigits: 2 });
    const linkPortal = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://modelo26.com"}/portal?empresa=${f.empresa_id}`;

    const cuerpoEtapa: Record<1 | 2 | 3, string> = {
      1: `<p>Hola ${f.contacto_nombre ?? ""},</p>
          <p>Solo un recordatorio amable: la factura <strong>${ref}</strong> por <strong>${total} €</strong> emitida por <strong>${empresa.nombre}</strong> venció el <strong>${f.fecha_vencimiento}</strong>.</p>
          <p>Si ya has hecho el pago, ignora este mensaje. Si necesitas duplicado o ayuda, responde a este email.</p>
          <p style="opacity:0.7">Gracias.</p>`,
      2: `<p>Hola ${f.contacto_nombre ?? ""},</p>
          <p>La factura <strong>${ref}</strong> de <strong>${empresa.nombre}</strong> por <strong>${total} €</strong> sigue pendiente de cobro (${dias} días vencida).</p>
          <p>Te agradeceríamos que regularizases el pago a la mayor brevedad. Si hay alguna incidencia con la factura, dinos por favor cómo proceder.</p>
          <p style="opacity:0.7">Datos para transferencia bancaria los encontrarás en la propia factura. Si necesitas link de pago online, respóndenos.</p>`,
      3: `<p>Hola ${f.contacto_nombre ?? ""},</p>
          <p>Última gestión amistosa: la factura <strong>${ref}</strong> por <strong>${total} €</strong> lleva <strong>${dias} días</strong> vencida. Tras este aviso, el cobro pasará a gestión por nuestra asesoría.</p>
          <p>Por favor, contacta hoy mismo respondiendo a este email para acordar el pago o, si hay disputa, exponer el motivo.</p>
          <p style="opacity:0.7">Esperamos no tener que llegar a otras vías.</p>`,
    };

    const html = emailLayout({
      title: etapa === 1 ? `Recordatorio de pago · ${ref}` : etapa === 2 ? `Factura pendiente · ${ref}` : `Última gestión · ${ref}`,
      preheader: `${total} € · venció ${f.fecha_vencimiento}`,
      body: cuerpoEtapa[etapa],
      cta: { label: "Ver factura en el portal", url: linkPortal },
    });

    const r = await sendEmail({
      to: f.contacto_email,
      subject: etapa === 1
        ? `Recordatorio amable: factura ${ref}`
        : etapa === 2
          ? `Factura ${ref} pendiente de cobro (${dias} días)`
          : `Última gestión: factura ${ref} llegó a ${dias} días vencida`,
      html,
      replyTo: empresa.email ?? undefined,
    });

    if (r.ok && !r.skipped) {
      enviadas++;
      // Persiste el envío en metadata.recordatorios_cobro
      const next = [...recordatorios, { at: new Date().toISOString(), etapa }];
      await admin
        .from("facturas")
        .update({ metadata: { ...meta, recordatorios_cobro: next.slice(-10) } })
        .eq("id", f.id);
    }
    detalles.push({ factura_id: f.id, etapa });
  }

  return NextResponse.json({ ok: true, evaluadas: facturas.length, enviadas, detalles: detalles.slice(0, 50) });
}
