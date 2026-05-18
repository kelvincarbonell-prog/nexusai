import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const Invite = z.object({
  email: z.string().email(),
  nombre: z.string().min(2).max(120),
  rol: z.enum(["gestor", "asesor"]).default("asesor"),
  especialidad: z.enum(["laboral", "fiscal", "generalista"]).default("generalista"),
});

/**
 * Lista los asesores/gestores disponibles en la plataforma (rol = admin | gestor | asesor).
 * Necesario para el dropdown de asignación de asesor en clientes.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const admin = createSupabaseAdmin();
  const { data: profile } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  // Si es gestor: devuelve a sí mismo + cualquier otro gestor del mismo nombre_gestoria
  // Si es admin: devuelve todos los gestores
  if (isAdmin) {
    const { data } = await admin
      .from("perfiles")
      .select("id,nombre,email,rol,especialidad")
      .in("rol", ["admin", "gestor", "asesor"])
      .order("nombre");
    return NextResponse.json({ ok: true, asesores: data ?? [] });
  }

  const { data: self } = await admin.from("perfiles").select("id,nombre,email,rol,especialidad,nombre_gestoria").eq("id", user.id).maybeSingle();
  if (!self?.nombre_gestoria) {
    return NextResponse.json({ ok: true, asesores: self ? [self] : [] });
  }
  const { data } = await admin
    .from("perfiles")
    .select("id,nombre,email,rol,especialidad")
    .eq("nombre_gestoria", self.nombre_gestoria)
    .in("rol", ["admin", "gestor", "asesor"]);
  return NextResponse.json({ ok: true, asesores: data ?? [] });
}

/**
 * Invita a un nuevo asesor al equipo de la gestoría. Crea el perfil con
 * el mismo nombre_gestoria que el invitante (para que aparezcan agrupados).
 * El asesor recibe un email de Supabase Auth con su contraseña inicial.
 */
export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Invite.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  const { data: self } = await admin
    .from("perfiles")
    .select("rol,nombre_gestoria")
    .eq("id", user.id)
    .maybeSingle();
  if (!self) return jsonError("Perfil no encontrado", 404);
  if (self.rol !== "admin" && self.rol !== "gestor") return jsonError("Solo admin/gestor pueden invitar", 403);
  if (!self.nombre_gestoria) return jsonError("Configura primero el nombre de tu gestoría en /perfil", 400);

  // Comprueba si ya existe ese email
  const { data: existing } = await admin
    .from("perfiles")
    .select("id,nombre,nombre_gestoria,rol")
    .eq("email", parsed.data.email)
    .maybeSingle();
  if (existing) {
    if (existing.nombre_gestoria === self.nombre_gestoria) {
      return jsonError("Ese asesor ya está en tu equipo", 409);
    }
    return jsonError("Ese email ya tiene cuenta en otra gestoría. Pídele que cambie de despacho desde su perfil.", 409);
  }

  // Crear usuario en Supabase Auth + enviar email de invitación.
  // El email lo manda Supabase Auth con su propio SMTP (o el SMTP custom
  // que tengas configurado en Auth → SMTP Settings).
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${baseUrl}/bienvenida`,
    data: {
      nombre: parsed.data.nombre,
      nombre_gestoria: self.nombre_gestoria,
      rol: parsed.data.rol,
      especialidad: parsed.data.especialidad,
      invitado_por: user.id,
      password_set: false,
    },
  });

  if (inviteErr || !invited?.user) {
    console.error("[asesores] inviteUserByEmail error:", inviteErr?.message, inviteErr);
    const msg = inviteErr?.message ?? "No se pudo enviar la invitación";
    // Mensajes más claros para errores comunes de Supabase
    if (/already.*registered|already.*exists|duplicate/i.test(msg)) {
      return jsonError("Este email ya tiene cuenta. Si quieres añadirlo al equipo, pídele que entre y desde su perfil cambie de gestoría.", 409);
    }
    if (/rate limit|too many/i.test(msg)) {
      return jsonError("Has superado el límite de emails de Supabase (4/hora con SMTP por defecto). Configura un SMTP propio en Supabase → Auth → SMTP Settings, o espera unos minutos.", 429);
    }
    if (/smtp|email/i.test(msg)) {
      return jsonError(`Supabase no pudo enviar el email: ${msg}. Configura un SMTP en Supabase → Auth → SMTP Settings.`, 500);
    }
    return jsonError(msg, 500);
  }

  // Crear o actualizar el perfil
  const { error: profileErr } = await admin
    .from("perfiles")
    .upsert(
      {
        id: invited.user.id,
        email: parsed.data.email,
        nombre: parsed.data.nombre,
        rol: parsed.data.rol,
        especialidad: parsed.data.especialidad,
        nombre_gestoria: self.nombre_gestoria,
      },
      { onConflict: "id" },
    );
  if (profileErr) return jsonError(profileErr.message, 500);

  return NextResponse.json({
    ok: true,
    asesor: {
      id: invited.user.id,
      email: parsed.data.email,
      nombre: parsed.data.nombre,
      rol: parsed.data.rol,
      especialidad: parsed.data.especialidad,
    },
  });
}

const Update = z.object({
  id: z.string().uuid(),
  rol: z.enum(["admin", "gestor", "asesor"]).optional(),
  especialidad: z.enum(["laboral", "fiscal", "generalista"]).optional(),
});

export async function PATCH(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Update.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  const admin = createSupabaseAdmin();
  const { data: self } = await admin.from("perfiles").select("rol,nombre_gestoria").eq("id", user.id).maybeSingle();
  if (self?.rol !== "admin" && self?.rol !== "gestor") return jsonError("Sin permiso", 403);
  const { data: target } = await admin.from("perfiles").select("nombre_gestoria").eq("id", parsed.data.id).maybeSingle();
  if (!target || target.nombre_gestoria !== self.nombre_gestoria) return jsonError("Ese asesor no es de tu equipo", 403);
  const update: Record<string, unknown> = {};
  if (parsed.data.rol) update.rol = parsed.data.rol;
  if (parsed.data.especialidad) update.especialidad = parsed.data.especialidad;
  const { error } = await admin.from("perfiles").update(update).eq("id", parsed.data.id);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return jsonError("Falta id");
  if (id === user.id) return jsonError("No puedes eliminarte a ti mismo");
  const admin = createSupabaseAdmin();
  const { data: self } = await admin.from("perfiles").select("rol,nombre_gestoria").eq("id", user.id).maybeSingle();
  if (self?.rol !== "admin" && self?.rol !== "gestor") return jsonError("Sin permiso", 403);
  const { data: target } = await admin.from("perfiles").select("nombre_gestoria").eq("id", id).maybeSingle();
  if (!target || target.nombre_gestoria !== self.nombre_gestoria) return jsonError("Ese asesor no es de tu equipo", 403);
  // Desvincular del equipo (no borrar la cuenta de auth)
  const { error } = await admin.from("perfiles").update({ nombre_gestoria: null }).eq("id", id);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
