/**
 * Mapper: convierte facturas internas (filas Supabase) a los tipos SII.
 * Pensado para alimentar buildSiiEnvelope con datos reales del CRM.
 */

import type {
  SiiFacturaExpedida,
  SiiFacturaRecibida,
  SiiDesglose,
} from "@/lib/aeat/sii/types";

type FacturaRow = {
  id: string;
  numero?: string | null;
  serie?: string | null;
  tipo?: string | null;
  fecha_emision?: string | null;
  base?: number | null;
  iva?: number | null;
  iva_pct?: number | null;
  total?: number | null;
  contacto_nombre?: string | null;
  contacto_nif?: string | null;
  descripcion?: string | null;
  empresa_id?: string | null;
  clave_operacion?: string | null;
};

function isoToSii(fechaISO: string): string {
  // YYYY-MM-DD → DD-MM-YYYY
  const [y, m, d] = fechaISO.split("-");
  return `${d}-${m}-${y}`;
}

function periodoMensual(fechaISO: string): { ejercicio: number; periodo: string } {
  const [y, m] = fechaISO.split("-");
  return { ejercicio: Number(y), periodo: m };
}

function buildDesglose(base: number, iva: number, ivaPct?: number | null): SiiDesglose[] {
  const tipo = ivaPct ?? (base > 0 ? Math.round((iva / base) * 100) : 0);
  return [{ tipo_impositivo: tipo, base_imponible: base, cuota_repercutida: iva, cuota_soportada: iva }];
}

export function facturaToExpedida(f: FacturaRow, emisorNif: string): SiiFacturaExpedida {
  const fecha = f.fecha_emision ?? new Date().toISOString().slice(0, 10);
  const base = Number(f.base ?? 0);
  const iva = Number(f.iva ?? 0);
  const desg = buildDesglose(base, iva, f.iva_pct ?? null);
  return {
    periodo_liquidacion: periodoMensual(fecha),
    id_factura: {
      nif_expedidor: emisorNif,
      num_serie_inicio: `${f.serie ?? ""}${f.numero ?? ""}`,
      fecha_expedicion: isoToSii(fecha),
    },
    factura_expedida: {
      tipo_factura: f.tipo === "rectificativa" ? "R1" : "F1",
      clave_regimen: f.clave_operacion ?? "01",
      descripcion_operacion: f.descripcion?.slice(0, 500) ?? "Operación comercial",
      contraparte: f.contacto_nombre
        ? { nombre_razon: f.contacto_nombre, nif: f.contacto_nif ?? undefined }
        : undefined,
      importe_total: Number(f.total ?? base + iva),
      desglose: {
        desglose_factura: {
          sujeta: {
            no_exenta: {
              tipo_no_exenta: "S1",
              desglose_iva: { detalle_iva: desg },
            },
          },
        },
      },
    },
  };
}

export function facturaToRecibida(f: FacturaRow): SiiFacturaRecibida {
  const fecha = f.fecha_emision ?? new Date().toISOString().slice(0, 10);
  const base = Number(f.base ?? 0);
  const iva = Number(f.iva ?? 0);
  const desg = buildDesglose(base, iva, f.iva_pct ?? null);
  return {
    periodo_liquidacion: periodoMensual(fecha),
    id_factura: {
      id_emisor: { nif: f.contacto_nif ?? undefined },
      num_serie_inicio: `${f.serie ?? ""}${f.numero ?? f.id.slice(0, 8)}`,
      fecha_expedicion: isoToSii(fecha),
    },
    factura_recibida: {
      tipo_factura: "F1",
      clave_regimen: f.clave_operacion ?? "01",
      descripcion_operacion: f.descripcion?.slice(0, 500) ?? "Bien o servicio recibido",
      desglose: {
        desglose_factura: {
          desglose_iva: { detalle_iva: desg },
        },
      },
      contraparte: f.contacto_nombre
        ? { nombre_razon: f.contacto_nombre, nif: f.contacto_nif ?? undefined }
        : undefined,
      fecha_reg_contable: isoToSii(fecha),
      importe_total: Number(f.total ?? base + iva),
      cuota_deducible: iva,
    },
  };
}
