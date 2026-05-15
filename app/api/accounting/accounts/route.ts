import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canAccessAccountingCompany } from "@/lib/accounting/access";
import { jsonError } from "@/lib/http";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getUserFromRequest } from "@/lib/supabase/auth";

const AccountSchema = z.object({
  empresa_id: z.string().uuid(),
  code: z.string().regex(/^\d{3,8}$/),
  name: z.string().min(2).max(160),
  group_code: z.string().regex(/^\d{1,2}$/),
  subgroup_code: z.string().regex(/^\d{1,4}$/).optional(),
  account_type: z.enum(["asset", "liability", "equity", "income", "expense", "memo"]),
  normal_balance: z.enum(["debit", "credit"]),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");

  const admin = createSupabaseAdmin();
  const canAccess = await canAccessAccountingCompany(admin, user.id, empresaId);
  if (!canAccess) return jsonError("No autorizado", 403);

  const { data, error } = await admin
    .from("pgc_accounts")
    .select("id,empresa_id,code,name,group_code,subgroup_code,account_type,normal_balance,is_system,is_active")
    .or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
    .order("code", { ascending: true });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, accounts: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = AccountSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Body inválido");

  const admin = createSupabaseAdmin();
  const canAccess = await canAccessAccountingCompany(admin, user.id, parsed.data.empresa_id);
  if (!canAccess) return jsonError("No autorizado", 403);

  const { data, error } = await admin
    .from("pgc_accounts")
    .insert({ ...parsed.data, subgroup_code: parsed.data.subgroup_code ?? parsed.data.group_code, is_system: false })
    .select("id")
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, id: data.id });
}
