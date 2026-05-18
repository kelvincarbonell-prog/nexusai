import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Listado de cosas pendientes de firma/revisión del gestor.
 * Combina:
 *   - Modelos AEAT en estado "borrador" o "preparado"
 *   - Nóminas del mes en curso sin publicar al portal
 *   - Facturas emitidas en "borrador" listas para enviar
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const admin = createSupabaseAdmin();
  const { data: profile } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  const empresasQ = isAdmin
    ? admin.from("empresas").select("id,nombre").order("nombre").limit(500)
    : admin.from("empresas").select("id,nombre").or(`gestor_id.eq.${user.id},owner_user_id.eq.${user.id}`).limit(500);
  const { data: empresas } = await empresasQ;
  if (!empresas || empresas.length === 0) return NextResponse.json({ ok: true, items: [] });

  const empresaIds = empresas.map((e) => e.id);
  const empresaMap = new Map(empresas.map((e) => [e.id, e]));

  type Item = {
    kind: "modelo_aeat" | "nomina" | "factura";
    id: string;
    empresa_id: string;
    empresa_nombre: string;
    titulo: string;
    subtitulo: string;
    importe?: number;
    confidence?: number;
    link: string;
    firmable: boolean;
  };

  const items: Item[] = [];

  // 1) Modelos AEAT en draft/preparado
  const { data: modelos } = await admin
    .from("aeat_declaraciones")
    .select("id,empresa_id,modelo,ejercicio,periodo,status,casillas,updated_at")
    .in("empresa_id", empresaIds)
    .in("status", ["draft", "borrador", "preparado", "listo"])
    .order("updated_at", { ascending: false })
    .limit(10);
  for (const m of modelos ?? []) {
    const empresa = empresaMap.get(m.empresa_id);
    if (!empresa) continue;
    const cas = (m.casillas ?? {}) as Record<string, number>;
    const importe = Number(cas.c01 ?? cas.cuota ?? cas.total ?? 0);
    items.push({
      kind: "modelo_aeat",
      id: m.id,
      empresa_id: m.empresa_id,
      empresa_nombre: empresa.nombre ?? "—",
      titulo: `Modelo ${m.modelo}`,
      subtitulo: `${m.periodo} ${m.ejercicio}`,
      importe: importe || undefined,
      link: `/aeat?modelo=${m.modelo}`,
      firmable: true,
    });
  }

  // 2) Nóminas del mes en curso sin publicar al portal del trabajador
  const yyyymm = new Date().toISOString().slice(0, 7);
  const { data: nominas } = await admin
    .from("nominas")
    .select("id,empresa_id,trabajador_id,periodo,total,metadata")
    .in("empresa_id", empresaIds)
    .eq("periodo", yyyymm)
    .limit(50);

  // Agrupa nóminas por empresa
  const nominasByEmpresa = new Map<string, typeof nominas>();
  for (const n of nominas ?? []) {
    if (!n.empresa_id) continue;
    const arr = nominasByEmpresa.get(n.empresa_id) ?? [];
    arr.push(n);
    nominasByEmpresa.set(n.empresa_id, arr);
  }
  for (const [empresaId, lista] of nominasByEmpresa.entries()) {
    const empresa = empresaMap.get(empresaId);
    if (!empresa || !lista || lista.length === 0) continue;
    const total = lista.reduce((s, n) => s + Number(n.total ?? 0), 0);
    items.push({
      kind: "nomina",
      id: `nominas-${empresaId}-${yyyymm}`,
      empresa_id: empresaId,
      empresa_nombre: empresa.nombre ?? "—",
      titulo: `Nóminas ${yyyymm}`,
      subtitulo: `${lista.length} empleados`,
      importe: total,
      link: `/laboral?empresa=${empresaId}`,
      firmable: false,
    });
  }

  // 3) Facturas emitidas en estado borrador
  const { data: facturas } = await admin
    .from("facturas")
    .select("id,empresa_id,numero,serie,fecha_emision,total,contacto_nombre,estado")
    .in("empresa_id", empresaIds)
    .in("tipo", ["emitida", "simplificada"])
    .eq("estado", "borrador")
    .order("fecha_emision", { ascending: false })
    .limit(10);
  for (const f of facturas ?? []) {
    const empresa = empresaMap.get(f.empresa_id);
    if (!empresa) continue;
    items.push({
      kind: "factura",
      id: f.id,
      empresa_id: f.empresa_id,
      empresa_nombre: empresa.nombre ?? "—",
      titulo: `Factura ${f.serie ?? ""}${f.numero ?? ""}`,
      subtitulo: `${f.contacto_nombre ?? "—"} · ${f.fecha_emision ?? ""}`,
      importe: Number(f.total ?? 0),
      link: `/facturacion?id=${f.id}`,
      firmable: false,
    });
  }

  return NextResponse.json({ ok: true, items: items.slice(0, 8) });
}
