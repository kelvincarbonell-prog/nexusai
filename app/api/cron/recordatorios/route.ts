import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { buildCalendar } from "@/lib/aeat/calendar";
import { sendEmail, emailLayout } from "@/lib/email/send";

/**
 * Cron diario de recordatorios al cliente y al gestor.
 *
 * Por cada empresa con email de contacto:
 *  - Modelos AEAT pendientes en próximos 7 días.
 *  - Facturas vencidas no cobradas (>0 días vencido).
 *  - Bot fiscal: si tiene alertas danger (urgentes), las cita.
 *
 * Si no hay nada que avisar, NO envía email (no spam).
 *
 * Ejecución sugerida: 08:00 Europe/Madrid (después del bot-fiscal-daily).
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
  const today = new Date().toISOString().slice(0, 10);
  const enviados: string[] = [];
  let intentados = 0;

  const { data: empresas } = await admin
    .from("empresas")
    .select("id,nombre,email,account_type,gestor_id,owner_user_id")
    .limit(500);

  for (const e of empresas ?? []) {
    if (!e.email) continue;
    intentados++;

    // 1) Modelos AEAT en próximos 7 días
    const { data: presentaciones } = await admin
      .from("aeat_presentaciones")
      .select("modelo,ejercicio,periodo")
      .eq("empresa_id", e.id);
    const calendar = buildCalendar({
      empresaTipo: e.account_type === "autonomo" ? "autonomo" : "empresa",
      presentadas: (presentaciones ?? []).map((p) => ({ modelo: String(p.modelo), ejercicio: Number(p.ejercicio), periodo: String(p.periodo) })),
      horizonteDias: 14,
    });
    const proximos = calendar
      .filter((o) => !o.esta_presentada && o.dias_restantes >= 0 && o.dias_restantes <= 7)
      .sort((a, b) => a.dias_restantes - b.dias_restantes);

    // 2) Facturas vencidas
    const { data: vencidas } = await admin
      .from("facturas")
      .select("numero,contacto_nombre,total,fecha_vencimiento")
      .eq("empresa_id", e.id)
      .in("tipo", ["emitida", "simplificada"])
      .neq("estado", "cobrada")
      .lt("fecha_vencimiento", today)
      .limit(20);

    // 3) Bot fiscal: snapshot de hoy
    const { data: scan } = await admin
      .from("bot_scans")
      .select("alertas_danger,alertas")
      .eq("empresa_id", e.id)
      .eq("fecha", today)
      .maybeSingle();
    const dangerAlertas = scan && Array.isArray(scan.alertas)
      ? (scan.alertas as Array<{ nivel: string; titulo: string }>).filter((a) => a.nivel === "danger").slice(0, 3)
      : [];

    if (proximos.length === 0 && (vencidas?.length ?? 0) === 0 && dangerAlertas.length === 0) continue;

    // Construye HTML
    const bullets: string[] = [];
    if (proximos.length > 0) {
      bullets.push(
        `<div style="margin-bottom:12px"><strong>📅 Modelos AEAT en los próximos 7 días</strong><ul style="margin:8px 0 0;padding-left:18px">${proximos.map((o) => `<li>${o.modelo} · ${o.periodo} ${o.ejercicio} — vence el ${o.fecha_limite} (${o.dias_restantes} días)</li>`).join("")}</ul></div>`,
      );
    }
    if ((vencidas?.length ?? 0) > 0) {
      const total = (vencidas ?? []).reduce((s, f) => s + Number(f.total ?? 0), 0);
      bullets.push(
        `<div style="margin-bottom:12px"><strong>💶 Facturas vencidas sin cobrar (${vencidas?.length})</strong><div style="opacity:0.8;margin-top:4px">Importe pendiente: <strong>${Math.round(total).toLocaleString("es-ES")} €</strong>. Revisa cobros y considera enviar recordatorios.</div></div>`,
      );
    }
    if (dangerAlertas.length > 0) {
      bullets.push(
        `<div style="margin-bottom:12px"><strong>⚠️ Avisos urgentes del bot fiscal</strong><ul style="margin:8px 0 0;padding-left:18px">${dangerAlertas.map((a) => `<li>${a.titulo}</li>`).join("")}</ul></div>`,
      );
    }

    const html = emailLayout({
      title: `${e.nombre ?? "Tu empresa"} · cosas pendientes esta semana`,
      preheader: `${proximos.length} modelos próximos, ${vencidas?.length ?? 0} facturas vencidas`,
      body: bullets.join(""),
      cta: { label: "Abrir mi panel", url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://modelo26.com"}/portal?empresa=${e.id}` },
    });

    const r = await sendEmail({
      to: e.email,
      subject: `[Modelo 26] ${e.nombre ?? "Tu empresa"} — ${proximos.length + (vencidas?.length ?? 0)} cosas pendientes`,
      html,
    });
    if (r.ok && !r.skipped) enviados.push(e.id);
  }

  return NextResponse.json({ ok: true, intentados, enviados: enviados.length });
}
