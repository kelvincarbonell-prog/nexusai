/**
 * SII (Suministro Inmediato de Información) — tipos básicos.
 *
 * SII es obligatorio para grandes empresas (>6M facturación) y opcional
 * para el resto. Permite la presentación electrónica de libros registro
 * en 4 días desde la emisión/recepción de la factura.
 *
 * Ref. Orden HFP/417/2017 y AEAT WSDL:
 *   https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/ssii/fact/ws/SuministroFactEmitidas.wsdl
 */

export type SiiTitular = {
  nif: string;
  nombre_razon: string;
};

export type SiiContraparte = {
  nif?: string;
  nif_ue?: string;
  nif_otro?: { codigo_pais: string; id_type: "02" | "03" | "04" | "05" | "06" | "07"; id: string };
  nombre_razon: string;
};

export type SiiDesglose = {
  tipo_impositivo: number; // 21, 10, 4, 0
  base_imponible: number;
  cuota_repercutida?: number;
  cuota_soportada?: number;
};

export type SiiFacturaExpedida = {
  periodo_liquidacion: { ejercicio: number; periodo: string }; // "01"..."12"
  id_factura: {
    nif_expedidor: string;
    num_serie_inicio: string;
    fecha_expedicion: string; // DD-MM-YYYY
  };
  factura_expedida: {
    tipo_factura: "F1" | "F2" | "F3" | "F4" | "F5" | "R1" | "R2" | "R3" | "R4" | "R5";
    clave_regimen: string;   // "01" general, "02" exportaciones, ...
    descripcion_operacion: string;
    contraparte?: SiiContraparte;
    importe_total: number;
    desglose: { desglose_factura?: { sujeta?: { no_exenta?: { tipo_no_exenta: "S1" | "S2"; desglose_iva: { detalle_iva: SiiDesglose[] } } } } };
  };
};

export type SiiFacturaRecibida = {
  periodo_liquidacion: { ejercicio: number; periodo: string };
  id_factura: {
    id_emisor: { nif?: string };
    num_serie_inicio: string;
    fecha_expedicion: string;
  };
  factura_recibida: {
    tipo_factura: "F1" | "F2" | "F3" | "F4" | "F5" | "R1" | "R2" | "R3" | "R4" | "R5";
    clave_regimen: string;
    descripcion_operacion: string;
    desglose: { desglose_factura?: { inversion_sujeto_pasivo?: { detalle_iva: SiiDesglose[] }; desglose_iva?: { detalle_iva: SiiDesglose[] } } };
    contraparte?: SiiContraparte;
    fecha_reg_contable: string;
    importe_total: number;
    cuota_deducible: number;
  };
};

export type SiiOperacion = "A0" | "A1" | "A4"; // alta, modificación, alta por subsanación

export type SiiSubmissionRequest = {
  operacion: SiiOperacion;
  titular: SiiTitular;
  facturas_expedidas?: SiiFacturaExpedida[];
  facturas_recibidas?: SiiFacturaRecibida[];
};

export type SiiSubmissionResult = {
  ok: boolean;
  csv?: string;            // Código Seguro de Verificación si SOAP responde Correcto
  estado_envio?: "Correcto" | "ParcialmenteCorrecto" | "Incorrecto";
  errores?: Array<{ codigo: string; descripcion: string; id_factura?: string }>;
  raw?: string;
};
