import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { bestAvailableJSON } from "@/lib/agents/llm";

/**
 * Genera un email de recordatorio de cobro con IA y devuelve el texto.
 * No envía nada (eso requiere proveedor de email configurado).
 * Marca la factura con metadata.recordatorios.push.
 */

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;

  const admin = createSupabaseAdmin();
  const { data: factura } = await admin.from("facturas").select("*").eq("id", id).single();
  if (!factura) return jsonError("Factura no encontrada", 404);
  if (!(await isGestorOrAdmin(admin, user.id, factura.empresa_id))) return jsonError("Sin permiso", 403);

  const { data: empresa } = await admin.from("empresas").select("nombre,metadata").eq("id", factura.empresa_id).single();
  const empresaMeta = (empresa?.metadata ?? {}) as Record<string, unknown>;
  const factMeta = (factura.metadata ?? {}) as Record<string, unknown>;

  const diasVencida = factura.fecha_vencimiento
    ? Math.floor((Date.now() - new Date(factura.fecha_vencimiento + "T00:00:00").getTime()) / 86_400_000)
    : 0;

  const tono = diasVencida > 60 ? "firme pero educado" : diasVencida > 30 ? "amable con urgencia" : "amistoso";

  const prompt = `Eres asistente de una asesoría. Redacta un email de recordatorio de cobro en español dirigido a "${factura.contacto_nombre}".
Empresa emisora: ${empresa?.nombre}.
Factura ${factura.numero} por ${EUR(Number(factura.total))} vencida hace ${diasVencida} días.
Tono: ${tono}.
Plantilla preferida (si vacía usa default): ${empresaMeta.email_plantilla ?? ""}
Variables disponibles: {cliente}, {numero}, {total}, {dias_vencida}.
Devuelve SOLO JSON con la forma: {"asunto": "...", "cuerpo": "..."}.
El cuerpo debe ser texto plano sin saludos repetitivos. 4-6 frases máximo.`;

  const ai = await bestAvailableJSON(prompt);

  let asunto = `Recordatorio · factura ${factura.numero ?? id.slice(0, 6)}`;
  let cuerpo = `Hola ${factura.contacto_nombre},\n\nTe escribo para recordarte el cobro de la factura ${factura.numero ?? ""} por ${EUR(Number(factura.total))}, vencida desde hace ${diasVencida} días.\n\n¿Podemos cuadrar el pago esta semana?\n\nGracias.`;
  try {
    if (ai.ok && ai.text) {
      const j = JSON.parse(ai.text.trim().replace(/^```json\s*/i, "").replace(/```$/i, ""));
      if (j.asunto) asunto = String(j.asunto);
      if (j.cuerpo) cuerpo = String(j.cuerpo);
    }
  } catch {
    // fallback ya asignado
  }

  // Registra envío (logging)
  const recordatorios = ((factMeta.recordatorios as Array<{ enviado_en: string; dias_vencida: number }>) ?? []);
  recordatorios.push({ enviado_en: new Date().toISOString(), dias_vencida: diasVencida });
  await admin.from("facturas").update({ metadata: { ...factMeta, recordatorios } }).eq("id", id);

  return NextResponse.json({
    ok: true,
    asunto,
    cuerpo,
    enlace_pago: factura.payment_link_url,
    cliente_email: factMeta.cliente_email ?? null,
    dias_vencida: diasVencida,
  });
}
