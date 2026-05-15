import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessAccountingCompany } from "@/lib/accounting/access";

const JournalLineSchema = z.object({
  account_id: z.string().uuid(),
  description: z.string().max(500).optional(),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
});

const JournalEntrySchema = z.object({
  empresa_id: z.string().uuid(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(2).max(500),
  status: z.enum(["draft", "posted"]).default("draft"),
  lines: z.array(JournalLineSchema).min(2),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = JournalEntrySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Body inválido");

  const debit = parsed.data.lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = parsed.data.lines.reduce((sum, line) => sum + line.credit, 0);
  if (debit <= 0 || debit.toFixed(2) !== credit.toFixed(2)) {
    return jsonError("El asiento no está cuadrado");
  }

  const admin = createSupabaseAdmin();
  const canAccess = await canAccessAccountingCompany(admin, user.id, parsed.data.empresa_id);
  if (!canAccess) return jsonError("No autorizado", 403);

  const accountIds = [...new Set(parsed.data.lines.map((line) => line.account_id))];
  const { data: accounts, error: accountsError } = await admin
    .from("pgc_accounts")
    .select("id,empresa_id")
    .in("id", accountIds);
  if (accountsError) return jsonError(accountsError.message, 500);
  const validAccountIds = new Set(
    (accounts ?? [])
      .filter((account) => !account.empresa_id || account.empresa_id === parsed.data.empresa_id)
      .map((account) => account.id),
  );
  if (accountIds.some((id) => !validAccountIds.has(id))) {
    return jsonError("Hay cuentas que no pertenecen a la empresa", 403);
  }

  const [{ data: period }, { data: lastEntry }] = await Promise.all([
    admin
      .from("accounting_periods")
      .select("id,status")
      .eq("empresa_id", parsed.data.empresa_id)
      .lte("starts_on", parsed.data.entry_date)
      .gte("ends_on", parsed.data.entry_date)
      .maybeSingle(),
    admin
      .from("journal_entries")
      .select("entry_number")
      .eq("empresa_id", parsed.data.empresa_id)
      .order("entry_number", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (period?.status === "locked" || period?.status === "closed") {
    return jsonError("El periodo contable está bloqueado o cerrado", 409);
  }

  const { data: entry, error: entryError } = await admin
    .from("journal_entries")
    .insert({
      empresa_id: parsed.data.empresa_id,
      period_id: period?.id ?? null,
      entry_number: Number(lastEntry?.entry_number ?? 0) + 1,
      entry_date: parsed.data.entry_date,
      description: parsed.data.description,
      status: parsed.data.status,
      created_by: user.id,
      posted_by: parsed.data.status === "posted" ? user.id : null,
      posted_at: parsed.data.status === "posted" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (entryError || !entry) return jsonError(entryError?.message ?? "No se pudo crear el asiento", 500);

  const { error: linesError } = await admin.from("journal_lines").insert(
    parsed.data.lines.map((line, index) => ({
      entry_id: entry.id,
      empresa_id: parsed.data.empresa_id,
      account_id: line.account_id,
      line_number: index + 1,
      description: line.description ?? "",
      debit: line.debit,
      credit: line.credit,
    })),
  );

  if (linesError) return jsonError(linesError.message, 500);

  return NextResponse.json({ ok: true, id: entry.id });
}
