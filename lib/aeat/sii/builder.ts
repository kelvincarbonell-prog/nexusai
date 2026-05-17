/**
 * Construye los XML SOAP que envía SII a AEAT.
 * Cubre los dos servicios principales:
 *   - SuministroFactEmitidas
 *   - SuministroFactRecibidas
 *
 * No firma. La firma del cliente (XAdES-EPES con certificado x509) se
 * realiza en el endpoint /api/aeat/sii/submit que usa el cert del titular
 * (almacenado cifrado en Storage) — implementación pendiente del entorno.
 */

import type {
  SiiFacturaExpedida,
  SiiFacturaRecibida,
  SiiSubmissionRequest,
} from "@/lib/aeat/sii/types";

const NS_SOAP = "http://schemas.xmlsoap.org/soap/envelope/";
const NS_SUM = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/ssii/fact/ws/SuministroLR.xsd";
const NS_SII = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/ssii/fact/ws/SuministroInformacion.xsd";

function esc(s: string | undefined | null): string {
  if (s === undefined || s === null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function n(v: number | undefined): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "0.00";
  return (Math.round(v * 100) / 100).toFixed(2);
}

function expedidaXml(f: SiiFacturaExpedida): string {
  const det = f.factura_expedida.desglose.desglose_factura?.sujeta?.no_exenta?.desglose_iva?.detalle_iva ?? [];
  const detalleXml = det
    .map(
      (d) => `
        <sii:DetalleIVA>
          <sii:TipoImpositivo>${n(d.tipo_impositivo)}</sii:TipoImpositivo>
          <sii:BaseImponible>${n(d.base_imponible)}</sii:BaseImponible>
          <sii:CuotaRepercutida>${n(d.cuota_repercutida ?? 0)}</sii:CuotaRepercutida>
        </sii:DetalleIVA>`,
    )
    .join("");

  const contrap = f.factura_expedida.contraparte;
  const contrapXml = contrap
    ? `
        <sii:Contraparte>
          <sii:NombreRazon>${esc(contrap.nombre_razon)}</sii:NombreRazon>
          ${contrap.nif ? `<sii:NIF>${esc(contrap.nif)}</sii:NIF>` : ""}
        </sii:Contraparte>`
    : "";

  return `
    <siiLR:RegistroLRFacturasEmitidas>
      <sii:PeriodoLiquidacion>
        <sii:Ejercicio>${f.periodo_liquidacion.ejercicio}</sii:Ejercicio>
        <sii:Periodo>${esc(f.periodo_liquidacion.periodo)}</sii:Periodo>
      </sii:PeriodoLiquidacion>
      <sii:IDFactura>
        <sii:IDEmisorFactura>
          <sii:NIF>${esc(f.id_factura.nif_expedidor)}</sii:NIF>
        </sii:IDEmisorFactura>
        <sii:NumSerieFacturaEmisor>${esc(f.id_factura.num_serie_inicio)}</sii:NumSerieFacturaEmisor>
        <sii:FechaExpedicionFacturaEmisor>${esc(f.id_factura.fecha_expedicion)}</sii:FechaExpedicionFacturaEmisor>
      </sii:IDFactura>
      <siiLR:FacturaExpedida>
        <sii:TipoFactura>${esc(f.factura_expedida.tipo_factura)}</sii:TipoFactura>
        <sii:ClaveRegimenEspecialOTrascendencia>${esc(f.factura_expedida.clave_regimen)}</sii:ClaveRegimenEspecialOTrascendencia>
        <sii:ImporteTotal>${n(f.factura_expedida.importe_total)}</sii:ImporteTotal>
        <sii:DescripcionOperacion>${esc(f.factura_expedida.descripcion_operacion)}</sii:DescripcionOperacion>
        ${contrapXml}
        <sii:TipoDesglose>
          <sii:DesgloseFactura>
            <sii:Sujeta>
              <sii:NoExenta>
                <sii:TipoNoExenta>S1</sii:TipoNoExenta>
                <sii:DesgloseIVA>${detalleXml}
                </sii:DesgloseIVA>
              </sii:NoExenta>
            </sii:Sujeta>
          </sii:DesgloseFactura>
        </sii:TipoDesglose>
      </siiLR:FacturaExpedida>
    </siiLR:RegistroLRFacturasEmitidas>`;
}

function recibidaXml(f: SiiFacturaRecibida): string {
  const det = f.factura_recibida.desglose.desglose_factura?.desglose_iva?.detalle_iva ?? [];
  const detalleXml = det
    .map(
      (d) => `
        <sii:DetalleIVA>
          <sii:TipoImpositivo>${n(d.tipo_impositivo)}</sii:TipoImpositivo>
          <sii:BaseImponible>${n(d.base_imponible)}</sii:BaseImponible>
          <sii:CuotaSoportada>${n(d.cuota_soportada ?? 0)}</sii:CuotaSoportada>
        </sii:DetalleIVA>`,
    )
    .join("");
  const contrap = f.factura_recibida.contraparte;
  const contrapXml = contrap
    ? `
        <sii:Contraparte>
          <sii:NombreRazon>${esc(contrap.nombre_razon)}</sii:NombreRazon>
          ${contrap.nif ? `<sii:NIF>${esc(contrap.nif)}</sii:NIF>` : ""}
        </sii:Contraparte>`
    : "";

  return `
    <siiLR:RegistroLRFacturasRecibidas>
      <sii:PeriodoLiquidacion>
        <sii:Ejercicio>${f.periodo_liquidacion.ejercicio}</sii:Ejercicio>
        <sii:Periodo>${esc(f.periodo_liquidacion.periodo)}</sii:Periodo>
      </sii:PeriodoLiquidacion>
      <sii:IDFactura>
        <sii:IDEmisorFactura>
          ${f.id_factura.id_emisor.nif ? `<sii:NIF>${esc(f.id_factura.id_emisor.nif)}</sii:NIF>` : ""}
        </sii:IDEmisorFactura>
        <sii:NumSerieFacturaEmisor>${esc(f.id_factura.num_serie_inicio)}</sii:NumSerieFacturaEmisor>
        <sii:FechaExpedicionFacturaEmisor>${esc(f.id_factura.fecha_expedicion)}</sii:FechaExpedicionFacturaEmisor>
      </sii:IDFactura>
      <siiLR:FacturaRecibida>
        <sii:TipoFactura>${esc(f.factura_recibida.tipo_factura)}</sii:TipoFactura>
        <sii:ClaveRegimenEspecialOTrascendencia>${esc(f.factura_recibida.clave_regimen)}</sii:ClaveRegimenEspecialOTrascendencia>
        <sii:ImporteTotal>${n(f.factura_recibida.importe_total)}</sii:ImporteTotal>
        <sii:DescripcionOperacion>${esc(f.factura_recibida.descripcion_operacion)}</sii:DescripcionOperacion>
        <sii:DesgloseFactura>
          <sii:DesgloseIVA>${detalleXml}
          </sii:DesgloseIVA>
        </sii:DesgloseFactura>
        ${contrapXml}
        <sii:FechaRegContable>${esc(f.factura_recibida.fecha_reg_contable)}</sii:FechaRegContable>
        <sii:CuotaDeducible>${n(f.factura_recibida.cuota_deducible)}</sii:CuotaDeducible>
      </siiLR:FacturaRecibida>
    </siiLR:RegistroLRFacturasRecibidas>`;
}

export function buildSiiEnvelope(req: SiiSubmissionRequest): string {
  const isExpedidas = (req.facturas_expedidas?.length ?? 0) > 0;
  const isRecibidas = (req.facturas_recibidas?.length ?? 0) > 0;
  if (isExpedidas && isRecibidas) {
    throw new Error("Un envío SII solo puede contener facturas expedidas o recibidas, no ambas.");
  }
  if (!isExpedidas && !isRecibidas) {
    throw new Error("Sin facturas que enviar.");
  }

  const wrapper = isExpedidas ? "SuministroLRFacturasEmitidas" : "SuministroLRFacturasRecibidas";
  const cuerpoFacturas = isExpedidas
    ? (req.facturas_expedidas ?? []).map(expedidaXml).join("")
    : (req.facturas_recibidas ?? []).map(recibidaXml).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${NS_SOAP}" xmlns:sii="${NS_SII}" xmlns:siiLR="${NS_SUM}">
  <soapenv:Header/>
  <soapenv:Body>
    <siiLR:${wrapper}>
      <sii:Cabecera>
        <sii:IDVersionSii>1.1</sii:IDVersionSii>
        <sii:Titular>
          <sii:NombreRazon>${esc(req.titular.nombre_razon)}</sii:NombreRazon>
          <sii:NIF>${esc(req.titular.nif)}</sii:NIF>
        </sii:Titular>
        <sii:TipoComunicacion>${esc(req.operacion)}</sii:TipoComunicacion>
      </sii:Cabecera>
      ${cuerpoFacturas}
    </siiLR:${wrapper}>
  </soapenv:Body>
</soapenv:Envelope>`;
}
