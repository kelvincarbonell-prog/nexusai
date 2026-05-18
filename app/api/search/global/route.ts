import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

const Q = z.object({ q: z.string().min(2).max(120) });

/**
 * Búsqueda global cross-cliente para el Cmd+K.
 *
 * Busca en facturas (número/contacto/total), gastos (proveedor/concepto/total)
 * y trabajadores (nombre/apellidos/DNI) de las empresas accesibles para el
 * usuario. Limita resultados para mantener el palette ágil.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Q.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Query inválida");
  const q = parsed.data.q;

  const admin = createSupabaseAdmin();
  const { data: profile } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  // Empresas accesibles
  const empresasQ = isAdmin
    ? admin.from("empresas").select("id").limit(1000)
    : admin.from("empresas").select("id").or(`gestor_id.eq.${user.id},owner_user_id.eq.${user.id}`).limit(1000);
  const { data: empresas } = await empresasQ;
  const empresaIds = (empresas ?? []).map((e) => e.id);
  if (empresaIds.length === 0) {
    return NextResponse.json({ ok: true, facturas: [], gastos: [], trabajadores: [] });
  }

  const isNumber = /^\d+([.,]\d+)?$/.test(q);
  const totalValue = isNumber ? Number(q.replace(",", ".")) : null;
  const like = `%${q}%`;

  // Búsqueda en paralelo
  const [facturasRes, gastosRes, trabajadoresRes] = await Promise.all([
    (async () => {
      let qb = admin
        .from("facturas")
        .select("id,empresa_id,numero,serie,contacto_nombre,total,fecha_emision")
        .in("empresa_id", empresaIds)
        .order("fecha_emision", { ascending: false })
        .limit(8);
      if (totalValue !== null) {
        qb = qb.gte("total", totalValue * 0.95).lte("total", totalValue * 1.05);
      } else {
        qb = qb.or(`numero.ilike.${like},contacto_nombre.ilike.${like},contacto_nif.ilike.${like}`);
      }
      return qb;
    })(),
    (async () => {
      let qb = admin
        .from("gastos")
        .select("id,empresa_id,proveedor,concepto,total,fecha")
        .in("empresa_id", empresaIds)
        .order("fecha", { ascending: false })
        .limit(8);
      if (totalValue !== null) {
        qb = qb.gte("total", totalValue * 0.95).lte("total", totalValue * 1.05);
      } else {
        qb = qb.or(`proveedor.ilike.${like},concepto.ilike.${like}`);
      }
      return qb;
    })(),
    admin
      .from("trabajadores")
      .select("id,empresa_id,nombre,apellidos,dni,nss")
      .in("empresa_id", empresaIds)
      .or(`nombre.ilike.${like},apellidos.ilike.${like},dni.ilike.${like},nss.ilike.${like}`)
      .limit(8),
  ]);

  return NextResponse.json({
    ok: true,
    facturas: facturasRes.data ?? [],
    gastos: gastosRes.data ?? [],
    trabajadores: trabajadoresRes.data ?? [],
  });
}
