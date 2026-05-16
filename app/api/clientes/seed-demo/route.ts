import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

function randomAlias() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `facturas-${out}`;
}

const DEMO = [
  {
    nombre: "Innova Apps S.L.",
    nif: "B12398765",
    account_type: "empresa",
    plan: "negocio",
    metadata: {
      demo: true,
      cliente_email: "contacto@innova-demo.app",
      cliente_telefono: "+34 911 234 567",
      cliente_direccion: "Av. Diagonal 478, 08006 Barcelona",
      cnae: "6201",
    },
  },
  {
    nombre: "Sastrería Pons",
    nif: "B23445789",
    account_type: "empresa",
    plan: "negocio",
    metadata: {
      demo: true,
      cliente_email: "info@sastreriapons-demo.es",
      cliente_telefono: "+34 933 222 111",
      cliente_direccion: "Carrer del Born 7, 08003 Barcelona",
      cnae: "4771",
    },
  },
  {
    nombre: "Juan Romero · Autónomo",
    nif: "47891234X",
    account_type: "autonomo",
    plan: "autonomo",
    metadata: {
      demo: true,
      cliente_email: "juan.romero@demo.es",
      cliente_telefono: "+34 600 123 456",
      cliente_direccion: "Calle Mayor 12, 28013 Madrid",
      cnae: "7022",
    },
  },
];

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const admin = createSupabaseAdmin();
  const creadas: { id: string; nombre: string }[] = [];

  for (const d of DEMO) {
    const { data } = await admin
      .from("empresas")
      .insert({
        nombre: d.nombre,
        nif: d.nif,
        account_type: d.account_type,
        plan: d.plan,
        gestor_id: user.id,
        owner_user_id: user.id,
        inbox_alias: randomAlias(),
        metadata: d.metadata,
      })
      .select("id,nombre")
      .single();
    if (data) creadas.push(data);
  }

  return NextResponse.json({ ok: true, creadas });
}

export async function DELETE(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const admin = createSupabaseAdmin();
  // Borra solo las empresas marcadas demo y de este usuario
  const { data: demoEmpresas } = await admin
    .from("empresas")
    .select("id,metadata")
    .eq("gestor_id", user.id);
  const ids = (demoEmpresas ?? [])
    .filter((e) => (e.metadata as Record<string, unknown> | null)?.demo === true)
    .map((e) => e.id);
  if (ids.length === 0) return NextResponse.json({ ok: true, eliminadas: 0 });
  await admin.from("empresas").delete().in("id", ids);
  return NextResponse.json({ ok: true, eliminadas: ids.length });
}
