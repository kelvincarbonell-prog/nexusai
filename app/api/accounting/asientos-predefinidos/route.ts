import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { PLANTILLAS, getPlantilla, resolveFormula, resolveTemplate } from "@/lib/accounting/asientos-predefinidos";

export async function GET() {
  return NextResponse.json({ ok: true, plantillas: PLANTILLAS });
}

const Schema = z.object({
  empresa_id: z.string().uuid(),
  plantilla_id: z.string(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  inputs: z.record(z.union([z.string(), z.number()])),
});

const SEED_BASIC: Record<string, { name: string; group: string; type: "asset" | "liability" | "equity" | "income" | "expense"; balance: "debit" | "credit" }> = {
  "170": { name: "Deudas l/p con entidades de crédito", group: "1", type: "liability", balance: "credit" },
  "216": { name: "Mobiliario", group: "2", type: "asset", balance: "debit" },
  "2816": { name: "Amortización acumulada mobiliario", group: "2", type: "asset", balance: "credit" },
  "410": { name: "Acreedores por prestación de servicios", group: "4", type: "liability", balance: "credit" },
  "430": { name: "Clientes", group: "4", type: "asset", balance: "debit" },
  "472": { name: "HP IVA soportado", group: "4", type: "asset", balance: "debit" },
  "473": { name: "HP retenciones y pagos a cuenta", group: "4", type: "asset", balance: "debit" },
  "4750": { name: "HP acreedora por IVA", group: "4", type: "liability", balance: "credit" },
  "4751": { name: "HP acreedora retenciones IRPF", group: "4", type: "liability", balance: "credit" },
  "476": { name: "Organismos SS acreedores", group: "4", type: "liability", balance: "credit" },
  "477": { name: "HP IVA repercutido", group: "4", type: "liability", balance: "credit" },
  "572": { name: "Bancos", group: "5", type: "asset", balance: "debit" },
  "640": { name: "Sueldos y salarios", group: "6", type: "expense", balance: "debit" },
  "642": { name: "SS a cargo empresa", group: "6", type: "expense", balance: "debit" },
  "662": { name: "Intereses de deudas", group: "6", type: "expense", balance: "debit" },
  "681": { name: "Amortización inmovilizado material", group: "6", type: "expense", balance: "debit" },
};

async function ensureAccount(admin: ReturnType<typeof createSupabaseAdmin>, empresaId: string, code: string): Promise<string | null> {
  const { data: existing } = await admin
    .from("pgc_accounts")
    .select("id")
    .or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
    .eq("code", code)
    .order("empresa_id", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const seed = SEED_BASIC[code];
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

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const plantilla = getPlantilla(parsed.data.plantilla_id);
  if (!plantilla) return jsonError("Plantilla no encontrada", 404);

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  // Resuelve líneas
  const inputs = parsed.data.inputs;
  type Linea = { accountCode: string; description: string; debit: number; credit: number };
  const lineas: Linea[] = plantilla.lineas.map((l) => ({
    accountCode: resolveTemplate(l.accountCode, inputs),
    description: resolveTemplate(l.description, inputs),
    debit: l.debit ? Math.round(resolveFormula(l.debit, inputs) * 100) / 100 : 0,
    credit: l.credit ? Math.round(resolveFormula(l.credit, inputs) * 100) / 100 : 0,
  }));

  // Verifica cuadre
  const totalDebit = lineas.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lineas.reduce((s, l) => s + l.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.05) {
    return jsonError(`El asiento no cuadra. Debe ${totalDebit.toFixed(2)} ≠ Haber ${totalCredit.toFixed(2)}. Revisa los importes.`);
  }

  // Resuelve cuentas
  const resolved: { accountId: string; description: string; debit: number; credit: number }[] = [];
  for (const l of lineas) {
    if (l.debit === 0 && l.credit === 0) continue;
    const accountId = await ensureAccount(admin, parsed.data.empresa_id, l.accountCode);
    if (!accountId) return jsonError(`Cuenta PGC ${l.accountCode} no existe y no se pudo crear automáticamente.`);
    resolved.push({ accountId, description: l.description, debit: l.debit, credit: l.credit });
  }

  // Obtiene siguiente nº asiento
  const { data: lastEntry } = await admin
    .from("journal_entries")
    .select("entry_number")
    .eq("empresa_id", parsed.data.empresa_id)
    .order("entry_number", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const entryNumber = Number(lastEntry?.entry_number ?? 0) + 1;
  const description = resolveTemplate(plantilla.descripcionAsiento, inputs);

  const { data: entry, error: errEntry } = await admin
    .from("journal_entries")
    .insert({
      empresa_id: parsed.data.empresa_id,
      entry_number: entryNumber,
      entry_date: parsed.data.fecha,
      description,
      source_type: `plantilla:${plantilla.id}`,
      source_id: null,
      status: "posted",
      created_by: user.id,
      posted_by: user.id,
      posted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (errEntry || !entry) return jsonError(errEntry?.message ?? "No se pudo crear el asiento", 500);

  const lines = resolved.map((l, i) => ({
    entry_id: entry.id,
    empresa_id: parsed.data.empresa_id,
    account_id: l.accountId,
    line_number: i + 1,
    description: l.description,
    debit: l.debit,
    credit: l.credit,
  }));
  const { error: errLines } = await admin.from("journal_lines").insert(lines);
  if (errLines) {
    await admin.from("journal_entries").delete().eq("id", entry.id);
    return jsonError(errLines.message, 500);
  }

  return NextResponse.json({ ok: true, asiento_id: entry.id, entry_number: entryNumber, descripcion: description, total: totalDebit });
}
