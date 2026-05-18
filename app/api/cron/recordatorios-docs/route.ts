import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, emailLayout } from "@/lib/email/send";

/**
 * Cron diario que recuerda al cliente los documentos que el gestor le ha
 * solicitado y siguen sin entregar.
 *
 * Heurística: una solicitud cuyo tipo requiere documento, lleva >3 días
 * pendiente y no tiene documentos vinculados → genera recordatorio.
 *
 * Cooldown 4 días por solicitud para no abusar.
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
  const hace3d = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const hace4d = new Date(Date.now() - 4 * 86_400_000).toISOString();

  // Carga el catálogo de solicitudes (qué tipos requieren documento)
  const { CATALOGO_SOLICITUDES } = await import("@/lib/solicitudes/catalogo");
  const tiposRequierenDoc = new Set(CATALOGO_SOLICITUDES.filter((s) => s.requiere_documento).map((s) => s.key));

  const { data: solicitudes } = await admin
    .from("solicitudes_laborales")
    .select("id,empresa_id,tipo,descripcion,estado,metadata,user_id,created_at,updated_at")
    .in("estado", ["pendiente", "en_proceso"])
    .lt("created_at", hace3d)
    .limit(500);

  if (!solicitudes || solicitudes.length === 0) return NextResponse.json({ ok: true, enviados: 0 });

  // Empresas referenciadas
  const empresaIds = Array.from(new Set(solicitudes.map((s) => s.empresa_id)));
  const { data: empresas } = await admin.from("empresas").select("id,nombre,email").in("id", empresaIds);
  const empresaMap = new Map((empresas ?? []).map((e) => [e.id, e]));

  let enviados = 0;
  const detalles: Array<{ id: string; saltado?: string }> = [];

  for (const s of solicitudes) {
    if (!tiposRequierenDoc.has(s.tipo)) {
      detalles.push({ id: s.id, saltado: "tipo no requiere documento" });
      continue;
    }
    const meta = (s.metadata ?? {}) as Record<string, unknown>;
    if (meta.documentos_recibidos) {
      detalles.push({ id: s.id, saltado: "ya entregados" });
      continue;
    }
    // Cooldown: si ya envié en últimos 4 días
    const ultRec = meta.ultimo_recordatorio_doc as string | undefined;
    if (ultRec && ultRec > hace4d) {
      detalles.push({ id: s.id, saltado: "cooldown 4d" });
      continue;
    }

    const empresa = empresaMap.get(s.empresa_id);
    if (!empresa?.email) {
      detalles.push({ id: s.id, saltado: "empresa sin email" });
      continue;
    }

    const cat = (await import("@/lib/solicitudes/catalogo")).getSolicitudByKey(s.tipo);
    const titulo = cat?.label ?? "Solicitud pendiente";
    const help = cat?.campos?.find((c) => c.tipo === "documento")?.help ?? "Tu gestor necesita el documento adjunto para continuar.";

    const r = await sendEmail({
      to: empresa.email,
      subject: `[Modelo 26] Falta documento: ${titulo}`,
      html: emailLayout({
        title: `Falta un documento para "${titulo}"`,
        preheader: "Tu gestor necesita un adjunto para continuar con tu solicitud.",
        body: `
          <p>Hola,</p>
          <p>Hace unos días enviaste la solicitud <strong>${titulo}</strong> y tu gestor la tiene en pausa porque sigue faltando el documento que adjuntar.</p>
          <p style="opacity:0.85">${help}</p>
          ${s.descripcion ? `<p style="background:#f6f6f9;padding:10px;border-radius:8px;font-size:13px;border-left:3px solid #6366f1">${s.descripcion}</p>` : ""}
          <p>Puedes subirlo desde tu portal en la pestaña <strong>Documentos</strong> y te avisaremos al gestor automáticamente.</p>
        `,
        cta: { label: "Abrir mi portal", url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://modelo26.com"}/portal?empresa=${s.empresa_id}&tab=documentos` },
      }),
    });

    if (r.ok && !r.skipped) {
      enviados++;
      await admin
        .from("solicitudes_laborales")
        .update({ metadata: { ...meta, ultimo_recordatorio_doc: new Date().toISOString() } })
        .eq("id", s.id);
    }
    detalles.push({ id: s.id });
  }

  return NextResponse.json({ ok: true, evaluadas: solicitudes.length, enviados, detalles: detalles.slice(0, 50) });
}
