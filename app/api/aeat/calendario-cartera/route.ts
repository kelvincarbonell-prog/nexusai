import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { buildCalendar, type Obligacion } from "@/lib/aeat/calendar";

/**
 * Calendario AEAT unificado de toda la cartera del gestor.
 * GET /api/aeat/calendario-cartera?dias=60
 *
 * Para cada empresa calcula sus obligaciones próximas (303, 130, 111, 115,
 * 390, 200, 347, 349, 720…) y las consolida en una lista ordenada por
 * fecha límite. Marca cuáles ya están presentadas vs pendientes.
 */
type Item = Obligacion & {
  empresa_id: string;
  empresa_nombre: string | null;
  empresa_tipo: "autonomo" | "empresa";
};

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const admin = createSupabaseAdmin();
  const { data: perfil } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  if (perfil?.rol !== "admin" && perfil?.rol !== "gestor") return jsonError("Sin permiso", 403);

  const horizonte = Math.min(180, Math.max(7, Number(request.nextUrl.searchParams.get("dias") ?? 60)));

  let q = admin.from("empresas").select("id,nombre,tipo,account_type");
  if (perfil.rol === "gestor") q = q.eq("gestor_id", user.id);
  const { data: empresas } = await q;
  const lista = empresas ?? [];

  if (lista.length === 0) {
    return NextResponse.json({ ok: true, items: [], totales: vacio() });
  }

  const empresaIds = lista.map((e) => e.id);
  const { data: presentadas } = await admin
    .from("aeat_presentaciones")
    .select("empresa_id,modelo,ejercicio,periodo")
    .in("empresa_id", empresaIds);
  const porEmpresa = new Map<string, Array<{ modelo: string; ejercicio: number; periodo: string }>>();
  for (const p of presentadas ?? []) {
    if (!porEmpresa.has(p.empresa_id)) porEmpresa.set(p.empresa_id, []);
    porEmpresa.get(p.empresa_id)!.push({ modelo: p.modelo, ejercicio: p.ejercicio, periodo: p.periodo });
  }

  const items: Item[] = [];
  for (const e of lista) {
    const tipo: "autonomo" | "empresa" = e.account_type === "empresa" || e.tipo === "empresa" ? "empresa" : "autonomo";
    const cal = buildCalendar({
      empresaTipo: tipo,
      presentadas: porEmpresa.get(e.id) ?? [],
      horizonteDias: horizonte,
    });
    for (const o of cal) {
      items.push({
        ...o,
        empresa_id: e.id,
        empresa_nombre: e.nombre,
        empresa_tipo: tipo,
      });
    }
  }

  items.sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite));

  const totales = items.reduce((acc, it) => ({
    total: acc.total + 1,
    pendientes: acc.pendientes + (it.esta_presentada ? 0 : 1),
    presentadas: acc.presentadas + (it.esta_presentada ? 1 : 0),
    urgentes: acc.urgentes + (!it.esta_presentada && it.dias_restantes <= 7 ? 1 : 0),
    vencidas: acc.vencidas + (!it.esta_presentada && it.dias_restantes < 0 ? 1 : 0),
  }), vacio());

  return NextResponse.json({ ok: true, horizonte_dias: horizonte, items, totales });
}

function vacio() {
  return { total: 0, pendientes: 0, presentadas: 0, urgentes: 0, vencidas: 0 };
}
