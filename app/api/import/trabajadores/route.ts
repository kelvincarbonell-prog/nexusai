import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { parseCSV } from "@/lib/import/csv";

/**
 * Importación masiva de trabajadores desde CSV.
 *
 * Cabeceras admitidas (caso insensible, español o inglés):
 *   nombre / name
 *   apellidos / surnames
 *   dni / nif
 *   nss / naf
 *   email
 *   telefono
 *   puesto / position
 *   tipo_contrato (indefinido / temporal / formativo …)
 *   jornada_horas / hours
 *   salario_bruto_anual / salary
 *   irpf_pct
 *   hijos
 *   fecha_alta (YYYY-MM-DD)
 *   fecha_nacimiento
 *   convenio_codigo
 *   categoria_convenio
 *
 * Modo:
 *   - dry_run=true: valida y devuelve preview sin guardar nada.
 *   - dry_run=false: inserta los válidos. Por defecto SALTA duplicados por DNI.
 */

const Schema = z.object({
  empresa_id: z.string().uuid(),
  csv: z.string().min(10).max(2_000_000),
  dry_run: z.boolean().default(true),
});

type Resultado = {
  ok: boolean;
  fila: number;
  trabajador?: { nombre: string; dni?: string };
  error?: string;
};

const FIELD_MAP: Record<string, string> = {
  name: "nombre",
  surnames: "apellidos",
  nif: "dni",
  naf: "nss",
  position: "puesto",
  hours: "jornada_horas",
  salary: "salario_bruto_anual",
};

function normalizeRow(r: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    const key = FIELD_MAP[k] ?? k;
    out[key] = v;
  }
  return out;
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  let rows: Record<string, string>[];
  try {
    rows = parseCSV(parsed.data.csv).map(normalizeRow);
  } catch (e: unknown) {
    return jsonError(`CSV inválido: ${e instanceof Error ? e.message : "error parseando"}`);
  }
  if (rows.length === 0) return jsonError("CSV vacío");
  if (rows.length > 1000) return jsonError("Máximo 1000 filas por importación.");

  // Pre-carga DNIs existentes para deduplicar
  const { data: existentes } = await admin
    .from("trabajadores")
    .select("dni")
    .eq("empresa_id", parsed.data.empresa_id);
  const dniExistentes = new Set((existentes ?? []).map((t) => (t.dni ?? "").toUpperCase()).filter(Boolean));

  const resultados: Resultado[] = [];
  const toInsert: Array<Record<string, unknown>> = [];

  rows.forEach((row, i) => {
    const fila = i + 2; // +1 por header, +1 para 1-indexed
    const nombre = (row.nombre ?? "").trim();
    if (!nombre) { resultados.push({ ok: false, fila, error: "Sin nombre" }); return; }

    const dni = (row.dni ?? "").trim().toUpperCase();
    if (dni && dniExistentes.has(dni)) {
      resultados.push({ ok: false, fila, trabajador: { nombre, dni }, error: "DNI ya existe — se omite" });
      return;
    }

    const fechaAlta = (row.fecha_alta ?? "").trim();
    if (fechaAlta && !/^\d{4}-\d{2}-\d{2}$/.test(fechaAlta)) {
      resultados.push({ ok: false, fila, trabajador: { nombre }, error: "fecha_alta no es YYYY-MM-DD" });
      return;
    }

    const num = (v: string) => {
      const n = Number((v ?? "").replace(",", ".").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : undefined;
    };

    toInsert.push({
      empresa_id: parsed.data.empresa_id,
      gestor_id: user.id,
      nombre,
      apellidos: row.apellidos || null,
      dni: dni || null,
      nss: row.nss || null,
      email: row.email || null,
      telefono: row.telefono || null,
      puesto: row.puesto || null,
      tipo_contrato: row.tipo_contrato || "indefinido",
      jornada_horas: num(row.jornada_horas) ?? null,
      salario_bruto_anual: num(row.salario_bruto_anual) ?? null,
      irpf_pct: num(row.irpf_pct) ?? null,
      hijos: row.hijos ? Math.max(0, Math.min(20, Math.round(Number(row.hijos)))) : 0,
      fecha_alta: fechaAlta || null,
      fecha_nacimiento: (row.fecha_nacimiento || null) as string | null,
      convenio_codigo: row.convenio_codigo || null,
      categoria_convenio: row.categoria_convenio || null,
      activo: true,
    });
    resultados.push({ ok: true, fila, trabajador: { nombre, dni } });
  });

  if (parsed.data.dry_run) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      total: rows.length,
      a_insertar: toInsert.length,
      duplicados: resultados.filter((r) => r.error?.startsWith("DNI")).length,
      errores: resultados.filter((r) => !r.ok && !r.error?.startsWith("DNI")).length,
      resultados: resultados.slice(0, 200),
    });
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ ok: true, dry_run: false, insertados: 0, resultados });
  }
  const { error } = await admin.from("trabajadores").insert(toInsert);
  if (error) return jsonError(`Error al insertar: ${error.message}`, 500);

  return NextResponse.json({
    ok: true,
    dry_run: false,
    insertados: toInsert.length,
    duplicados: resultados.filter((r) => r.error?.startsWith("DNI")).length,
    errores: resultados.filter((r) => !r.ok && !r.error?.startsWith("DNI")).length,
    resultados,
  });
}
