import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canAccessAccountingCompany } from "@/lib/accounting/access";
import { jsonError } from "@/lib/http";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { getUserFromRequest } from "@/lib/supabase/auth";

const PeriodSchema = z.object({
  empresa_id: z.string().uuid(),
  fiscal_year: z.number().int().min(2000).max(2100),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["open", "locked", "closed"]).default("open"),
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
    .from("accounting_periods")
    .select("id,fiscal_year,starts_on,ends_on,status,closed_at,closed_by")
    .eq("empresa_id", empresaId)
    .order("fiscal_year", { ascending: false });

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, periods: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = PeriodSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Body inválido");

  const admin = createSupabaseAdmin();
  const canAccess = await canAccessAccountingCompany(admin, user.id, parsed.data.empresa_id);
  if (!canAccess) return jsonError("No autorizado", 403);

  const { data, error } = await admin
    .from("accounting_periods")
    .upsert(
      {
        ...parsed.data,
        closed_by: parsed.data.status === "closed" ? user.id : null,
        closed_at: parsed.data.status === "closed" ? new Date().toISOString() : null,
      },
      { onConflict: "empresa_id,fiscal_year" },
    )
    .select("id")
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, id: data.id });
}
