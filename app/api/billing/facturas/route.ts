import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany, isGestorOrAdmin } from "@/lib/laboral/access";
import { asentarFacturaEmitida, autoAsientosActivado } from "@/lib/accounting/auto-asientos";
import { generarHashFactura, generarUrlQR } from "@/lib/payments/verifactu";

const Linea = z.object({
  descripcion: z.string().min(1).max(500),
  cantidad: z.number().min(0).default(1),
  precio_unitario: z.number().min(0),
  iva_pct: z.number().min(0).max(50).default(21),
  descuento_pct: z.number().min(0).max(100).default(0),
});

const Create = z.object({
  empresa_id: z.string().uuid(),
  tipo: z.enum(["emitida", "recibida", "simplificada"]).default("emitida"),
  contacto_nombre: z.string().min(1).max(180),
  contacto_nif: z.string().max(30).optional(),
  contacto_email: z.string().email().optional(),
  fecha_emision: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fecha_vencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  lineas: z.array(Linea).min(1).max(50),
  irpf_pct: z.number().min(0).max(50).default(0),
  notas: z.string().max(2000).optional(),
  estado: z.enum(["borrador", "emitida", "enviada", "pagada"]).default("borrador"),
});

function nextNumero(serie: string, ultimoNumero: number): string {
  return `${serie || "FAC"}-${String(ultimoNumero + 1).padStart(4, "0")}`;
}

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  const tipo = request.nextUrl.searchParams.get("tipo");
  if (!empresaId) return jsonError("Falta empresa_id");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, empresaId))) return jsonError("Sin acceso", 403);

  let q = admin
    .from("facturas")
    .select("id,numero,tipo,contacto_nombre,fecha_emision,fecha_vencimiento,base,iva,total,estado,payment_status,payment_link_url,metadata,created_at")
    .eq("empresa_id", empresaId)
    .order("fecha_emision", { ascending: false, nullsFirst: false })
    .limit(200);
  if (tipo) q = q.eq("tipo", tipo);
  const { data, error } = await q;
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Create.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  // Calcular totales
  let base = 0;
  let ivaTotal = 0;
  for (const l of parsed.data.lineas) {
    const sub = l.cantidad * l.precio_unitario * (1 - l.descuento_pct / 100);
    base += sub;
    ivaTotal += (sub * l.iva_pct) / 100;
  }
  base = Math.round(base * 100) / 100;
  ivaTotal = Math.round(ivaTotal * 100) / 100;
  const retencion = Math.round((base * parsed.data.irpf_pct / 100) * 100) / 100;
  const total = Math.round((base + ivaTotal - retencion) * 100) / 100;

  // Generar siguiente número usando la serie de la empresa
  const { data: empresa } = await admin
    .from("empresas")
    .select("nif,nombre,metadata")
    .eq("id", parsed.data.empresa_id)
    .single();
  const empresaMeta = (empresa?.metadata ?? {}) as Record<string, unknown>;
  const serie = (empresaMeta.serie as string | undefined) ?? "FAC";

  const { data: lastFactura } = await admin
    .from("facturas")
    .select("numero")
    .eq("empresa_id", parsed.data.empresa_id)
    .eq("tipo", parsed.data.tipo)
    .ilike("numero", `${serie}-%`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let ultimoNumero = (empresaMeta.numero_inicial as number | undefined) ?? 0;
  if (lastFactura?.numero) {
    const match = /-(\d+)$/.exec(lastFactura.numero);
    if (match) ultimoNumero = Math.max(ultimoNumero, Number(match[1]));
  }
  const numero = nextNumero(serie, ultimoNumero);

  const { data, error } = await admin
    .from("facturas")
    .insert({
      empresa_id: parsed.data.empresa_id,
      gestor_id: user.id,
      tipo: parsed.data.tipo,
      numero,
      contacto_nombre: parsed.data.contacto_nombre,
      fecha_emision: parsed.data.fecha_emision ?? new Date().toISOString().slice(0, 10),
      fecha_vencimiento: parsed.data.fecha_vencimiento ?? null,
      base,
      iva: ivaTotal,
      total,
      estado: parsed.data.estado,
      metadata: {
        contacto_nif: parsed.data.contacto_nif,
        contacto_email: parsed.data.contacto_email,
        lineas: parsed.data.lineas,
        irpf_pct: parsed.data.irpf_pct,
        retencion,
        notas: parsed.data.notas,
      },
    })
    .select("*")
    .single();
  if (error || !data) return jsonError(error?.message ?? "No se pudo crear", 500);

  // VeriFactu — solo facturas emitidas y solo si la empresa lo tiene activado
  if (parsed.data.tipo === "emitida") {
    try {
      const empresaMeta2 = (empresa?.metadata ?? {}) as Record<string, unknown>;
      if (empresaMeta2.verifactu === true) {
        // Encadena con el hash de la última factura VeriFactu de la empresa
        const { data: last } = await admin
          .from("facturas")
          .select("metadata")
          .eq("empresa_id", parsed.data.empresa_id)
          .eq("tipo", "emitida")
          .not("metadata->>verifactu_hash", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const hashAnterior = (last?.metadata as Record<string, unknown> | undefined)?.verifactu_hash as string | undefined ?? "";

        const verifactuData = {
          emisor_nif: empresa?.nif ?? (empresaMeta2.nif as string ?? ""),
          numero_factura: numero,
          fecha_emision: data.fecha_emision ?? new Date().toISOString().slice(0, 10),
          importe_total: total,
          base_imponible: base,
          cuota_iva: ivaTotal,
          iva_pct: parsed.data.lineas[0]?.iva_pct ?? 21,
          tipo_factura: "F1" as const,
        };
        const hash = generarHashFactura(verifactuData, hashAnterior);
        const qrUrl = generarUrlQR(verifactuData, hash);
        await admin
          .from("facturas")
          .update({
            metadata: {
              ...(data.metadata as Record<string, unknown>),
              verifactu_hash: hash,
              verifactu_hash_anterior: hashAnterior,
              verifactu_qr_url: qrUrl,
              verifactu_fecha_generacion: new Date().toISOString(),
              verifactu_status: "pendiente_envio",
            },
          })
          .eq("id", data.id);
      }
    } catch {
      // No bloquea: el VeriFactu se puede regenerar desde el endpoint dedicado.
    }
  }

  // Auto-asentado contable si está activado
  let asiento_id: string | null = null;
  try {
    if (parsed.data.tipo === "emitida" && (await autoAsientosActivado(admin, parsed.data.empresa_id))) {
      const asiento = await asentarFacturaEmitida(
        admin,
        {
          id: data.id,
          empresa_id: data.empresa_id,
          fecha_emision: data.fecha_emision,
          contacto_nombre: data.contacto_nombre,
          numero: data.numero,
          base: Number(data.base ?? 0),
          iva: Number(data.iva ?? 0),
          total: Number(data.total ?? 0),
          metadata: (data.metadata ?? {}) as Record<string, unknown>,
        },
        user.id,
      );
      asiento_id = asiento?.id ?? null;
    }
  } catch {
    // No bloquea la respuesta si el asiento falla.
  }

  return NextResponse.json({ ok: true, factura: data, asiento_id });
}
