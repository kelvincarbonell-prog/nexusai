import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { validateNif } from "@/lib/aeat/validators";

const Schema = z.object({
  nombre: z.string().min(2).max(180),
  nif: z.string().min(8).max(20),
  account_type: z.enum(["autonomo", "empresa"]).default("empresa"),
  plan: z.string().max(40).default("negocio"),
  cliente_email: z.string().email().optional(),
  cliente_telefono: z.string().max(30).optional(),
  cliente_direccion: z.string().max(500).optional(),
  asignar_a: z.string().uuid().optional(),
});

function randomAlias() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `facturas-${out}`;
}

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const admin = createSupabaseAdmin();
  const { data: profile } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  const query = admin
    .from("empresas")
    .select("id,nombre,nif,account_type,plan,gestor_id,owner_user_id,inbox_alias,metadata,created_at")
    .order("nombre");

  const { data } = isAdmin
    ? await query.limit(500)
    : await query.or(`gestor_id.eq.${user.id},owner_user_id.eq.${user.id}`);

  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const nifCheck = validateNif(parsed.data.nif);
  if (!nifCheck.ok) return jsonError(`NIF inválido: ${nifCheck.reason}`, 400);

  const admin = createSupabaseAdmin();
  const gestorId = parsed.data.asignar_a ?? user.id;

  const { data: empresa, error } = await admin
    .from("empresas")
    .insert({
      nombre: parsed.data.nombre,
      nif: parsed.data.nif.toUpperCase().replace(/\s|-/g, ""),
      gestor_id: gestorId,
      account_type: parsed.data.account_type,
      plan: parsed.data.plan,
      inbox_alias: randomAlias(),
      metadata: {
        cliente_email: parsed.data.cliente_email,
        cliente_telefono: parsed.data.cliente_telefono,
        cliente_direccion: parsed.data.cliente_direccion,
        onboarding_source: "gestor_add",
      },
    })
    .select("*")
    .single();

  if (error || !empresa) return jsonError(error?.message ?? "No se pudo crear el cliente", 500);
  return NextResponse.json({ ok: true, empresa });
}
