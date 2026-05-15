import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import { generateFicheroM303, suggestFilenameM303 } from "@/lib/aeat/export/text-303";
import type { Casillas303 } from "@/lib/aeat/calc/m303";

const QuerySchema = z.object({
  empresa_id: z.string().uuid(),
  ejercicio: z.coerce.number().int().min(2020).max(2099),
  periodo: z.enum(["1T", "2T", "3T", "4T"]),
});

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = QuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const [{ data: declaracion }, { data: empresa }] = await Promise.all([
    admin
      .from("aeat_declaraciones")
      .select("casillas")
      .eq("empresa_id", parsed.data.empresa_id)
      .eq("modelo", "303")
      .eq("ejercicio", parsed.data.ejercicio)
      .eq("periodo", parsed.data.periodo)
      .maybeSingle(),
    admin.from("empresas").select("nif,nombre,metadata").eq("id", parsed.data.empresa_id).single(),
  ]);

  if (!declaracion) return jsonError("Aún no has guardado el borrador. Pulsa 'Guardar borrador' primero.", 404);
  if (!empresa?.nif) return jsonError("La empresa no tiene NIF configurado.", 400);

  const fichero = generateFicheroM303(
    {
      nif: empresa.nif,
      razon_social: empresa.nombre ?? "",
      ejercicio: parsed.data.ejercicio,
      periodo: parsed.data.periodo,
      telefono: (empresa.metadata as { telefono?: string } | null)?.telefono,
    },
    declaracion.casillas as Casillas303,
  );

  const filename = suggestFilenameM303({
    nif: empresa.nif,
    razon_social: empresa.nombre ?? "",
    ejercicio: parsed.data.ejercicio,
    periodo: parsed.data.periodo,
  });

  return new NextResponse(fichero, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
