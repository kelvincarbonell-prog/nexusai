import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { defaultModulos, mergeWithDefaults, type Alcance } from "@/lib/vista-config/catalogo";

const Q = z.object({ alcance: z.enum(["asesor", "cliente"]) });

const Put = z.object({
  alcance: z.enum(["asesor", "cliente"]),
  modulos: z.record(z.string(), z.boolean()),
});

/**
 * Lee la configuración de vistas (módulos activos) de la gestoría.
 * Si no existe registro, devuelve los defaults del catálogo.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Q.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("alcance debe ser asesor | cliente");

  const admin = createSupabaseAdmin();
  const { data: self } = await admin
    .from("perfiles")
    .select("nombre_gestoria,rol")
    .eq("id", user.id)
    .maybeSingle();
  if (!self?.nombre_gestoria) {
    return NextResponse.json({ ok: true, modulos: defaultModulos(parsed.data.alcance), origen: "defaults" });
  }

  const { data: row } = await admin
    .from("vista_config")
    .select("modulos")
    .eq("nombre_gestoria", self.nombre_gestoria)
    .eq("alcance", parsed.data.alcance)
    .maybeSingle();

  const modulos = mergeWithDefaults(parsed.data.alcance as Alcance, (row?.modulos ?? null) as Record<string, boolean> | null);
  return NextResponse.json({ ok: true, modulos, origen: row ? "configurado" : "defaults" });
}

/**
 * Sólo admin o gestor pueden actualizar.
 */
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

  const { error } = await admin
    .from("vista_config")
    .upsert(
      {
        nombre_gestoria: self.nombre_gestoria,
        alcance: parsed.data.alcance,
        modulos: parsed.data.modulos,
      },
      { onConflict: "nombre_gestoria,alcance" },
    );
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ ok: true });
}
