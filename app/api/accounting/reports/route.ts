import { NextRequest, NextResponse } from "next/server";
import { canAccessAccountingCompany } from "@/lib/accounting/access";
import { jsonError } from "@/lib/http";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getUserFromRequest } from "@/lib/supabase/auth";

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");

  const admin = createSupabaseAdmin();
  const canAccess = await canAccessAccountingCompany(admin, user.id, empresaId);
  if (!canAccess) return jsonError("No autorizado", 403);

  const [{ data: lines, error: linesError }, { data: vatRows }, { data: assets }, { data: periods }] = await Promise.all([
    admin
      .from("journal_lines")
      .select("debit,credit,account:pgc_accounts(code,name,account_type)")
      .eq("empresa_id", empresaId),
    admin.from("vat_ledger").select("kind,base,vat_amount,tax_period").eq("empresa_id", empresaId),
    admin.from("fixed_assets").select("acquisition_cost,residual_value,useful_life_months,status").eq("empresa_id", empresaId),
    admin
      .from("accounting_periods")
      .select("fiscal_year,status,starts_on,ends_on")
      .eq("empresa_id", empresaId)
      .order("fiscal_year", { ascending: false }),
  ]);

  if (linesError) return jsonError(linesError.message, 500);

  const trial = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>();
  for (const line of lines ?? []) {
    const account = Array.isArray(line.account) ? line.account[0] : line.account;
    const code = account?.code ?? "000";
    const current = trial.get(code) ?? {
      code,
      name: account?.name ?? "Cuenta sin nombre",
      type: account?.account_type ?? "memo",
      debit: 0,
      credit: 0,
    };
    current.debit += Number(line.debit ?? 0);
    current.credit += Number(line.credit ?? 0);
    trial.set(code, current);
  }

  const rows = [...trial.values()].sort((a, b) => a.code.localeCompare(b.code));
  const profitAndLoss = rows.reduce(
    (acc, row) => {
      if (row.type === "income") acc.income += row.credit - row.debit;
      if (row.type === "expense") acc.expense += row.debit - row.credit;
      acc.result = acc.income - acc.expense;
      return acc;
    },
    { income: 0, expense: 0, result: 0 },
  );
  const balanceSheet = rows.reduce(
    (acc, row) => {
      if (row.type === "asset") acc.assets += row.debit - row.credit;
      if (row.type === "liability") acc.liabilities += row.credit - row.debit;
      if (row.type === "equity") acc.equity += row.credit - row.debit;
      return acc;
    },
    { assets: 0, liabilities: 0, equity: 0 },
  );
  const vat = (vatRows ?? []).reduce(
    (acc, row) => {
      const base = Number(row.base ?? 0);
      const amount = Number(row.vat_amount ?? 0);
      if (row.kind === "output") {
        acc.outputBase += base;
        acc.outputVat += amount;
      } else {
        acc.inputBase += base;
        acc.inputVat += amount;
      }
      acc.payable = acc.outputVat - acc.inputVat;
      return acc;
    },
    { outputBase: 0, outputVat: 0, inputBase: 0, inputVat: 0, payable: 0 },
  );
  const fixedAssets = (assets ?? []).reduce(
    (acc, asset) => {
      const cost = Number(asset.acquisition_cost ?? 0);
      const residual = Number(asset.residual_value ?? 0);
      const months = Number(asset.useful_life_months ?? 0);
      acc.acquisitionCost += cost;
      acc.monthlyAmortization += months > 0 ? (cost - residual) / months : 0;
      if (asset.status === "active") acc.active += 1;
      return acc;
    },
    { active: 0, acquisitionCost: 0, monthlyAmortization: 0 },
  );

  return NextResponse.json({
    ok: true,
    trialBalance: rows.map((row) => ({ ...row, balance: row.debit - row.credit })),
    profitAndLoss,
    balanceSheet,
    vat,
    fixedAssets,
    periods: periods ?? [],
  });
}
