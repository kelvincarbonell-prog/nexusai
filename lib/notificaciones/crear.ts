/**
 * Helper para crear notificaciones para el gestor.
 * Usado por mensajes, solicitudes, OCR pendiente, etc.
 */

import type { createSupabaseAdmin } from "@/lib/supabase/admin";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;

export type NotificacionTipo =
  | "mensaje_cliente"
  | "solicitud_cliente"
  | "ocr_pendiente"
  | "documento_subido"
  | "factura_vencida"
  | "sistema";

export async function crearNotificacionGestor(
  admin: SupabaseAdmin,
  args: {
    empresa_id: string;
    tipo: NotificacionTipo;
    titulo: string;
    detalle?: string;
    url?: string;
    severidad?: "info" | "warn" | "bad" | "good";
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  // Encuentra el gestor de la empresa
  const { data: empresa } = await admin
    .from("empresas")
    .select("gestor_id,owner_user_id,nombre")
    .eq("id", args.empresa_id)
    .maybeSingle();

  if (!empresa) return;

  // Quién recibe la notificación. El gestor primero; si no hay gestor, el owner.
  const destinatario = empresa.gestor_id ?? empresa.owner_user_id;
  if (!destinatario) return;

  await admin.from("notificaciones").insert({
    destinatario_id: destinatario,
    empresa_id: args.empresa_id,
    tipo: args.tipo,
    titulo: args.titulo,
    detalle: args.detalle ?? null,
    url: args.url ?? null,
    severidad: args.severidad ?? "info",
    metadata: args.metadata ?? {},
    leida: false,
  });
}
