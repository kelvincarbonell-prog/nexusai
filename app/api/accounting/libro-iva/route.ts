import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { buildLibroRepercutido, buildLibroSoportado, libroToCSV } from "@/lib/accounting/libro-iva";

const Query = z.object({
  empresa_id: z.string().uuid(),
  ejercicio: z.coerce.number().int().min(2020).max(2099),
  periodo: z.enum(["1T", "2T", "3T", "4T", "ANUAL"]).default("ANUAL"),
  tipo: z.enum(["repercutido", "soportado"]).default("repercutido"),
  formato: z.enum(["json", "csv"]).default("json"),
});

function rangoTrimestre(year: number, periodo: string): { from: string; to: string } {
  if (periodo === "1T") return { from: `${year}-01-01`, to: `${year}-03-31` };
  if (periodo === "2T") return { from: `${year}-04-01`, to: `${year}-06-30` };
  if (periodo === "3T") return { from: `${year}-07-01`, to: `${year}-09-30` };
  if (periodo === "4T") return { from: `${year}-10-01`, to: `${year}-12-31` };
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const { from, to } = rangoTrimestre(parsed.data.ejercicio, parsed.data.periodo);
  const tipoFactura = parsed.data.tipo === "repercutido" ? "emitida" : "recibida";

  const { data: facturas } = await admin
    .from("facturas")
    .select("id,numero,fecha_emision,contacto_nombre,base,iva,total,metadata,tipo")
    .eq("empresa_id", parsed.data.empresa_id)
    .eq("tipo", tipoFactura)
    .gte("fecha_emision", from)
    .lte("fecha_emision", to);

  let libro;
  if (parsed.data.tipo === "repercutido") {
    libro = buildLibroRepercutido(
      (facturas ?? []).map((f) => ({
        id: f.id,
        numero: f.numero,
        fecha_emision: f.fecha_emision,
        contacto_nombre: f.contacto_nombre,
        base: Number(f.base ?? 0),
        iva: Number(f.iva ?? 0),
        total: Number(f.total ?? 0),
        metadata: (f.metadata ?? {}) as Record<string, unknown>,
      })),
    );
  } else {
    const { data: gastos } = await admin
      .from("gastos")
      .select("id,fecha,proveedor,concepto,base,iva,total,metadata")
      .eq("empresa_id", parsed.data.empresa_id)
      .gte("fecha", from)
      .lte("fecha", to);
    libro = buildLibroSoportado(
      (facturas ?? []).map((f) => ({
        id: f.id,
        numero: f.numero,
        fecha_emision: f.fecha_emision,
        contacto_nombre: f.contacto_nombre,
        base: Number(f.base ?? 0),
        iva: Number(f.iva ?? 0),
        total: Number(f.total ?? 0),
        metadata: (f.metadata ?? {}) as Record<string, unknown>,
      })),
      (gastos ?? []).map((g) => ({
        id: g.id,
        fecha: g.fecha,
        proveedor: g.proveedor,
        concepto: g.concepto,
        base: Number(g.base ?? 0),
        iva: Number(g.iva ?? 0),
        total: Number(g.total ?? 0),
        metadata: (g.metadata ?? {}) as Record<string, unknown>,
      })),
    );
  }

  if (parsed.data.formato === "csv") {
    const titulo = `Libro de IVA ${parsed.data.tipo === "repercutido" ? "REPERCUTIDO" : "SOPORTADO"} · ${parsed.data.periodo} ${parsed.data.ejercicio}`;
    const csv = libroToCSV(libro, titulo);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="libro-iva-${parsed.data.tipo}-${parsed.data.periodo}-${parsed.data.ejercicio}.csv"`,
      },
    });
  }

  return NextResponse.json({ ok: true, libro, ejercicio: parsed.data.ejercicio, periodo: parsed.data.periodo, tipo: parsed.data.tipo });
}
