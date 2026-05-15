import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { toA3con, toContasol, toSage, type AsientoLinea } from "@/lib/accounting/export";

const QuerySchema = z.object({
  empresa_id: z.string().uuid(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  formato: z.enum(["a3con", "contasol", "sage"]),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const { data: lines, error } = await admin
    .from("journal_lines")
    .select("debit,credit,description,line_number,account_id,entry_id")
    .eq("empresa_id", parsed.data.empresa_id);
  if (error) return jsonError(error.message, 500);

  const entryIds = Array.from(new Set((lines ?? []).map((l) => l.entry_id)));
  const [{ data: entries }, { data: accounts }] = await Promise.all([
    admin
      .from("journal_entries")
      .select("id,entry_number,entry_date,description,status")
      .in("id", entryIds)
      .gte("entry_date", parsed.data.desde)
      .lte("entry_date", parsed.data.hasta)
      .neq("status", "draft"),
    admin.from("pgc_accounts").select("id,code,name"),
  ]);

  const accountMap = new Map((accounts ?? []).map((a) => [a.id, a]));
  const entryMap = new Map((entries ?? []).map((e) => [e.id, e]));

  const asientos: AsientoLinea[] = [];
  for (const l of lines ?? []) {
    const entry = entryMap.get(l.entry_id);
    if (!entry) continue;
    const account = accountMap.get(l.account_id);
    asientos.push({
      entry_number: entry.entry_number ?? "",
      fecha: entry.entry_date,
      cuenta_pgc: account?.code ?? "—",
      descripcion: l.description || entry.description || (account?.name ?? ""),
      debe: Number(l.debit ?? 0),
      haber: Number(l.credit ?? 0),
      documento: "",
    });
  }

  asientos.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
    return Number(a.entry_number) - Number(b.entry_number);
  });

  const content =
    parsed.data.formato === "a3con"
      ? toA3con(asientos)
      : parsed.data.formato === "contasol"
        ? toContasol(asientos)
        : toSage(asientos);

  const filename = `diario_${parsed.data.formato}_${parsed.data.desde}_${parsed.data.hasta}.csv`;
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
