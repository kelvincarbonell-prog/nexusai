import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";

/**
 * GET  /api/empresas/[id]/config-nomina  → devuelve la plantilla actual
 * POST /api/empresas/[id]/config-nomina  → guarda template en empresa.metadata
 */

const Body = z.object({ template: z.enum(["moderno", "clasico", "minimal"]) });

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(_req);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;
  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, id))) return jsonError("Sin permiso", 403);
  const { data: empresa } = await admin.from("empresas").select("metadata").eq("id", id).maybeSingle();
  const meta = (empresa?.metadata ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    ok: true,
    template: (meta.nomina_template as string) ?? "moderno",
    plantillas_disponibles: [
      { key: "moderno", label: "Moderno · banda oscura con acento", recomendado: true },
      { key: "clasico", label: "Clásico · justificante oficial con doble línea" },
      { key: "minimal", label: "Mínimal · limpio y sobrio" },
    ],
  });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Plantilla inválida");
  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, id))) return jsonError("Sin permiso", 403);

  const { data: empresa } = await admin.from("empresas").select("metadata").eq("id", id).maybeSingle();
  const meta = (empresa?.metadata ?? {}) as Record<string, unknown>;
  meta.nomina_template = parsed.data.template;

  const { error } = await admin.from("empresas").update({ metadata: meta }).eq("id", id);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, template: parsed.data.template });
}
