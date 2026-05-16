import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { mapearFacturas, mapearGastos, parseCsv } from "@/lib/billing/csv-import";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  csv_content: z.string().min(10).max(2_000_000),
  destino: z.enum(["facturas_emitidas", "facturas_recibidas", "gastos"]),
  dry_run: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const csv = parseCsv(parsed.data.csv_content);
  if (csv.rows.length === 0) return jsonError("CSV vacío o mal formado", 400);

  if (parsed.data.destino === "gastos") {
    const { gastos, errores } = mapearGastos(csv);
    if (parsed.data.dry_run) return NextResponse.json({ ok: true, preview: gastos.slice(0, 10), total: gastos.length, errores });
    const rows = gastos.map((g) => ({
      empresa_id: parsed.data.empresa_id,
      gestor_id: user.id,
      proveedor: g.proveedor,
      concepto: g.concepto,
      fecha: g.fecha,
      base: g.base,
      iva: g.iva,
      total: g.total,
      metadata: { importado_csv: true },
    }));
    if (rows.length === 0) return jsonError("Nada que importar", 400);
    const { error } = await admin.from("gastos").insert(rows);
    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true, importados: rows.length, errores });
  }

  const tipo = parsed.data.destino === "facturas_recibidas" ? "recibida" : "emitida";
  const { facturas, errores } = mapearFacturas(csv, tipo);
  if (parsed.data.dry_run) return NextResponse.json({ ok: true, preview: facturas.slice(0, 10), total: facturas.length, errores });
  const rows = facturas.map((f) => ({
    empresa_id: parsed.data.empresa_id,
    gestor_id: user.id,
    numero: f.numero,
    tipo: f.tipo,
    contacto_nombre: f.contacto_nombre,
    fecha_emision: f.fecha_emision,
    fecha_vencimiento: f.fecha_vencimiento,
    base: f.base,
    iva: f.iva,
    total: f.total,
    estado: "borrador",
    metadata: { importado_csv: true, contacto_nif: f.contacto_nif },
  }));
  if (rows.length === 0) return jsonError("Nada que importar", 400);
  const { error } = await admin.from("facturas").insert(rows);
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, importados: rows.length, errores });
}
