import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { parseN43 } from "@/lib/accounting/parse-n43";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  contenido: z.string().min(80).max(5_000_000),
  preview: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const result = parseN43(parsed.data.contenido);
  if (!result.ok) return jsonError(result.error ?? "No se pudo parsear el fichero N43");

  if (parsed.data.preview) {
    return NextResponse.json({
      ok: true,
      cuentas: result.cuentas.map((c) => ({
        ...c,
        movimientos: c.movimientos.slice(0, 10),
        _truncated: c.movimientos.length > 10,
      })),
      total_movimientos: result.total_movimientos,
    });
  }

  // Insertar todos los movimientos
  const rows: Array<Record<string, unknown>> = [];
  for (const cuenta of result.cuentas) {
    let saldoAcum = cuenta.saldo_inicial;
    for (const m of cuenta.movimientos) {
      saldoAcum += m.importe;
      rows.push({
        empresa_id: parsed.data.empresa_id,
        iban: cuenta.iban,
        banco: cuenta.banco,
        oficina: cuenta.oficina,
        cuenta: cuenta.cuenta,
        fecha_operacion: m.fecha_operacion,
        fecha_valor: m.fecha_valor,
        importe: m.importe,
        divisa: cuenta.divisa,
        concepto_comun: m.concepto_comun,
        concepto_propio: m.concepto_propio,
        referencia1: m.referencia1,
        referencia2: m.referencia2,
        saldo_acumulado: saldoAcum,
        origen: "n43",
        reconciled: false,
      });
    }
  }

  let importados = 0;
  if (rows.length > 0) {
    // Inserción en lotes de 500 para evitar payload demasiado grande
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error, count } = await admin.from("bank_movements").insert(batch, { count: "exact" });
      if (error) return jsonError(error.message, 500);
      importados += count ?? batch.length;
    }
  }

  return NextResponse.json({
    ok: true,
    cuentas: result.cuentas.length,
    movimientos_importados: importados,
    saldo_final: result.cuentas[0]?.saldo_final ?? null,
  });
}
