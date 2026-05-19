import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { defaultModulos, mergeWithDefaults, type Alcance } from "@/lib/vista-config/catalogo";

const Especialidad = z.enum(["generalista", "laboral", "fiscal"]);

const Q = z.object({
  alcance: z.enum(["asesor", "cliente"]),
  especialidad: Especialidad.optional(),
});

const Put = z.object({
  alcance: z.enum(["asesor", "cliente"]),
  especialidad: Especialidad.optional(),
  modulos: z.record(z.string(), z.boolean()),
});

/**
 * GET ?alcance=asesor|cliente[&especialidad=generalista|laboral|fiscal]
 *
 * - alcance=cliente: ignora especialidad (siempre única config por gestoría).
 * - alcance=asesor: si no se pasa especialidad, devuelve la de «generalista».
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Q.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  const { data: self } = await admin
    .from("perfiles")
    .select("nombre_gestoria,rol")
    .eq("id", user.id)
    .maybeSingle();
  if (!self?.nombre_gestoria) {
    return NextResponse.json({ ok: true, modulos: defaultModulos(parsed.data.alcance), origen: "defaults" });
  }

  const esp = parsed.data.alcance === "asesor" ? (parsed.data.especialidad ?? "generalista") : null;

  const baseQ = admin
    .from("vista_config")
    .select("modulos")
    .eq("nombre_gestoria", self.nombre_gestoria)
    .eq("alcance", parsed.data.alcance);
  const filteredQ = esp ? baseQ.eq("especialidad", esp) : baseQ.is("especialidad", null);
  const { data: row } = await filteredQ.maybeSingle();

  const modulos = mergeWithDefaults(parsed.data.alcance as Alcance, (row?.modulos ?? null) as Record<string, boolean> | null);
  return NextResponse.json({ ok: true, modulos, origen: row ? "configurado" : "defaults" });
}

export async function PUT(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Put.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  const { data: self } = await admin
    .from("perfiles")
    .select("nombre_gestoria,rol")
    .eq("id", user.id)
    .maybeSingle();
  if (!self) return jsonError("Perfil no encontrado", 404);
  if (self.rol !== "admin" && self.rol !== "gestor") return jsonError("Solo admin/gestor pueden configurar la vista", 403);
  if (!self.nombre_gestoria) return jsonError("Configura primero el nombre de tu gestoría", 400);

  const esp = parsed.data.alcance === "asesor" ? (parsed.data.especialidad ?? "generalista") : null;

  // El índice unique es sobre (nombre_gestoria, alcance, coalesce(especialidad,''))
  // Para upsert: hacemos UPDATE manual y INSERT si no existe.
  const findQ = admin
    .from("vista_config")
    .select("id")
    .eq("nombre_gestoria", self.nombre_gestoria)
    .eq("alcance", parsed.data.alcance);
  const findFiltered = esp ? findQ.eq("especialidad", esp) : findQ.is("especialidad", null);
  const { data: row } = await findFiltered.maybeSingle();

  if (row) {
    const { error } = await admin
      .from("vista_config")
      .update({ modulos: parsed.data.modulos })
      .eq("id", row.id);
    if (error) return jsonError(error.message, 500);
  } else {
    const { error } = await admin
      .from("vista_config")
      .insert({
        nombre_gestoria: self.nombre_gestoria,
        alcance: parsed.data.alcance,
        especialidad: esp,
        modulos: parsed.data.modulos,
      });
    if (error) return jsonError(error.message, 500);
  }

  return NextResponse.json({ ok: true });
}
