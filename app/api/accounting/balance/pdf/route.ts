import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { calcularPyG, calcularBalance, type Saldo } from "@/lib/accounting/pyg-balance";
import { generateBalancePDF } from "@/lib/accounting/reports-pdf";

const Query = z.object({
  empresa_id: z.string().uuid(),
  ejercicio: z.coerce.number().int().min(2020).max(2099),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const fechaCierre = `${parsed.data.ejercicio}-12-31`;
  const [{ data: empresa }, { data: entries }, { data: lines }] = await Promise.all([
    admin.from("empresas").select("nombre,nif").eq("id", parsed.data.empresa_id).maybeSingle(),
    admin.from("journal_entries").select("id,entry_date,status").eq("empresa_id", parsed.data.empresa_id).lte("entry_date", fechaCierre).neq("status", "draft"),
    admin.from("journal_lines").select("debit,credit,account_id,entry_id").eq("empresa_id", parsed.data.empresa_id),
  ]);

  const validIds = new Set((entries ?? []).map((e) => e.id));
  const accountIds = Array.from(new Set((lines ?? []).map((l) => l.account_id)));
  const { data: accounts } = await admin.from("pgc_accounts").select("id,code,name").in("id", accountIds);
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
  const balance = calcularBalance(saldos, pyg.totales.resultado_ejercicio);

  const sec = (lineas: typeof balance.activo, prefix: string) =>
    lineas.filter((l) => l.code.startsWith(prefix)).map((l) => ({ code: l.code, label: l.label, total: l.importe }));

  const bytes = await generateBalancePDF({
    empresa: { nombre: empresa?.nombre ?? "Empresa", nif: empresa?.nif ?? "" },
    ejercicio: parsed.data.ejercicio,
    fecha: fechaCierre,
    activo: {
      no_corriente: sec(balance.activo, "ANC"),
      corriente: sec(balance.activo, "AC"),
      total: balance.totales.total_activo,
    },
    pasivo: {
      patrimonio_neto: sec(balance.pasivo, "PN"),
      no_corriente: sec(balance.pasivo, "PNC"),
      corriente: sec(balance.pasivo, "PC"),
      total: balance.totales.total_pasivo,
    },
  });

  return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="balance-${parsed.data.ejercicio}-${empresa?.nif ?? ""}.pdf"`,
    },
  });
}
