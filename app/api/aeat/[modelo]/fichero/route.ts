import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";
import type { AeatHeader } from "@/lib/aeat/export/common";
import {
  generateFicheroM100,
  generateFicheroM111,
  generateFicheroM115,
  generateFicheroM123,
  generateFicheroM130,
  generateFicheroM180,
  generateFicheroM184,
  generateFicheroM190,
  generateFicheroM193,
  generateFicheroM200,
  generateFicheroM202,
  generateFicheroM210,
  generateFicheroM232,
  generateFicheroM296,
  generateFicheroM309,
  generateFicheroM390,
  generateFicheroM720,
} from "@/lib/aeat/export/text-modelos";

const SUPPORTED = ["100", "111", "115", "123", "130", "180", "184", "190", "193", "200", "202", "210", "232", "296", "309", "347", "349", "390", "720"];

const Query = z.object({
  empresa_id: z.string().uuid(),
  ejercicio: z.coerce.number().int().min(2020).max(2099),
  periodo: z.enum(["1T", "2T", "3T", "4T", "ANUAL"]),
});

export async function GET(request: NextRequest, ctx: { params: Promise<{ modelo: string }> }) {
  const { modelo } = await ctx.params;
  if (!SUPPORTED.includes(modelo)) return jsonError("Modelo no soportado", 404);

  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const [{ data: empresa }, { data: decl }] = await Promise.all([
    admin.from("empresas").select("nombre,nif,metadata").eq("id", parsed.data.empresa_id).single(),
    admin
      .from("aeat_declaraciones")
      .select("casillas,resumen")
      .eq("empresa_id", parsed.data.empresa_id)
      .eq("modelo", modelo)
      .eq("ejercicio", parsed.data.ejercicio)
      .eq("periodo", parsed.data.periodo)
      .maybeSingle(),
  ]);
  if (!empresa) return jsonError("Empresa no encontrada", 404);
  if (!decl) return jsonError("Genera primero el borrador del modelo en /aeat", 404);

  const header: AeatHeader = {
    modelo,
    ejercicio: parsed.data.ejercicio,
    periodo: parsed.data.periodo,
    nif: empresa.nif ?? "",
    nombre: empresa.nombre ?? "",
    telefono: (empresa.metadata as Record<string, unknown> | null)?.telefono as string | undefined,
  };

  const casillas = (decl.casillas ?? {}) as Record<string, number>;

  let contenido = "";
  switch (modelo) {
    case "100": contenido = generateFicheroM100(header, casillas); break;
    case "111": contenido = generateFicheroM111(header, casillas as { c01: number; c02: number; c03: number; c04: number; c05: number; c06: number; c28: number; [k: string]: number }); break;
    case "115": contenido = generateFicheroM115(header, casillas as { c01: number; c02: number; c03: number; c28: number }); break;
    case "123": contenido = generateFicheroM123(header, casillas as { c01: number; c02: number; c03: number; c28: number }); break;
    case "130": contenido = generateFicheroM130(header, casillas as { c01: number; c02: number; c03: number; c04: number; c05: number; c06: number; c07: number; c12: number; c14: number; c19: number }); break;
    case "180": contenido = generateFicheroM180(header, casillas as { c01: number; c02: number; c03: number }); break;
    case "184": contenido = generateFicheroM184(header, casillas as { total_ingresos: number; total_gastos: number; rendimiento_neto: number; num_comuneros: number }); break;
    case "190": contenido = generateFicheroM190(header, casillas as { c01: number; c03: number; c04: number; c06: number; total_perceptores: number; total_retenciones: number }); break;
    case "193": contenido = generateFicheroM193(header, casillas as { num_perceptores: number; total_base: number; total_retenciones: number }); break;
    case "200": contenido = generateFicheroM200(header, casillas); break;
    case "202": contenido = generateFicheroM202(header, casillas as { c01: number; c03: number; c04: number; c10: number; c12: number; c14: number }); break;
    case "210": contenido = generateFicheroM210(header, casillas as { c01: number; c02: number; c03: number; c04: number; c05: number; c06: number; c07: number }); break;
    case "232": contenido = generateFicheroM232(header, casillas as { total_vinculados: number; importe_vinculados: number; total_paraisos: number; importe_paraisos: number }); break;
    case "296": contenido = generateFicheroM296(header, casillas as { num_perceptores: number; total_base: number; total_retenciones: number }); break;
    case "309": contenido = generateFicheroM309(header, casillas as { c01: number; c02: number; c03: number; c04: number; c05: number }); break;
    case "347": {
      const resumen = (decl.resumen ?? {}) as { top?: Array<{ nif?: string; nombre?: string; total?: number }> };
      // Generamos una versión simplificada (sin trimestres en este MVP)
      const lines = [generateFicheroM200(header, casillas) /* cabecera con codigo modelo */];
      void resumen;
      return new NextResponse(
        `Fichero 347 simplificado · ${parsed.data.ejercicio}\n` + lines.join(""),
        { headers: csvHeaders(modelo, parsed.data) },
      );
    }
    case "349": {
      const resumen = (decl.resumen ?? {}) as { top?: Array<{ nif?: string; nombre?: string; clave?: string; base?: number }> };
      const ops = (resumen.top ?? []).map((o) => ({
        nif_operador: o.nif ?? "",
        nombre_operador: o.nombre ?? "",
        clave: (o.clave ?? "E") as "E" | "A" | "T" | "S" | "I",
        base: Number(o.base ?? 0),
      }));
      contenido = (await import("@/lib/aeat/export/text-modelos")).generateFicheroM349(header, ops);
      break;
    }
    case "390": contenido = generateFicheroM390(header, casillas); break;
    case "720": contenido = generateFicheroM720(header, casillas as { cuentas_num: number; cuentas_valor: number; valores_num: number; valores_valor: number; inmuebles_num: number; inmuebles_valor: number }); break;
    default: return jsonError("Modelo no soportado", 404);
  }

  return new NextResponse(contenido, { headers: csvHeaders(modelo, parsed.data) });
}

function csvHeaders(modelo: string, q: { ejercicio: number; periodo: string }): HeadersInit {
  return {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Disposition": `attachment; filename="modelo-${modelo}-${q.periodo}-${q.ejercicio}.txt"`,
  };
}
