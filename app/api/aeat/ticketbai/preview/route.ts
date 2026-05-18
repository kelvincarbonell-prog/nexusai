import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";
import { buildFacturaXml, type TBaiTerritorio } from "@/lib/aeat/ticketbai/builder";

const Schema = z.object({
  empresa_id: z.string().uuid(),
  factura_id: z.string().uuid(),
  territorio: z.enum(["araba", "bizkaia", "gipuzkoa"]),
});

/**
 * Preview TicketBAI XML para una factura emitida. Sin firma todavía.
 */
export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message ?? "Datos inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const [{ data: empresa }, { data: factura }] = await Promise.all([
    admin.from("empresas").select("nif,nombre").eq("id", parsed.data.empresa_id).maybeSingle(),
    admin
      .from("facturas")
      .select("numero,serie,fecha_emision,contacto_nombre,contacto_nif,base,iva,iva_pct,total,descripcion,metadata")
      .eq("id", parsed.data.factura_id)
      .eq("empresa_id", parsed.data.empresa_id)
      .maybeSingle(),
  ]);
  if (!empresa) return jsonError("Empresa no encontrada", 404);
  if (!factura) return jsonError("Factura no encontrada", 404);
  if (!empresa.nif) return jsonError("La empresa no tiene NIF configurado", 400);

  const base = Number(factura.base ?? 0);
  const iva = Number(factura.iva ?? 0);
  const ivaPct = Number(factura.iva_pct ?? (base > 0 ? Math.round((iva / base) * 100) : 0));

  const { xml, hash } = buildFacturaXml(
    {
      nif: empresa.nif,
      razon_social: empresa.nombre ?? empresa.nif,
      territorio: parsed.data.territorio as TBaiTerritorio,
    },
    {
      serie: factura.serie ?? undefined,
      numero: factura.numero ?? "1",
      fecha_expedicion: factura.fecha_emision ?? new Date().toISOString().slice(0, 10),
      hora_expedicion: new Date().toTimeString().slice(0, 8),
      descripcion_operacion: factura.descripcion ?? "Operación comercial",
      destinatario: {
        nif: factura.contacto_nif ?? undefined,
        nombre: factura.contacto_nombre ?? "Cliente",
      },
      lineas: [
        {
          descripcion: factura.descripcion ?? "Servicio",
          cantidad: 1,
          precio_unitario: base,
          base_imponible: base,
          tipo_iva: ivaPct,
          cuota_iva: iva,
        },
      ],
      importe_total: Number(factura.total ?? base + iva),
    },
  );

  return NextResponse.json({
    ok: true,
    territorio: parsed.data.territorio,
    xml,
    hash,
    note: "XML TicketBAI listo. Falta firma XAdES con certificado del titular y envío a la Diputación Foral correspondiente.",
  });
}
