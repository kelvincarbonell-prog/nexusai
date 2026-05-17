import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

const Create = z.object({
  empresa_id: z.string().uuid(),
  tipo: z.string().min(2).max(60),
  descripcion: z.string().max(2000).optional(),
  prioridad: z.enum(["normal", "alta", "urgente"]).default("normal"),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");
  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);
  const { data, error } = await admin
    .from("solicitudes_laborales")
    .select("*")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);
  const { data, error } = await admin
    .from("solicitudes_laborales")
    .insert({
      empresa_id: parsed.data.empresa_id,
      tipo: parsed.data.tipo,
      descripcion: parsed.data.descripcion ?? null,
      user_id: user.id,
      metadata: { prioridad: parsed.data.prioridad },
    })
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo crear", 500);

  // Notifica al gestor si el remitente no es él mismo
  const { data: empresa } = await admin
    .from("empresas")
    .select("gestor_id,nombre")
    .eq("id", parsed.data.empresa_id)
    .maybeSingle();
  if (empresa && empresa.gestor_id && empresa.gestor_id !== user.id) {
    const [{ crearNotificacionGestor }, { getSolicitudByKey }] = await Promise.all([
      import("@/lib/notificaciones/crear"),
      import("@/lib/solicitudes/catalogo"),
    ]);
    const cat = getSolicitudByKey(parsed.data.tipo);
    const titulo = `Nueva solicitud · ${empresa.nombre ?? "Cliente"}`;
    const detalle = cat
      ? `${cat.label}${parsed.data.descripcion ? ` — ${parsed.data.descripcion.slice(0, 120)}` : ""}`
      : (parsed.data.descripcion ?? parsed.data.tipo).slice(0, 160);
    const sev =
      parsed.data.prioridad === "urgente" ? "bad" : parsed.data.prioridad === "alta" ? "warn" : "info";
    await crearNotificacionGestor(admin, {
      empresa_id: parsed.data.empresa_id,
      tipo: "solicitud_cliente",
      titulo,
      detalle,
      url: `/laboral?empresa=${parsed.data.empresa_id}&tab=solicitudes`,
      severidad: sev,
      metadata: { solicitud_id: data.id, tipo_solicitud: parsed.data.tipo, prioridad: parsed.data.prioridad },
    });
  }

  return NextResponse.json({ ok: true, item: data });
}
