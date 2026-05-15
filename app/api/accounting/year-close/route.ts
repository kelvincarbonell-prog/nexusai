import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { calcularAsientoApertura, calcularAsientoCierre, calcularRegularizacion, type SaldoCuenta } from "@/lib/accounting/year-close";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  ejercicio: z.number().int().min(2020).max(2099),
  preview: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const from = `${parsed.data.ejercicio}-01-01`;
  const to = `${parsed.data.ejercicio}-12-31`;

  // Saldos por cuenta: suma debit - sum credit del año, excluyendo asientos en draft
  const { data: lines } = await admin
    .from("journal_lines")
    .select("debit,credit,account_id,entry_id")
    .eq("empresa_id", parsed.data.empresa_id);
  const { data: entries } = await admin
    .from("journal_entries")
    .select("id,status,entry_date")
    .eq("empresa_id", parsed.data.empresa_id)
    .gte("entry_date", from)
    .lte("entry_date", to)
    .neq("status", "draft");
  const validEntryIds = new Set((entries ?? []).map((e) => e.id));

  const saldosMap = new Map<string, { debit: number; credit: number }>();
  for (const l of lines ?? []) {
    if (!validEntryIds.has(l.entry_id)) continue;
    const prev = saldosMap.get(l.account_id) ?? { debit: 0, credit: 0 };
    prev.debit += Number(l.debit ?? 0);
    prev.credit += Number(l.credit ?? 0);
    saldosMap.set(l.account_id, prev);
  }

  const accountIds = Array.from(saldosMap.keys());
  const { data: accounts } = await admin
    .from("pgc_accounts")
    .select("id,code,name")
    .in("id", accountIds);
  const accountMap = new Map((accounts ?? []).map((a) => [a.id, a]));

  const saldos: SaldoCuenta[] = [];
  for (const [accountId, sums] of saldosMap.entries()) {
    const a = accountMap.get(accountId);
    if (!a) continue;
    const saldo = sums.debit - sums.credit;
    if (Math.abs(saldo) < 0.005) continue;
    saldos.push({ account_id: accountId, code: a.code, saldo });
  }

  // Buscar la cuenta 129 (resultado del ejercicio) de la empresa o global
  const { data: cuenta129 } = await admin
    .from("pgc_accounts")
    .select("id,code,name")
    .or(`empresa_id.is.null,empresa_id.eq.${parsed.data.empresa_id}`)
    .like("code", "129%")
    .order("code")
    .limit(1)
    .maybeSingle();

  const reg = calcularRegularizacion(saldos);
  // Reemplazar placeholder 129 con el real
  for (const l of reg.lineas) {
    if (l.code === "129" && cuenta129) l.account_id = cuenta129.id;
  }

  // Saldos posteriores a regularización: aplicamos la regularización a los saldos
  const saldosPostReg = new Map<string, number>();
  for (const s of saldos) saldosPostReg.set(s.account_id, s.saldo);
  for (const l of reg.lineas) {
    if (l.account_id === "PLACEHOLDER_129") continue;
    const prev = saldosPostReg.get(l.account_id) ?? 0;
    saldosPostReg.set(l.account_id, prev + l.debit - l.credit);
  }
  // Añadir saldo 129
  if (cuenta129 && reg.resultado !== 0) {
    saldosPostReg.set(cuenta129.id, (saldosPostReg.get(cuenta129.id) ?? 0) - reg.resultado);
  }

  const saldosCierre: SaldoCuenta[] = [];
  for (const [accountId, saldo] of saldosPostReg.entries()) {
    if (Math.abs(saldo) < 0.005) continue;
    const a = accountMap.get(accountId) ?? (cuenta129 && accountId === cuenta129.id ? cuenta129 : null);
    if (!a) continue;
    saldosCierre.push({ account_id: accountId, code: a.code, saldo });
  }

  const cierre = calcularAsientoCierre(saldosCierre);
  const apertura = calcularAsientoApertura(cierre);

  const empresaId = parsed.data.empresa_id;
  const userId = user.id;
  const ejercicio = parsed.data.ejercicio;
  const cuenta129Resolved = cuenta129;

  if (parsed.data.preview) {
    return NextResponse.json({
      ok: true,
      ejercicio,
      resultado_ejercicio: reg.resultado,
      regularizacion: reg.lineas.filter((l) => l.account_id !== "PLACEHOLDER_129"),
      cierre,
      apertura,
      n_cuentas: saldos.length,
    });
  }

  async function createEntry(date: string, description: string, lineas: typeof cierre): Promise<{ id: string } | null> {
    const { data: lastEntry } = await admin
      .from("journal_entries")
      .select("entry_number")
      .eq("empresa_id", empresaId)
      .order("entry_number", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    const { data: entry, error } = await admin
      .from("journal_entries")
      .insert({
        empresa_id: empresaId,
        entry_number: Number(lastEntry?.entry_number ?? 0) + 1,
        entry_date: date,
        description,
        status: "posted",
        created_by: userId,
        posted_by: userId,
        posted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !entry) return null;
    await admin.from("journal_lines").insert(
      lineas
        .filter((l) => l.account_id !== "PLACEHOLDER_129" || cuenta129Resolved)
        .map((l, i) => ({
          entry_id: entry.id,
          empresa_id: empresaId,
          account_id: l.account_id === "PLACEHOLDER_129" && cuenta129Resolved ? cuenta129Resolved.id : l.account_id,
          line_number: i + 1,
          description: l.description,
          debit: l.debit,
          credit: l.credit,
        })),
    );
    return entry;
  }

  const regEntry = await createEntry(`${ejercicio}-12-31`, "Regularización del ejercicio", reg.lineas);
  const cierreEntry = await createEntry(`${ejercicio}-12-31`, "Asiento de cierre", cierre);
  const aperturaEntry = await createEntry(`${ejercicio + 1}-01-01`, "Asiento de apertura", apertura);

  return NextResponse.json({
    ok: true,
    resultado_ejercicio: reg.resultado,
    regularizacion_id: regEntry?.id,
    cierre_id: cierreEntry?.id,
    apertura_id: aperturaEntry?.id,
  });
}
