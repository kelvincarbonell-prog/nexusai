import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Onboarding rápido de cliente nuevo en un solo POST.
 *
 * Crea la empresa + opcionalmente:
 *   - asociar gestor (el actual)
 *   - crear inbox alias automático
 *   - sembrar gastos recurrentes típicos (asesoría, dominio)
 *   - registrar el primer evento en agent_runs
 *   - opcionalmente alta_trabajador inicial
 *
 * Devuelve la empresa creada y URLs de acceso rápido.
 */

const Schema = z.object({
  nombre: z.string().min(2).max(180),
  nif: z.string().min(8).max(20),
  tipo: z.enum(["autonomo", "empresa"]).default("autonomo"),
  account_type: z.enum(["autonomo", "empresa"]).optional(),
  email: z.string().email().optional(),
  cnae: z.string().max(10).optional(),
  ccaa: z.string().max(10).optional(),
  iban: z.string().max(40).optional(),
  semilla: z.object({
    crear_inbox: z.boolean().default(true),
    gastos_recurrentes_demo: z.boolean().default(false),
    asociar_gestor: z.boolean().default(true),
  }).default({ crear_inbox: true, gastos_recurrentes_demo: false, asociar_gestor: true }),
  primer_trabajador: z.object({
    nombre: z.string().min(2).max(180),
    apellidos: z.string().max(180).optional(),
    dni: z.string().max(20).optional(),
    salario_bruto_anual: z.number().min(0).optional(),
    fecha_alta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }).optional(),
});

function inboxAliasFor(nombre: string, nif: string): string {
  const base = (nombre + "-" + nif.slice(-4))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base || `cliente-${Date.now()}`;
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  const tipo = parsed.data.tipo;
  const account_type = parsed.data.account_type ?? tipo;
  const alias = parsed.data.semilla.crear_inbox ? inboxAliasFor(parsed.data.nombre, parsed.data.nif) : null;

  const { data: empresa, error } = await admin
    .from("empresas")
    .insert({
      nombre: parsed.data.nombre,
      nif: parsed.data.nif.toUpperCase(),
      tipo,
      account_type,
      gestor_id: parsed.data.semilla.asociar_gestor ? user.id : null,
      email: parsed.data.email ?? null,
      cnae: parsed.data.cnae ?? null,
      ccaa: parsed.data.ccaa ?? null,
      iban: parsed.data.iban ?? null,
      inbox_alias: alias,
      plan: "free",
      metadata: { onboarding: "quick-create", creada_en: new Date().toISOString() },
    })
    .select("*")
    .single();
  if (error || !empresa) return jsonError(error?.message ?? "No se pudo crear la empresa", 500);

  // Trabajador inicial (opcional)
  let trabajadorId: string | null = null;
  if (parsed.data.primer_trabajador) {
    const t = parsed.data.primer_trabajador;
    const { data: trab } = await admin
      .from("trabajadores")
      .insert({
        empresa_id: empresa.id,
        gestor_id: user.id,
        nombre: t.nombre,
        apellidos: t.apellidos ?? null,
        dni: t.dni?.toUpperCase() ?? null,
        salario_bruto_anual: t.salario_bruto_anual ?? null,
        fecha_alta: t.fecha_alta ?? new Date().toISOString().slice(0, 10),
        tipo_contrato: "indefinido",
        activo: true,
      })
      .select("id")
      .single();
    trabajadorId = trab?.id ?? null;
  }

  // Gastos recurrentes demo (asesoría 80€/mes)
  if (parsed.data.semilla.gastos_recurrentes_demo) {
    try {
      await admin.from("gastos_recurrentes").insert({
        empresa_id: empresa.id,
        gestor_id: user.id,
        proveedor: "Asesoría Modelo 26",
        concepto: "Cuota mensual gestoría",
        cuenta_pgc: "623",
        base: 80,
        iva: 16.8,
        iva_pct: 21,
        irpf: 12,
        irpf_pct: 15,
        total: 84.8,
        periodicidad: "mensual",
        dia_emision: 1,
        fecha_inicio: new Date().toISOString().slice(0, 10),
        proximo_envio: new Date().toISOString().slice(0, 10),
        activo: true,
      });
    } catch {
      // si la tabla no está creada aún, no rompe el flujo
    }
  }

  // Registro del evento en agent_runs (best-effort)
  try {
    await admin.from("agent_runs").insert({
      empresa_id: empresa.id,
      agent_id: "onboarding",
      triggered_by: user.id,
      input: { nombre: parsed.data.nombre, nif: parsed.data.nif },
      output: { trabajador_inicial: trabajadorId },
      status: "success",
    });
  } catch { /* silencio */ }

  return NextResponse.json({
    ok: true,
    empresa: {
      id: empresa.id,
      nombre: empresa.nombre,
      nif: empresa.nif,
      inbox_alias: alias,
    },
    trabajador_id: trabajadorId,
    siguientes_pasos: [
      { label: "Abrir ficha del cliente", href: `/clientes/${empresa.id}` },
      { label: "Configurar datos fiscales", href: `/clientes/${empresa.id}?tab=configuracion` },
      { label: "Subir primera factura (OCR)", href: `/clientes/${empresa.id}?tab=lector-gastos` },
      ...(alias ? [{ label: `Buzón email: ${alias}@inbox.m26.app`, href: `/clientes/${empresa.id}` }] : []),
    ],
  });
}
