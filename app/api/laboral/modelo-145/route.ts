import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { generateModelo145PDF } from "@/lib/laboral/pdf/modelo-145";

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const trabajadorId = request.nextUrl.searchParams.get("trabajador_id");
  if (!trabajadorId) return jsonError("Falta trabajador_id");

  const admin = createSupabaseAdmin();
  const { data: trabajador } = await admin
    .from("trabajadores")
    .select("*")
    .eq("id", trabajadorId)
    .single();
  if (!trabajador) return jsonError("Trabajador no encontrado", 404);
  if (!(await canAccessLaborCompany(admin, user.id, trabajador.empresa_id))) return jsonError("Sin acceso", 403);

  const { data: empresa } = await admin.from("empresas").select("nombre,nif,metadata").eq("id", trabajador.empresa_id).single();
  if (!empresa) return jsonError("Empresa no encontrada", 404);

  const meta = (trabajador.metadata ?? {}) as Record<string, unknown>;
  const empresaMeta = (empresa.metadata ?? {}) as Record<string, unknown>;
  const partes = (trabajador.nombre ?? "").split(/\s+/);
  const nombre = partes[0] ?? "";
  const apellidos = partes.slice(1).join(" ");

  const bytes = await generateModelo145PDF({
    empresa: {
      nombre: empresa.nombre,
      nif: empresa.nif ?? "—",
    },
    trabajador: {
      nombre,
      apellidos,
      dni: trabajador.dni ?? "—",
      fecha_nacimiento: trabajador.fecha_nacimiento ?? undefined,
      nss: trabajador.nss ?? undefined,
      direccion: (meta.direccion as string | undefined) ?? (empresaMeta.cliente_direccion as string | undefined),
      estado_civil: meta.estado_civil as "soltero" | "casado" | "viudo" | "separado" | "divorciado" | undefined,
      discapacidad_pct: meta.discapacidad_pct as number | undefined,
    },
    hijos: (meta.hijos as Array<{ nombre: string; fecha_nacimiento: string; discapacidad_pct?: number; vinculacion?: "comun" | "exclusiva" }>) ?? [],
    movilidad_geografica: meta.movilidad_geografica === true,
    hipoteca_vivienda: meta.hipoteca_vivienda === true,
  });

  return new NextResponse(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="modelo-145-${trabajador.dni ?? trabajador.id.slice(0, 8)}.pdf"`,
    },
  });
}
