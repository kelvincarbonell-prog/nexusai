import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Devuelve los últimos N cambios salariales en todas las empresas que
 * gestiona el usuario actual. Pensado para el panel gestor del dashboard.
 *
 * Solo gestor / admin; el cliente final no debe acceder.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const limit = Math.min(50, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 20)));

  const admin = createSupabaseAdmin();
  const { data: perfil } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  if (perfil?.rol !== "admin" && perfil?.rol !== "gestor") return jsonError("Sin permiso", 403);

  // Empresas del gestor (admin ve todo).
  let empresasIds: string[] | null = null;
  if (perfil.rol === "gestor") {
    const { data: emps } = await admin.from("empresas").select("id").eq("gestor_id", user.id);
    empresasIds = (emps ?? []).map((e) => e.id);
    if (empresasIds.length === 0) return NextResponse.json({ ok: true, items: [] });
  }

  let q = admin
    .from("salario_historico")
    .select("id,empresa_id,trabajador_id,fecha_efecto,bruto_anual,bruto_anual_anterior,delta_anual,motivo,convenio_codigo,created_at")
    .order("fecha_efecto", { ascending: false })
    .limit(limit);
  if (empresasIds) q = q.in("empresa_id", empresasIds);

  const { data: cambios } = await q;
  const list = cambios ?? [];

  // Hidratamos empresa + trabajador en lookups separados.
  const empIds = Array.from(new Set(list.map((c) => c.empresa_id)));
  const trabIds = Array.from(new Set(list.map((c) => c.trabajador_id)));

  const [{ data: empresas }, { data: trabajadores }] = await Promise.all([
    empIds.length
      ? admin.from("empresas").select("id,nombre,nif").in("id", empIds)
      : Promise.resolve({ data: [] as Array<{ id: string; nombre: string | null; nif: string | null }> }),
    trabIds.length
      ? admin.from("trabajadores").select("id,nombre,apellidos").in("id", trabIds)
      : Promise.resolve({ data: [] as Array<{ id: string; nombre: string | null; apellidos: string | null }> }),
  ]);

  const empMap = new Map((empresas ?? []).map((e) => [e.id, e]));
  const trabMap = new Map((trabajadores ?? []).map((t) => [t.id, t]));

  const items = list.map((c) => ({
    ...c,
    empresa: empMap.get(c.empresa_id) ?? null,
    trabajador: trabMap.get(c.trabajador_id) ?? null,
  }));

  return NextResponse.json({ ok: true, items });
}
