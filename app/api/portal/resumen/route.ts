import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);

  const now = new Date();
  const year = now.getUTCFullYear();
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const [facturasEmit, facturasReci, gastos, tareasPendientes, ocrPending, declaraciones] = await Promise.all([
    admin
      .from("facturas")
      .select("base,iva,total,fecha_emision,estado", { count: "exact" })
      .eq("empresa_id", empresaId)
      .in("tipo", ["emitida", "simplificada"])
      .gte("fecha_emision", from)
      .lte("fecha_emision", to),
    admin
      .from("facturas")
      .select("base,iva,total,fecha_emision,estado", { count: "exact" })
      .eq("empresa_id", empresaId)
      .eq("tipo", "recibida")
      .gte("fecha_emision", from)
      .lte("fecha_emision", to),
    admin
      .from("gastos")
      .select("total,fecha,estado", { count: "exact" })
      .eq("empresa_id", empresaId)
      .gte("fecha", from)
      .lte("fecha", to),
    admin
      .from("tareas")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .neq("estado", "completada"),
    admin
      .from("facturas_recibidas_extracciones")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .in("status", ["pending", "extracted"]),
    admin
      .from("aeat_declaraciones")
      .select("modelo,periodo,ejercicio,status,resultado,updated_at")
      .eq("empresa_id", empresaId)
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);

  const sum = (arr: { total?: number | string }[] | null) =>
    (arr ?? []).reduce((s, r) => s + Number(r.total ?? 0), 0);

  const emitidasTotal = sum(facturasEmit.data);
  const recibidasTotal = sum(facturasReci.data);
  const gastosTotal = sum(gastos.data);

  const pendienteCobro = (facturasEmit.data ?? [])
    .filter((f) => f.estado !== "pagada")
    .reduce((s, r) => s + Number(r.total ?? 0), 0);

  return NextResponse.json({
    ok: true,
    ejercicio: year,
    facturado: emitidasTotal,
    facturado_count: facturasEmit.count ?? 0,
    recibido: recibidasTotal,
    recibido_count: facturasReci.count ?? 0,
    gastos: gastosTotal,
    gastos_count: gastos.count ?? 0,
    resultado_estimado: emitidasTotal - gastosTotal - recibidasTotal,
    pendiente_cobro: pendienteCobro,
    tareas_pendientes: tareasPendientes.count ?? 0,
    ocr_pendientes: ocrPending.count ?? 0,
    declaraciones: declaraciones.data ?? [],
  });
}
