import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { calcularRiesgoInspeccion } from "@/lib/agents/inspection-risk";

/**
 * Risk score AEAT para TODAS las empresas del gestor.
 * GET /api/agents/riesgo-inspeccion/cartera
 *
 * Devuelve cada empresa con su score y nivel, ordenadas por riesgo
 * descendente. Pensado para el panel gestor.
 */
export async function GET(_request: NextRequest) {
  const { user } = await getUserFromRequest(_request);
  if (!user) return jsonError("No autorizado", 401);

  const admin = createSupabaseAdmin();
  const { data: perfil } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  if (perfil?.rol !== "admin" && perfil?.rol !== "gestor") return jsonError("Sin permiso", 403);

  let q = admin.from("empresas").select("id,nombre,nif,account_type,tipo");
  if (perfil.rol === "gestor") q = q.eq("gestor_id", user.id);
  const { data: empresas } = await q;
  const lista = empresas ?? [];

  if (lista.length === 0) {
    return NextResponse.json({ ok: true, items: [], totales: { empresas: 0, muy_alto: 0, alto: 0, medio: 0, bajo: 0 } });
  }

  // Concurrencia limitada para no saturar Supabase con 100 empresas a la vez
  const CONCURRENCY = 5;
  const items: Array<{
    empresa_id: string;
    nombre: string | null;
    nif: string | null;
    score: number;
    nivel: string;
    red_flags_count: number;
    top_flag: string | null;
  }> = [];
  for (let i = 0; i < lista.length; i += CONCURRENCY) {
    const batch = lista.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (e) => {
        try {
          const r = await calcularRiesgoInspeccion(admin, e.id);
          return {
            empresa_id: e.id,
            nombre: e.nombre,
            nif: e.nif,
            score: r.score,
            nivel: r.nivel,
            red_flags_count: r.red_flags.length,
            top_flag: r.red_flags[0]?.titulo ?? null,
          };
        } catch {
          return {
            empresa_id: e.id,
            nombre: e.nombre,
            nif: e.nif,
            score: 0,
            nivel: "bajo" as const,
            red_flags_count: 0,
            top_flag: null,
          };
        }
      })
    );
    items.push(...results);
  }

  items.sort((a, b) => b.score - a.score);

  const totales = items.reduce(
    (acc, it) => ({
      empresas: acc.empresas + 1,
      muy_alto: acc.muy_alto + (it.nivel === "muy_alto" ? 1 : 0),
      alto: acc.alto + (it.nivel === "alto" ? 1 : 0),
      medio: acc.medio + (it.nivel === "medio" ? 1 : 0),
      bajo: acc.bajo + (it.nivel === "bajo" ? 1 : 0),
    }),
    { empresas: 0, muy_alto: 0, alto: 0, medio: 0, bajo: 0 }
  );

  return NextResponse.json({ ok: true, items, totales });
}
