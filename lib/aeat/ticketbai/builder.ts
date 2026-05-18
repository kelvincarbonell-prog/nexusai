/**
 * TicketBAI — Obligación de facturación electrónica del País Vasco.
 *
 * Aplica a empresas/autónomos de Álava, Bizkaia y Gipuzkoa. Cada
 * Diputación Foral tiene XSD ligeramente distinto pero compatible.
 *
 * Este módulo genera el XML base de "FacturaEmitida" más el hash
 * de encadenamiento. La firma XAdES y el envío vía LROE/SII-bizkaia
 * se hace después con el certificado del titular.
 */

import crypto from "crypto";

export type TBaiTerritorio = "araba" | "bizkaia" | "gipuzkoa";

export type TBaiTitular = {
  nif: string;
  razon_social: string;
  territorio: TBaiTerritorio;
};

export type TBaiDestinatario = {
  nif?: string;
  nombre: string;
  direccion?: string;
  codigo_pais?: string;
};

export type TBaiLinea = {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  base_imponible: number;
  tipo_iva: number;
  cuota_iva: number;
};

export type TBaiFactura = {
  serie?: string;
  numero: string;
  fecha_expedicion: string;    // YYYY-MM-DD
  hora_expedicion: string;     // HH:MM:SS
  descripcion_operacion: string;
  destinatario: TBaiDestinatario;
  lineas: TBaiLinea[];
  importe_total: number;
  /** Encadenamiento: hash de la factura anterior (vacío si es la primera). */
  encadenamiento?: {
    serie_anterior?: string;
    numero_anterior?: string;
    fecha_anterior?: string;
    hash_anterior?: string;
  };
};

function esc(s: string | undefined | null): string {
  if (s === undefined || s === null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
const n = (v: number) => (Math.round(v * 100) / 100).toFixed(2);

function isoToTbai(fecha: string): string {
  // YYYY-MM-DD → DD-MM-YYYY
  const [y, m, d] = fecha.split("-");
  return `${d}-${m}-${y}`;
}

export function buildFacturaXml(titular: TBaiTitular, f: TBaiFactura): { xml: string; hash: string } {
  const lineasXml = f.lineas.map((l) => `
    <DetalleFactura>
      <DescripcionDetalle>${esc(l.descripcion)}</DescripcionDetalle>
      <Cantidad>${n(l.cantidad)}</Cantidad>
      <ImporteUnitario>${n(l.precio_unitario)}</ImporteUnitario>
      <BaseImponible>${n(l.base_imponible)}</BaseImponible>
      <TipoImpositivo>${n(l.tipo_iva)}</TipoImpositivo>
      <CuotaImpuesto>${n(l.cuota_iva)}</CuotaImpuesto>
    </DetalleFactura>`).join("");

  const enc = f.encadenamiento;
  const encXml = enc
    ? `
    <EncadenamientoFacturaAnterior>
      ${enc.serie_anterior ? `<SerieFacturaAnterior>${esc(enc.serie_anterior)}</SerieFacturaAnterior>` : ""}
      <NumFacturaAnterior>${esc(enc.numero_anterior ?? "")}</NumFacturaAnterior>
      <FechaExpedicionFacturaAnterior>${esc(isoToTbai(enc.fecha_anterior ?? f.fecha_expedicion))}</FechaExpedicionFacturaAnterior>
      <SignatureValueFirmaFacturaAnterior>${esc(enc.hash_anterior ?? "")}</SignatureValueFirmaFacturaAnterior>
    </EncadenamientoFacturaAnterior>`
    : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<TicketBai xmlns="urn:ticketbai:emision" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="1.2">
  <Cabecera>
    <IDVersionTBAI>1.2</IDVersionTBAI>
  </Cabecera>
  <Sujetos>
    <Emisor>
      <NIF>${esc(titular.nif)}</NIF>
      <ApellidosNombreRazonSocial>${esc(titular.razon_social)}</ApellidosNombreRazonSocial>
      <Territorio>${esc(titular.territorio)}</Territorio>
    </Emisor>
    <Destinatarios>
      <IDDestinatario>
        ${f.destinatario.nif ? `<NIF>${esc(f.destinatario.nif)}</NIF>` : ""}
        <ApellidosNombreRazonSocial>${esc(f.destinatario.nombre)}</ApellidosNombreRazonSocial>
        ${f.destinatario.direccion ? `<DireccionPostal>${esc(f.destinatario.direccion)}</DireccionPostal>` : ""}
        <CodigoPais>${esc(f.destinatario.codigo_pais ?? "ES")}</CodigoPais>
      </IDDestinatario>
    </Destinatarios>
  </Sujetos>
  <Factura>
    <CabeceraFactura>
      ${f.serie ? `<SerieFactura>${esc(f.serie)}</SerieFactura>` : ""}
      <NumFactura>${esc(f.numero)}</NumFactura>
      <FechaExpedicionFactura>${esc(isoToTbai(f.fecha_expedicion))}</FechaExpedicionFactura>
      <HoraExpedicionFactura>${esc(f.hora_expedicion)}</HoraExpedicionFactura>
    </CabeceraFactura>
    <DatosFactura>
      <DescripcionFactura>${esc(f.descripcion_operacion)}</DescripcionFactura>
      <DetallesFactura>${lineasXml}
      </DetallesFactura>
      <ImporteTotalFactura>${n(f.importe_total)}</ImporteTotalFactura>
    </DatosFactura>
  </Factura>
  <HuellaTBAI>${encXml}
    <Software>
      <LicenciaTBAI>${esc(process.env.TBAI_LICENCIA ?? "TBAIPENDIENTE")}</LicenciaTBAI>
      <EntidadDesarrolladora>
        <NIF>${esc(process.env.TBAI_DESARROLLADOR_NIF ?? "")}</NIF>
      </EntidadDesarrolladora>
      <Nombre>Modelo 26</Nombre>
      <Version>1.0</Version>
    </Software>
  </HuellaTBAI>
</TicketBai>`;

  // Hash SHA-256 del XML como huella (la firma real XAdES se aplica después)
  const hash = crypto.createHash("sha256").update(xml).digest("hex");
  return { xml, hash };
}
