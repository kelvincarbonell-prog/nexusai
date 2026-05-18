import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { parseCSV } from "@/lib/import/csv";

/**
 * Importación masiva de contactos (clientes / proveedores) desde CSV.
 *
 * Cabeceras (es/en):
 *   tipo (cliente | proveedor)
 *   nombre / name
 *   nif / cif / vat
 *   email
 *   telefono / phone
 *   direccion / address
 *   cp
 *   ciudad
 *   provincia
 *   pais (default ES)
 *   iban
 *   condiciones_pago_dias (default 30)
 *   irpf_pct
 *   notas
 */

const Schema = z.object({
  empresa_id: z.string().uuid(),
  csv: z.string().min(10).max(2_000_000),
  dry_run: z.boolean().default(true),
});

const FIELD_MAP: Record<string, string> = {
  name: "nombre",
  cif: "nif",
  vat: "nif",
  phone: "telefono",
  address: "direccion",
};

function normalizeRow(r: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    out[FIELD_MAP[k] ?? k] = v;
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

  const rows = parseCSV(parsed.data.csv).map(normalizeRow);
  if (rows.length === 0) return jsonError("CSV vacío");
  if (rows.length > 2000) return jsonError("Máximo 2000 filas por importación.");

  // Pre-carga NIFs existentes
  const { data: existentes } = await admin
    .from("contactos")
    .select("nif,tipo")
    .eq("empresa_id", parsed.data.empresa_id);
  const yaExisten = new Set((existentes ?? []).map((c) => `${c.tipo}|${(c.nif ?? "").toUpperCase()}`).filter((k) => !k.endsWith("|")));

  type R = { ok: boolean; fila: number; nombre?: string; nif?: string; tipo?: string; error?: string };
  const resultados: R[] = [];
  const toInsert: Array<Record<string, unknown>> = [];

  rows.forEach((row, i) => {
    const fila = i + 2;
    const nombre = (row.nombre ?? "").trim();
    const tipo = (row.tipo ?? "cliente").trim().toLowerCase();
    if (!nombre) { resultados.push({ ok: false, fila, error: "Sin nombre" }); return; }
    if (!["cliente", "proveedor", "ambos"].includes(tipo)) {
      resultados.push({ ok: false, fila, nombre, error: `tipo desconocido '${tipo}' (usa cliente|proveedor|ambos)` });
      return;
    }

    const nif = (row.nif ?? "").trim().toUpperCase();
    const key = `${tipo}|${nif}`;
    if (nif && yaExisten.has(key)) {
      resultados.push({ ok: false, fila, nombre, nif, tipo, error: "NIF + tipo ya existen — se omite" });
      return;
    }

    const num = (v: string) => {
      const n = Number((v ?? "").replace(",", ".").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : undefined;
    };

    toInsert.push({
      empresa_id: parsed.data.empresa_id,
      gestor_id: user.id,
      tipo,
      nombre,
      nif: nif || null,
      email: row.email || null,
      telefono: row.telefono || null,
      direccion: row.direccion || null,
      cp: row.cp || null,
      ciudad: row.ciudad || null,
      provincia: row.provincia || null,
      pais: row.pais || "ES",
      iban: row.iban || null,
      condiciones_pago_dias: num(row.condiciones_pago_dias) ?? 30,
      irpf_pct: num(row.irpf_pct) ?? null,
      notas: row.notas || null,
      activo: true,
    });
    resultados.push({ ok: true, fila, nombre, nif, tipo });
  });

  if (parsed.data.dry_run) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      total: rows.length,
      a_insertar: toInsert.length,
      duplicados: resultados.filter((r) => r.error?.includes("ya existen")).length,
      errores: resultados.filter((r) => !r.ok && !r.error?.includes("ya existen")).length,
      resultados: resultados.slice(0, 200),
    });
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ ok: true, dry_run: false, insertados: 0, resultados });
  }
  const { error } = await admin.from("contactos").insert(toInsert);
  if (error) return jsonError(`Error al insertar: ${error.message}`, 500);

  return NextResponse.json({
    ok: true,
    dry_run: false,
    insertados: toInsert.length,
    duplicados: resultados.filter((r) => r.error?.includes("ya existen")).length,
    errores: resultados.filter((r) => !r.ok && !r.error?.includes("ya existen")).length,
    resultados,
  });
}
