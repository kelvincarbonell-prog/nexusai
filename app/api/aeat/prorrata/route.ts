import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { calcularProrrata } from "@/lib/aeat/prorrata";

const Schema = z.object({
  operaciones_con_derecho: z.number().min(0),
  operaciones_sin_derecho: z.number().min(0),
  iva_soportado_total: z.number().min(0),
  iva_soportado_uso_exclusivo_con_derecho: z.number().min(0).optional(),
  iva_soportado_uso_exclusivo_sin_derecho: z.number().min(0).optional(),
  iva_soportado_uso_mixto: z.number().min(0).optional(),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  const result = calcularProrrata(parsed.data);
  return NextResponse.json({ ok: true, ...result });
}
