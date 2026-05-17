import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { generarFAN, validarFAN, type TrabajadorFAN } from "@/lib/laboral/siltra/fan";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  tipo: z.enum(["AFI", "CRA", "FAN_COTIZ"]).default("FAN_COTIZ"),
  formato: z.enum(["txt", "json"]).default("txt"),
});

function inferSexo(dni: string | null | undefined): "1" | "6" {
  // Heurística: se desconoce el sexo legal — devolver 1 por defecto.
  // El gestor puede sobrescribirlo cargando este campo en la ficha del trabajador.
  return "1";
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const { data: empresa } = await admin
    .from("empresas")
    .select("id,nombre,nif,ccc,iban")
    .eq("id", parsed.data.empresa_id)
    .maybeSingle();
  if (!empresa) return jsonError("Empresa no encontrada", 404);
  if (!empresa.nif) return jsonError("La empresa no tiene NIF configurado");

  const [ejercicio, mes] = parsed.data.periodo.split("-").map(Number);

  // Carga trabajadores + nóminas del periodo en un solo trayecto
  const { data: trabajadores } = await admin
    .from("trabajadores")
    .select("id,nombre,apellidos,dni,nss,fecha_nacimiento,fecha_alta,fecha_baja,grupo_cotizacion,tipo_contrato,sexo,activo")
    .eq("empresa_id", parsed.data.empresa_id)
    .eq("activo", true)
    .limit(500);

  if (!trabajadores || trabajadores.length === 0) {
    return jsonError("No hay trabajadores activos para esta empresa");
  }

  const ids = trabajadores.map((t) => t.id);
  const { data: nominas } = await admin
    .from("nominas")
    .select("trabajador_id,periodo,total,metadata")
    .eq("empresa_id", parsed.data.empresa_id)
    .eq("periodo", parsed.data.periodo)
    .in("trabajador_id", ids);

  const nominaByTrab = new Map((nominas ?? []).map((n) => [n.trabajador_id, n]));

  const trabFan: TrabajadorFAN[] = trabajadores
    .map((t) => {
      const n = nominaByTrab.get(t.id);
      const meta = (n?.metadata ?? {}) as Record<string, number | undefined>;
      const apellidos = (t.apellidos ?? (t.nombre?.split(" ").slice(1).join(" ") ?? "")).toString();
      const nombre = (t.apellidos ? t.nombre : t.nombre?.split(" ")[0] ?? "").toString();
      return {
        naf: t.nss ?? "",
        dni: t.dni ?? "",
        nombre,
        apellidos,
        fecha_nacimiento: t.fecha_nacimiento ?? "",
        sexo: (t.sexo === "6" || t.sexo === "1") ? (t.sexo as "1" | "6") : inferSexo(t.dni),
        fecha_alta: t.fecha_alta ?? undefined,
        fecha_baja: t.fecha_baja ?? undefined,
        grupo_cotizacion: t.grupo_cotizacion ?? undefined,
        tipo_contrato: t.tipo_contrato ?? undefined,
        base_cotizacion_cc: Number(meta.base_cotizacion_cc ?? 0),
        base_cotizacion_atyepy: Number(meta.base_cotizacion_atyepy ?? 0),
        base_irpf: Number(meta.base_irpf ?? 0),
        irpf_retenido: Number(meta.irpf_retenido ?? 0),
        ss_trabajador: Number(meta.ss_trabajador ?? 0),
        ss_empresa: Number(meta.ss_empresa ?? 0),
        liquido: Number(meta.liquido ?? 0),
      };
    })
    .filter((t) => t.base_cotizacion_cc > 0); // descarta trabajadores sin nómina del mes

  const input = {
    empresa: { ccc: empresa.ccc ?? "", nif: empresa.nif, razon_social: empresa.nombre ?? empresa.nif },
    periodo: { ejercicio, mes },
    tipo: parsed.data.tipo,
    trabajadores: trabFan,
  };

  const errores = validarFAN(input);
  if (parsed.data.formato === "json") {
    return NextResponse.json({
      ok: errores.length === 0,
      errores,
      empresa: input.empresa,
      periodo: parsed.data.periodo,
      n_trabajadores: trabFan.length,
      totales: {
        base_cc: trabFan.reduce((s, t) => s + t.base_cotizacion_cc, 0),
        ss_empresa: trabFan.reduce((s, t) => s + t.ss_empresa, 0),
        ss_trabajador: trabFan.reduce((s, t) => s + t.ss_trabajador, 0),
        irpf: trabFan.reduce((s, t) => s + t.irpf_retenido, 0),
      },
      trabajadores: trabFan,
    });
  }

  if (errores.length > 0) {
    return NextResponse.json({ ok: false, error: "Datos incompletos", errores }, { status: 400 });
  }

  const txt = generarFAN(input);
  const filename = `FAN_${empresa.nif}_${parsed.data.periodo.replace("-", "")}.txt`;
  return new NextResponse(txt, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
