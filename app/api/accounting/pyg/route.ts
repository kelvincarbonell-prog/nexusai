import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { calcularPyG, type Saldo } from "@/lib/accounting/pyg-balance";

const Query = z.object({
  empresa_id: z.string().uuid(),
  ejercicio: z.coerce.number().int().min(2020).max(2099),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const desde = parsed.data.desde ?? `${parsed.data.ejercicio}-01-01`;
  const hasta = parsed.data.hasta ?? `${parsed.data.ejercicio}-12-31`;

  // Lee solo asientos posted del rango y agrega por cuenta
  const [{ data: entries }, { data: lines }] = await Promise.all([
    admin
      .from("journal_entries")
      .select("id,entry_date,status")
      .eq("empresa_id", parsed.data.empresa_id)
      .gte("entry_date", desde)
      .lte("entry_date", hasta)
      .neq("status", "draft"),
    admin
      .from("journal_lines")
      .select("debit,credit,account_id,entry_id")
      .eq("empresa_id", parsed.data.empresa_id),
  ]);

  const validIds = new Set((entries ?? []).map((e) => e.id));
  const accountIds = Array.from(new Set((lines ?? []).map((l) => l.account_id)));
  const { data: accounts } = await admin
    .from("pgc_accounts")
    .select("id,code,name")
    .in("id", accountIds);
  const codeMap = new Map((accounts ?? []).map((a) => [a.id, { code: a.code, name: a.name }]));

  const saldosMap = new Map<string, Saldo>();
  for (const l of lines ?? []) {
    if (!validIds.has(l.entry_id)) continue;
    const acc = codeMap.get(l.account_id);
    if (!acc) continue;
    const prev = saldosMap.get(acc.code) ?? { code: acc.code, name: acc.name, debit: 0, credit: 0 };
    prev.debit += Number(l.debit ?? 0);
    prev.credit += Number(l.credit ?? 0);
    saldosMap.set(acc.code, prev);
  }

  const saldos = Array.from(saldosMap.values());
  const pyg = calcularPyG(saldos);

  return NextResponse.json({ ok: true, ...pyg, ejercicio: parsed.data.ejercicio, desde, hasta });
}
