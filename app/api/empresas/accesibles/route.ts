import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const admin = createSupabaseAdmin();
  const { data: profile } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  if (isAdmin) {
    const { data } = await admin
      .from("empresas")
      .select("id,nombre,nif,inbox_alias,account_type,plan")
      .order("nombre")
      .limit(500);
    return NextResponse.json({ ok: true, items: data ?? [], scope: "admin" });
  }

  const [{ data: managed }, { data: owned }, { data: portal }] = await Promise.all([
    admin
      .from("empresas")
      .select("id,nombre,nif,inbox_alias,account_type,plan")
      .eq("gestor_id", user.id),
    admin
      .from("empresas")
      .select("id,nombre,nif,inbox_alias,account_type,plan")
      .eq("owner_user_id", user.id),
    admin
      .from("portal_accesos")
      .select("empresa_id,empresas(id,nombre,nif,inbox_alias,account_type,plan)")
      .eq("user_id", user.id)
      .eq("estado", "activo"),
  ]);

  const map = new Map<string, Record<string, unknown>>();
  for (const list of [managed ?? [], owned ?? []]) {
    for (const row of list) map.set(row.id, row);
  }
  for (const entry of portal ?? []) {
    const emp = (entry as { empresas?: Record<string, unknown> | Record<string, unknown>[] }).empresas;
    const company = Array.isArray(emp) ? emp[0] : emp;
    if (company && typeof company === "object" && "id" in company && typeof company.id === "string") {
      map.set(company.id, company);
    }
  }
  return NextResponse.json({ ok: true, items: [...map.values()], scope: "user" });
}
