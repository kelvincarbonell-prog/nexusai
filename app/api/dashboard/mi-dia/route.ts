import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Vista "Mi día" — resumen ejecutivo personalizado del gestor:
 *
 *   - Modelos AEAT que vencen en 7 días
 *   - Mensajes sin leer
 *   - Solicitudes pendientes / urgentes
 *   - Firmas pendientes (modelos en borrador)
 *   - Tareas asignadas hoy / mañana
 *   - Notificaciones no leídas
 *
 * Todo en una sola request para que la pantalla aparezca al instante.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const admin = createSupabaseAdmin();
  const { data: profile } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  const empresasQ = isAdmin
    ? admin.from("empresas").select("id").limit(500)
    : admin.from("empresas").select("id").or(`gestor_id.eq.${user.id},owner_user_id.eq.${user.id}`).limit(500);
  const { data: empresas } = await empresasQ;
  const empresaIds = (empresas ?? []).map((e) => e.id);

  const hoy = new Date();
  const hoyISO = hoy.toISOString().slice(0, 10);
  const en7d = new Date(hoy.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const manana = new Date(hoy.getTime() + 86_400_000).toISOString().slice(0, 10);

  const [mensajesRes, solicRes, notifRes, tareasRes, modelosRes, facturasVenc] = await Promise.all([
    // Mensajes sin leer dirigidos al gestor
    empresaIds.length > 0
      ? admin
          .from("mensajes")
          .select("id,empresa_id,contenido,created_at")
          .in("empresa_id", empresaIds)
          .neq("remitente_id", user.id)
          .eq("leido", false)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as Array<{ id: string; empresa_id: string; contenido: string; created_at: string }> }),
    // Solicitudes pendientes/urgentes
    empresaIds.length > 0
      ? admin
          .from("solicitudes_laborales")
          .select("id,empresa_id,tipo,estado,metadata,created_at")
          .in("empresa_id", empresaIds)
          .in("estado", ["pendiente", "en_proceso"])
          .order("created_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] as Array<{ id: string; empresa_id: string; tipo: string; estado: string; metadata: Record<string, unknown>; created_at: string }> }),
    // Notificaciones no leídas
    admin
      .from("notificaciones")
      .select("id,titulo,detalle,url,severidad,created_at,empresa_id")
      .eq("destinatario_id", user.id)
      .eq("leida", false)
      .order("created_at", { ascending: false })
      .limit(15),
    // Tareas con fecha hoy o mañana
    admin
      .from("tareas")
      .select("id,empresa_id,titulo,estado,prioridad,fecha_limite,asignado_a")
      .or(`asignado_a.eq.${user.id},gestor_id.eq.${user.id}`)
      .in("estado", ["pendiente", "en_curso"])
      .lte("fecha_limite", manana)
      .order("fecha_limite", { ascending: true })
      .limit(30),
    // Modelos AEAT en borrador o preparado (firmas pendientes)
    empresaIds.length > 0
      ? admin
          .from("aeat_declaraciones")
          .select("id,empresa_id,modelo,ejercicio,periodo,status,casillas,updated_at")
          .in("empresa_id", empresaIds)
          .in("status", ["draft", "borrador", "preparado", "listo"])
          .order("updated_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as Array<{ id: string; empresa_id: string; modelo: string; ejercicio: number; periodo: string; status: string; casillas: Record<string, number>; updated_at: string }> }),
    // Facturas vencidas
    empresaIds.length > 0
      ? admin
          .from("facturas")
          .select("id,empresa_id,numero,total,fecha_vencimiento,contacto_nombre")
          .in("empresa_id", empresaIds)
          .in("tipo", ["emitida", "simplificada"])
          .neq("estado", "cobrada")
          .lt("fecha_vencimiento", hoyISO)
          .order("fecha_vencimiento", { ascending: true })
          .limit(20)
      : Promise.resolve({ data: [] as Array<{ id: string; empresa_id: string; numero: string; total: number; fecha_vencimiento: string; contacto_nombre: string }> }),
  ]);

  const mensajes = mensajesRes.data ?? [];
  const solicitudes = (solicRes.data ?? []).filter(Boolean);
  const urgentes = solicitudes.filter((s) => (s.metadata as Record<string, unknown> | null)?.prioridad === "urgente").length;
  const notif = notifRes.data ?? [];
  const tareas = (tareasRes.data ?? []).filter(Boolean);
  const modelos = modelosRes.data ?? [];
  const vencidas = facturasVenc.data ?? [];
  const totalVencido = vencidas.reduce((s, f) => s + Number(f.total ?? 0), 0);

  // Calidad de la mañana
  const total_pendientes = mensajes.length + solicitudes.length + tareas.length + modelos.length + (vencidas.length > 0 ? 1 : 0);
  const nivel = total_pendientes === 0 ? "perfecto" : total_pendientes < 5 ? "ligero" : total_pendientes < 12 ? "normal" : "cargado";

  return NextResponse.json({
    ok: true,
    contadores: {
      mensajes_no_leidos: mensajes.length,
      solicitudes_pendientes: solicitudes.length,
      solicitudes_urgentes: urgentes,
      notificaciones_no_leidas: notif.length,
      tareas_hoy_y_mañana: tareas.length,
      modelos_pendientes_firma: modelos.length,
      facturas_vencidas: vencidas.length,
      importe_vencido: Math.round(totalVencido * 100) / 100,
    },
    nivel,
    mensajes: mensajes.slice(0, 5),
    solicitudes: solicitudes.slice(0, 5),
    notificaciones: notif.slice(0, 5),
    tareas: tareas.slice(0, 5),
    modelos: modelos.slice(0, 5),
    vencidas: vencidas.slice(0, 5),
    fecha: hoyISO,
  });
}
