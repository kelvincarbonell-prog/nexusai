import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

const Create = z.object({
  empresa_id: z.string().uuid(),
  contenido: z.string().min(1).max(4000),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  if (!empresaId) return jsonError("Falta empresa_id");
  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);

  const [{ data: mensajes }, { data: empresa }] = await Promise.all([
    admin
      .from("mensajes")
      .select("id,remitente_id,contenido,leido,fecha_lectura,created_at")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: true })
      .limit(200),
    admin
      .from("empresas")
      .select("gestor_id")
      .eq("id", empresaId)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    ok: true,
    items: mensajes ?? [],
    me: user.id,
    gestor_id: empresa?.gestor_id ?? null,
  });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");
  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);
  const { data, error } = await admin
    .from("mensajes")
    .insert({
      empresa_id: parsed.data.empresa_id,
      remitente_id: user.id,
      contenido: parsed.data.contenido,
    })
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo enviar", 500);
  return NextResponse.json({ ok: true, item: data });
}
