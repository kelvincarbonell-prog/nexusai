import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { calcular347, type FacturaInput } from "@/lib/aeat/calc/m347";
import { generateFicheroM347 } from "@/lib/aeat/export/text-modelos";

const Query = z.object({
  empresa_id: z.string().uuid(),
  ejercicio: z.coerce.number().int().min(2017).max(2100),
  formato: z.enum(["json", "txt"]).default("json"),
});

/**
 * GET /api/aeat/m347?empresa_id=...&ejercicio=2025&formato=json|txt
 *
 * Calcula el modelo 347 (operaciones con terceros >3.005,06€) para un
 * ejercicio. Devuelve JSON con operadores + casillas, o el TXT posicional
 * listo para AEAT.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");
  const { empresa_id, ejercicio, formato } = parsed.data;

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresa_id))) return jsonError("Sin acceso", 403);

  const { data: empresa } = await admin
    .from("empresas")
    .select("nif,nombre")
    .eq("id", empresa_id)
    .maybeSingle();

  const from = `${ejercicio}-01-01`;
  const to = `${ejercicio}-12-31`;
  const [emitRes, reciRes, gastRes] = await Promise.all([
    admin
      .from("facturas")
      .select("id,tipo,contacto_nombre,contacto_nif,base,iva,fecha_emision,metadata")
      .eq("empresa_id", empresa_id)
      .in("tipo", ["emitida", "simplificada"])
      .gte("fecha_emision", from)
      .lte("fecha_emision", to),
    admin
      .from("facturas")
      .select("id,tipo,contacto_nombre,contacto_nif,base,iva,fecha_emision,metadata")
      .eq("empresa_id", empresa_id)
      .eq("tipo", "recibida")
      .gte("fecha_emision", from)
      .lte("fecha_emision", to),
    admin
      .from("gastos")
      .select("id,proveedor,proveedor_nif,base,iva,fecha,metadata")
      .eq("empresa_id", empresa_id)
      .gte("fecha", from)
      .lte("fecha", to),
  ]);

  const facturas: FacturaInput[] = [];
  for (const r of emitRes.data ?? []) {
    facturas.push({
      id: r.id,
      tipo: r.tipo === "simplificada" ? "simplificada" : "emitida",
      contacto_nombre: r.contacto_nombre,
      contacto_nif: r.contacto_nif,
      base: Number(r.base ?? 0),
      iva: Number(r.iva ?? 0),
      fecha_emision: r.fecha_emision,
      metadata: r.metadata as Record<string, unknown> | null,
    });
  }
  for (const r of reciRes.data ?? []) {
    facturas.push({
      id: r.id,
      tipo: "recibida",
      contacto_nombre: r.contacto_nombre,
      contacto_nif: r.contacto_nif,
      base: Number(r.base ?? 0),
      iva: Number(r.iva ?? 0),
      fecha_emision: r.fecha_emision,
      metadata: r.metadata as Record<string, unknown> | null,
    });
  }
  for (const g of gastRes.data ?? []) {
    facturas.push({
      id: g.id,
      tipo: "recibida",
      contacto_nombre: g.proveedor,
      contacto_nif: g.proveedor_nif,
      base: Number(g.base ?? 0),
      iva: Number(g.iva ?? 0),
      fecha_emision: g.fecha,
      metadata: g.metadata as Record<string, unknown> | null,
    });
  }

  const resultado = calcular347({ facturas });

  if (formato === "txt") {
    if (!empresa?.nif || !empresa?.nombre) {
      return jsonError("La empresa necesita NIF y nombre para generar el TXT AEAT", 400);
    }
    const operadoresTxt = resultado.operadores.map((o) => ({
      nif: o.contacto_nif ?? "",
      nombre: o.contacto_nombre,
      clave: o.tipo === "cliente" ? ("B" as const) : ("A" as const),
      importe_anual: o.importe_anual,
      t1: o.t1,
      t2: o.t2,
      t3: o.t3,
      t4: o.t4,
    }));
    const txt = generateFicheroM347(
      { ejercicio, nif: empresa.nif, nombre: empresa.nombre, modelo: "347", periodo: "0A" },
      operadoresTxt,
    );
    return new NextResponse(txt, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `attachment; filename="m347-${empresa.nif}-${ejercicio}.txt"`,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    ejercicio,
    empresa: { nombre: empresa?.nombre ?? null, nif: empresa?.nif ?? null },
    ...resultado,
  });
}
