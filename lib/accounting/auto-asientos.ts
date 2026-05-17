/**
 * Generación automática de asientos contables desde:
 *  - factura emitida → 430 cliente / 700 ventas / 477 IVA repercutido [/ 4751 IRPF retenido]
 *  - factura recibida o gasto → 6XX gasto / 472 IVA soportado / 410 proveedor [/ 4751 IRPF retenido]
 *  - factura pagada → 572 banco / 430 cliente
 *  - gasto pagado → 410 proveedor / 572 banco
 *
 * Idempotente: usa source_type + source_id para no duplicar asientos del mismo origen.
 */

import { createSupabaseAdmin } from "@/lib/supabase/admin";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Devuelve el id de una cuenta PGC por código. Si no existe en la empresa,
 * busca en el plan global (empresa_id is null). Si no existe, la crea
 * automáticamente con el catálogo mínimo.
 */
async function ensureAccount(
  admin: SupabaseAdmin,
  empresaId: string,
  code: string,
): Promise<string | null> {
  const { data: existing } = await admin
    .from("pgc_accounts")
    .select("id")
    .or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
    .eq("code", code)
    .order("empresa_id", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  // Crear con el catálogo conocido
  const seed = SEED_ACCOUNTS[code];
  if (!seed) return null;
  const { data: created, error } = await admin
    .from("pgc_accounts")
    .insert({
      empresa_id: empresaId,
      code,
      name: seed.name,
      group_code: seed.group,
      account_type: seed.type,
      normal_balance: seed.balance,
      is_system: true,
    })
    .select("id")
    .single();
  if (error) return null;
  return created?.id ?? null;
}

const SEED_ACCOUNTS: Record<string, { name: string; group: string; type: "asset" | "liability" | "equity" | "income" | "expense"; balance: "debit" | "credit" }> = {
  "400": { name: "Proveedores", group: "4", type: "liability", balance: "credit" },
  "410": { name: "Acreedores por prestación de servicios", group: "4", type: "liability", balance: "credit" },
  "430": { name: "Clientes", group: "4", type: "asset", balance: "debit" },
  "472": { name: "Hacienda Pública IVA soportado", group: "4", type: "asset", balance: "debit" },
  "473": { name: "Hacienda Pública retenciones y pagos a cuenta", group: "4", type: "asset", balance: "debit" },
  "475": { name: "Hacienda Pública acreedora por conceptos fiscales", group: "4", type: "liability", balance: "credit" },
  "4751": { name: "Hacienda Pública acreedora por retenciones practicadas", group: "4", type: "liability", balance: "credit" },
  "477": { name: "Hacienda Pública IVA repercutido", group: "4", type: "liability", balance: "credit" },
  "572": { name: "Bancos e instituciones de crédito c/c", group: "5", type: "asset", balance: "debit" },
  "600": { name: "Compras de mercaderías", group: "6", type: "expense", balance: "debit" },
  "621": { name: "Arrendamientos y cánones", group: "6", type: "expense", balance: "debit" },
  "622": { name: "Reparaciones y conservación", group: "6", type: "expense", balance: "debit" },
  "623": { name: "Servicios de profesionales independientes", group: "6", type: "expense", balance: "debit" },
  "624": { name: "Transportes", group: "6", type: "expense", balance: "debit" },
  "625": { name: "Primas de seguros", group: "6", type: "expense", balance: "debit" },
  "626": { name: "Servicios bancarios y similares", group: "6", type: "expense", balance: "debit" },
  "627": { name: "Publicidad, propaganda y relaciones públicas", group: "6", type: "expense", balance: "debit" },
  "628": { name: "Suministros", group: "6", type: "expense", balance: "debit" },
  "629": { name: "Otros servicios", group: "6", type: "expense", balance: "debit" },
  "640": { name: "Sueldos y salarios", group: "6", type: "expense", balance: "debit" },
  "642": { name: "Seguridad Social a cargo de la empresa", group: "6", type: "expense", balance: "debit" },
  "700": { name: "Ventas de mercaderías", group: "7", type: "income", balance: "credit" },
  "705": { name: "Prestaciones de servicios", group: "7", type: "income", balance: "credit" },
  "769": { name: "Otros ingresos financieros", group: "7", type: "income", balance: "credit" },
};

async function nextEntryNumber(admin: SupabaseAdmin, empresaId: string): Promise<number> {
  const { data } = await admin
    .from("journal_entries")
    .select("entry_number")
    .eq("empresa_id", empresaId)
    .order("entry_number", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return Number(data?.entry_number ?? 0) + 1;
}

async function existsBySource(
  admin: SupabaseAdmin,
  empresaId: string,
  sourceType: string,
  sourceId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("journal_entries")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

type Linea = { accountCode: string; description: string; debit: number; credit: number };

async function postEntry(
  admin: SupabaseAdmin,
  opts: {
    empresaId: string;
    userId: string;
    date: string;
    description: string;
    sourceType: string;
    sourceId: string;
    lineas: Linea[];
  },
): Promise<{ id: string } | null> {
  // Verifica idempotencia
  if (await existsBySource(admin, opts.empresaId, opts.sourceType, opts.sourceId)) return null;

  // Resuelve cuentas
  const resolved: { accountId: string; description: string; debit: number; credit: number }[] = [];
  for (const l of opts.lineas) {
    if (l.debit === 0 && l.credit === 0) continue;
    const accountId = await ensureAccount(admin, opts.empresaId, l.accountCode);
    if (!accountId) return null;
    resolved.push({ accountId, description: l.description, debit: round2(l.debit), credit: round2(l.credit) });
  }
  if (resolved.length === 0) return null;

  const totalDebit = resolved.reduce((s, l) => s + l.debit, 0);
  const totalCredit = resolved.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.05) {
    // No cuadra — abortar para no contaminar el diario.
    return null;
  }

  const entryNumber = await nextEntryNumber(admin, opts.empresaId);
  const { data: entry, error } = await admin
    .from("journal_entries")
    .insert({
      empresa_id: opts.empresaId,
      entry_number: entryNumber,
      entry_date: opts.date,
      description: opts.description,
      source_type: opts.sourceType,
      source_id: opts.sourceId,
      status: "posted",
      created_by: opts.userId,
      posted_by: opts.userId,
      posted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !entry) return null;

  const lines = resolved.map((l, idx) => ({
    entry_id: entry.id,
    empresa_id: opts.empresaId,
    account_id: l.accountId,
    line_number: idx + 1,
    description: l.description,
    debit: l.debit,
    credit: l.credit,
  }));
  const { error: linesErr } = await admin.from("journal_lines").insert(lines);
  if (linesErr) {
    // Si fallan las líneas, deshacemos el asiento
    await admin.from("journal_entries").delete().eq("id", entry.id);
    return null;
  }
  return { id: entry.id };
}

export type AutoAsientoOpts = {
  /** Cuenta PGC sugerida para el gasto (si es una factura recibida o gasto). */
  cuenta_pgc?: string;
};

/**
 * Genera el asiento de una factura emitida.
 *   430 Clientes        ──── debe total + IVA − IRPF retenido cliente
 *   4751 HP IRPF retenida ─── debe (si hay retención)
 *   700/705 Ventas       ──── haber base
 *   477 IVA repercutido  ──── haber iva
 */
export async function asentarFacturaEmitida(
  admin: SupabaseAdmin,
  factura: {
    id: string;
    empresa_id: string;
    fecha_emision: string | null;
    contacto_nombre: string | null;
    numero: string | null;
    base: number;
    iva: number;
    total: number;
    metadata: Record<string, unknown>;
  },
  userId: string,
): Promise<{ id: string } | null> {
  const base = Number(factura.base ?? 0);
  const iva = Number(factura.iva ?? 0);
  const total = Number(factura.total ?? 0);
  const irpf = Number((factura.metadata?.retencion as number | undefined) ?? 0);
  if (base <= 0) return null;

  // Cuenta de ingresos: 700 si se vende producto, 705 si servicio (heurística por metadata)
  const cuentaIngreso = (factura.metadata?.es_servicio === false) ? "700" : "705";

  const lineas: Linea[] = [
    { accountCode: "430", description: `Cliente ${factura.contacto_nombre ?? ""}`.trim(), debit: total, credit: 0 },
    { accountCode: cuentaIngreso, description: factura.numero ?? "Venta", debit: 0, credit: base },
  ];
  if (iva > 0) lineas.push({ accountCode: "477", description: `IVA repercutido ${factura.numero ?? ""}`, debit: 0, credit: iva });
  if (irpf > 0) lineas.push({ accountCode: "473", description: `IRPF retenido cliente ${factura.contacto_nombre ?? ""}`, debit: irpf, credit: 0 });

  // Si hay IRPF, el cliente nos paga menos: ajustamos 430 (total ya incluye -retencion en base+iva-retencion).
  // Si la factura ya tiene total = base + iva - retencion, los importes ya cuadran.
  // Si total = base + iva (sin descontar retención), añadimos la retención como crédito en 4751 contra el 430.
  if (irpf > 0 && Math.abs(total - (base + iva - irpf)) < 0.05) {
    // Total ya descuenta retención. Ajustamos 430 a total + irpf y añadimos 473 = irpf.
    lineas[0] = { ...lineas[0], debit: total + irpf };
  }

  return postEntry(admin, {
    empresaId: factura.empresa_id,
    userId,
    date: factura.fecha_emision ?? new Date().toISOString().slice(0, 10),
    description: `Factura emitida ${factura.numero ?? factura.id.slice(0, 8)} · ${factura.contacto_nombre ?? ""}`.trim(),
    sourceType: "factura_emitida",
    sourceId: factura.id,
    lineas,
  });
}

/**
 * Genera el asiento de una factura recibida.
 *   6XX Gasto         ──── debe base
 *   472 IVA soportado  ──── debe iva
 *   410/400 Proveedor   ──── haber total + irpf
 *   4751 HP IRPF a ingresar ── haber irpf (si hay retención al profesional)
 */
export async function asentarFacturaRecibida(
  admin: SupabaseAdmin,
  factura: {
    id: string;
    empresa_id: string;
    fecha_emision: string | null;
    contacto_nombre: string | null;
    numero: string | null;
    base: number;
    iva: number;
    total: number;
    metadata: Record<string, unknown>;
  },
  userId: string,
  opts: AutoAsientoOpts = {},
): Promise<{ id: string } | null> {
  const base = Number(factura.base ?? 0);
  const iva = Number(factura.iva ?? 0);
  const total = Number(factura.total ?? 0);
  const irpf = Number((factura.metadata?.retencion_irpf as number | undefined) ?? 0);
  if (base <= 0 && total <= 0) return null;

  const cuentaGasto = opts.cuenta_pgc ?? (factura.metadata?.cuenta_pgc as string | undefined) ?? "629";

  const lineas: Linea[] = [
    { accountCode: cuentaGasto, description: factura.contacto_nombre ?? "Gasto", debit: base, credit: 0 },
  ];
  if (iva > 0) lineas.push({ accountCode: "472", description: `IVA soportado ${factura.numero ?? ""}`, debit: iva, credit: 0 });

  // Proveedor (410) vs Acreedor por servicios (400)
  const cuentaTercero = cuentaGasto.startsWith("60") ? "400" : "410";
  // Si total ya descuenta retención, el proveedor nos cobra total. Si no, total = base + iva.
  const importeProveedor = total > 0 ? total : base + iva - irpf;
  lineas.push({ accountCode: cuentaTercero, description: `Proveedor ${factura.contacto_nombre ?? ""}`, debit: 0, credit: importeProveedor });
  if (irpf > 0) lineas.push({ accountCode: "4751", description: `IRPF retenido a profesional`, debit: 0, credit: irpf });

  return postEntry(admin, {
    empresaId: factura.empresa_id,
    userId,
    date: factura.fecha_emision ?? new Date().toISOString().slice(0, 10),
    description: `Factura recibida ${factura.numero ?? factura.id.slice(0, 8)} · ${factura.contacto_nombre ?? ""}`.trim(),
    sourceType: "factura_recibida",
    sourceId: factura.id,
    lineas,
  });
}

/**
 * Genera el asiento de un gasto sin IVA reflejado en factura (ticket, tasa…).
 */
export async function asentarGasto(
  admin: SupabaseAdmin,
  gasto: {
    id: string;
    empresa_id: string;
    fecha: string | null;
    proveedor: string | null;
    concepto: string | null;
    base: number;
    iva: number;
    total: number;
    metadata: Record<string, unknown>;
  },
  userId: string,
  opts: AutoAsientoOpts = {},
): Promise<{ id: string } | null> {
  const base = Number(gasto.base ?? 0);
  const iva = Number(gasto.iva ?? 0);
  const total = Number(gasto.total ?? 0);
  const cuentaGasto = opts.cuenta_pgc ?? (gasto.metadata?.cuenta_pgc as string | undefined) ?? "629";

  const lineas: Linea[] = [
    { accountCode: cuentaGasto, description: gasto.concepto ?? gasto.proveedor ?? "Gasto", debit: base > 0 ? base : total, credit: 0 },
  ];
  if (iva > 0) lineas.push({ accountCode: "472", description: `IVA soportado`, debit: iva, credit: 0 });
  lineas.push({ accountCode: "410", description: `Proveedor ${gasto.proveedor ?? ""}`, debit: 0, credit: total > 0 ? total : base + iva });

  return postEntry(admin, {
    empresaId: gasto.empresa_id,
    userId,
    date: gasto.fecha ?? new Date().toISOString().slice(0, 10),
    description: `Gasto · ${gasto.proveedor ?? gasto.concepto ?? gasto.id.slice(0, 8)}`,
    sourceType: "gasto",
    sourceId: gasto.id,
    lineas,
  });
}

/**
 * Devuelve si la empresa tiene activado el auto-asentado.
 * Por defecto: activado.
 */
export async function autoAsientosActivado(admin: SupabaseAdmin, empresaId: string): Promise<boolean> {
  const { data } = await admin.from("empresas").select("metadata").eq("id", empresaId).maybeSingle();
  const meta = (data?.metadata ?? {}) as Record<string, unknown>;
  return meta.auto_asientos !== false;
}
