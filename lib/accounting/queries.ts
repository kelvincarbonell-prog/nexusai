import { createSupabaseAdmin } from "@/lib/supabase/admin";

type AccountingCompany = {
  id: string;
  cliente_slug: string | null;
  nombre: string | null;
  account_type: string | null;
  onboarding_source: string | null;
};

export async function getAccountingOverview(userId: string) {
  const admin = createSupabaseAdmin();
  const [{ data: ownedCompanies }, { data: portalAccess }] = await Promise.all([
    admin
      .from("empresas")
      .select("id,cliente_slug,nombre,account_type,onboarding_source")
      .or(`gestor_id.eq.${userId},owner_user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("portal_accesos")
      .select("empresa:empresas(id,cliente_slug,nombre,account_type,onboarding_source)")
      .eq("user_id", userId)
      .eq("estado", "activo")
      .limit(20),
  ]);

  const portalCompanies = (portalAccess ?? [])
    .map((row) => (Array.isArray(row.empresa) ? row.empresa[0] : row.empresa))
    .filter(Boolean) as AccountingCompany[];
  const companies = ([...((ownedCompanies ?? []) as AccountingCompany[]), ...portalCompanies]).filter(
    (company, index, arr) => arr.findIndex((item) => item.id === company.id) === index,
  );

  const empresaId = companies?.[0]?.id ?? null;
  if (!empresaId) {
    return {
      companies,
      selectedCompany: null,
      accounts: [],
      entries: [],
      trialBalance: [],
      totals: { debit: 0, credit: 0, result: 0 },
    };
  }

  const [accounts, entries, trialLines] = await Promise.all([
    admin
      .from("pgc_accounts")
      .select("id,code,name,account_type,normal_balance,is_system")
      .or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
      .order("code", { ascending: true })
      .limit(80),
    admin
      .from("journal_entries")
      .select("id,entry_date,description,status,source_type,created_at")
      .eq("empresa_id", empresaId)
      .order("entry_date", { ascending: false })
      .limit(20),
    admin
      .from("journal_lines")
      .select("debit,credit,account:pgc_accounts(code,name,account_type)")
      .eq("empresa_id", empresaId),
  ]);

  const grouped = new Map<string, { code: string; name: string; debit: number; credit: number; type: string }>();
  for (const line of trialLines.data ?? []) {
    const account = Array.isArray(line.account) ? line.account[0] : line.account;
    const code = account?.code ?? "000";
    const current = grouped.get(code) ?? {
      code,
      name: account?.name ?? "Cuenta sin nombre",
      debit: 0,
      credit: 0,
      type: account?.account_type ?? "memo",
    };
    current.debit += Number(line.debit ?? 0);
    current.credit += Number(line.credit ?? 0);
    grouped.set(code, current);
  }

  const trialBalance = [...grouped.values()].sort((a, b) => a.code.localeCompare(b.code));
  const totals = trialBalance.reduce(
    (acc, row) => {
      acc.debit += row.debit;
      acc.credit += row.credit;
      if (row.type === "income") acc.result += row.credit - row.debit;
      if (row.type === "expense") acc.result -= row.debit - row.credit;
      return acc;
    },
    { debit: 0, credit: 0, result: 0 },
  );

  return {
    companies,
    selectedCompany: companies[0] ?? null,
    accounts: accounts.data ?? [],
    entries: entries.data ?? [],
    trialBalance,
    totals,
  };
}
