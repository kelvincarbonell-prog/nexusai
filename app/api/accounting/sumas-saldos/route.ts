import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

const Q = z.object({
  empresa_id: z.string().uuid(),
  ejercicio: z.coerce.number().int().min(2020).max(2099),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  formato: z.enum(["json", "csv"]).default("json"),
  nivel: z.coerce.number().int().min(1).max(8).default(8),  // dígitos del código de cuenta a agrupar
});

/**
 * Balance de Sumas y Saldos por cuenta.
 *
 * Para cada cuenta del PGC:
 *   - Suma debe
 *   - Suma haber
 *   - Saldo (debe - haber)
 *
 * Permite agrupar por niveles (1 dígito = grupos contables, 8 = subcuentas).
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Q.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const desde = `${parsed.data.ejercicio}-01-01`;
  const hasta = parsed.data.hasta ?? `${parsed.data.ejercicio}-12-31`;

  const [{ data: entries }, { data: lines }] = await Promise.all([
    admin
      .from("journal_entries")
      .select("id")
      .eq("empresa_id", parsed.data.empresa_id)
      .gte("entry_date", desde)
      .lte("entry_date", hasta)
      .neq("status", "draft"),
    admin
      .from("journal_lines")
      .select("account_id,debit,credit,entry_id")
      .eq("empresa_id", parsed.data.empresa_id),
  ]);

  const validIds = new Set((entries ?? []).map((e) => e.id));
  const accIds = Array.from(new Set((lines ?? []).map((l) => l.account_id)));
  const { data: accounts } = await admin
    .from("pgc_accounts")
    .select("id,code,name,account_type")
    .in("id", accIds);
  const accMap = new Map((accounts ?? []).map((a) => [a.id, a]));

  // Agrega por cuenta al nivel solicitado
  type Row = { code: string; name: string; debe: number; haber: number; saldo: number; tipo?: string };
  const agg = new Map<string, Row>();
  for (const l of lines ?? []) {
    if (!validIds.has(l.entry_id)) continue;
    const a = accMap.get(l.account_id);
    if (!a) continue;
    const code = String(a.code).slice(0, parsed.data.nivel);
    const prev = agg.get(code) ?? { code, name: a.name, debe: 0, haber: 0, saldo: 0, tipo: a.account_type };
    prev.debe += Number(l.debit ?? 0);
    prev.haber += Number(l.credit ?? 0);
    prev.saldo = prev.debe - prev.haber;
    agg.set(code, prev);
  }

  const items = Array.from(agg.values()).sort((a, b) => a.code.localeCompare(b.code));
  const totales = items.reduce(
    (acc, r) => ({ debe: acc.debe + r.debe, haber: acc.haber + r.haber }),
    { debe: 0, haber: 0 },
  );

  if (parsed.data.formato === "csv") {
    const rows = [
      "Cuenta;Nombre;Debe;Haber;Saldo",
      ...items.map((r) => `${r.code};${(r.name ?? "").replace(/;/g, ",")};${r.debe.toFixed(2)};${r.haber.toFixed(2)};${r.saldo.toFixed(2)}`),
      `TOTAL;;${totales.debe.toFixed(2)};${totales.haber.toFixed(2)};${(totales.debe - totales.haber).toFixed(2)}`,
    ].join("\n");
    return new NextResponse(rows, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sumas-saldos-${parsed.data.ejercicio}.csv"`,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    ejercicio: parsed.data.ejercicio,
    desde, hasta,
    nivel: parsed.data.nivel,
    items,
    totales: {
      debe: Math.round(totales.debe * 100) / 100,
      haber: Math.round(totales.haber * 100) / 100,
      diferencia: Math.round((totales.debe - totales.haber) * 100) / 100,
      n_cuentas: items.length,
    },
  });
}
