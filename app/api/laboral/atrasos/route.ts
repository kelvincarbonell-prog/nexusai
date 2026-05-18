import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { calcularAtrasos } from "@/lib/laboral/atrasos";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  trabajador_id: z.string().uuid(),
  desde: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  hasta: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  nuevo_bruto_mensual: z.number().positive(),
});

/**
 * Calcula atrasos retroactivos para un trabajador entre dos periodos.
 * Compara el bruto pagado de cada nómina del rango con el nuevo bruto.
 */
export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");
  if (parsed.data.desde > parsed.data.hasta) return jsonError("El rango está invertido");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const { data: nominas } = await admin
    .from("nominas")
    .select("id,periodo,total,metadata")
    .eq("empresa_id", parsed.data.empresa_id)
    .eq("trabajador_id", parsed.data.trabajador_id)
    .gte("periodo", parsed.data.desde)
    .lte("periodo", parsed.data.hasta)
    .order("periodo");

  if (!nominas || nominas.length === 0) {
    return NextResponse.json({ ok: true, lineas: [], total_diferencia: 0, warnings: [`Sin nóminas entre ${parsed.data.desde} y ${parsed.data.hasta}`] });
  }

  const input = nominas.map((n) => {
    const meta = (n.metadata ?? {}) as Record<string, number | undefined>;
    const bruto = Number(meta.devengo_bruto ?? meta.bruto ?? n.total ?? 0);
    return { periodo: n.periodo, bruto };
  });

  const result = calcularAtrasos({ nominas: input, nuevo_bruto_mensual: parsed.data.nuevo_bruto_mensual });
  return NextResponse.json({ ok: true, ...result });
}
