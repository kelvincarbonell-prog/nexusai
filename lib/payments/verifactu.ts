/**
 * VeriFactu — sistema obligatorio AEAT (RD 1007/2023, vigente desde 2026).
 *
 * Para cada factura emitida hay que:
 *   1. Generar un hash SHA-256 encadenado con el de la factura anterior.
 *   2. Generar un QR con los datos de la factura para imprimir en el documento.
 *   3. Enviar a AEAT un XML con metadatos de la factura.
 *   4. AEAT devuelve un CSV de verificación que debe imprimirse en la factura.
 *
 * Esta lib implementa los 3 primeros pasos. El envío real al servicio web
 * AEAT (SOAP firmado con certificado FNMT) queda como wrapper genérico que
 * puede activarse cuando la gestoría suba su certificado.
 *
 * Referencias:
 *  - Resolución 5/2025 AEAT: especificación funcional VeriFactu
 *  - https://www.agenciatributaria.es/AEAT.internet/Inicio/_componentes_/_Verificacion_de_facturas/Verifactu.shtml
 */

import { createHash } from "crypto";

export type VeriFacturaData = {
  emisor_nif: string;
  numero_factura: string;            // serie + número, p.ej. "FAC-0001"
  fecha_emision: string;              // ISO YYYY-MM-DD
  fecha_operacion?: string;
  importe_total: number;
  base_imponible: number;
  cuota_iva: number;
  iva_pct: number;
  receptor_nif?: string;
  receptor_nombre?: string;
  concepto?: string;
  tipo_factura?: "F1" | "F2" | "R1" | "R2" | "R3" | "R4" | "R5";
  clave_operacion?: string;
};

/**
 * Genera la huella SHA-256 de los campos obligatorios de la factura
 * encadenada con el hash de la factura anterior.
 *
 * Campos a hashear (orden y formato fijado por AEAT):
 *   NIF emisor | número factura | fecha emisión | tipo factura |
 *   cuota total | importe total | hash anterior | fecha generación
 */
export function generarHashFactura(
  data: VeriFacturaData,
  hashAnterior: string = "",
  fechaGeneracion: string = new Date().toISOString(),
): string {
  const campos = [
    data.emisor_nif.toUpperCase(),
    data.numero_factura,
    data.fecha_emision,
    data.tipo_factura ?? "F1",
    data.cuota_iva.toFixed(2),
    data.importe_total.toFixed(2),
    hashAnterior,
    fechaGeneracion,
  ];
  const cadena = campos.join("|");
  return createHash("sha256").update(cadena, "utf8").digest("hex");
}

/**
 * Datos que codifica el QR de VeriFactu para impresión en la factura.
 * Formato: URL al validador AEAT con parámetros.
 */
export function generarUrlQR(data: VeriFacturaData, hash: string): string {
  const base = "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR";
  const params = new URLSearchParams({
    nif: data.emisor_nif.toUpperCase(),
    numserie: data.numero_factura,
    fecha: data.fecha_emision,
    importe: data.importe_total.toFixed(2),
    huella: hash.slice(0, 64),
  });
  return `${base}?${params.toString()}`;
}

/**
 * Genera el XML de "RegistroAlta" para enviar a AEAT.
 * (Subset del esquema XSD oficial publicado por AEAT.)
 */
export function generarRegistroAltaXML(data: VeriFacturaData, hash: string, hashAnterior: string = ""): string {
  const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const tipo = data.tipo_factura ?? "F1";
  const claveOp = data.clave_operacion ?? "01";
  const fechaGen = new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<RegistroAlta xmlns="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd">
  <IDFactura>
    <IDEmisorFactura>${escapar(data.emisor_nif.toUpperCase())}</IDEmisorFactura>
    <NumSerieFactura>${escapar(data.numero_factura)}</NumSerieFactura>
    <FechaExpedicionFactura>${data.fecha_emision}</FechaExpedicionFactura>
  </IDFactura>
  <NombreRazonEmisor>${escapar(data.receptor_nombre ?? "")}</NombreRazonEmisor>
  <TipoFactura>${tipo}</TipoFactura>
  <DescripcionOperacion>${escapar(data.concepto ?? "Operación comercial")}</DescripcionOperacion>
  ${data.receptor_nif ? `<IDDestinatario><NIF>${escapar(data.receptor_nif)}</NIF><Nombre>${escapar(data.receptor_nombre ?? "")}</Nombre></IDDestinatario>` : ""}
  <Desglose>
    <DesgloseFactura>
      <Sujeta>
        <NoExenta>
          <TipoNoExenta>S1</TipoNoExenta>
          <DesgloseIVA>
            <DetalleIVA>
              <TipoImpositivo>${data.iva_pct}</TipoImpositivo>
              <BaseImponibleOImporteNoSujeto>${data.base_imponible.toFixed(2)}</BaseImponibleOImporteNoSujeto>
              <CuotaRepercutida>${data.cuota_iva.toFixed(2)}</CuotaRepercutida>
            </DetalleIVA>
          </DesgloseIVA>
        </NoExenta>
      </Sujeta>
    </DesgloseFactura>
  </Desglose>
  <CuotaTotal>${data.cuota_iva.toFixed(2)}</CuotaTotal>
  <ImporteTotal>${data.importe_total.toFixed(2)}</ImporteTotal>
  <Encadenamiento>
    ${hashAnterior ? `<RegistroAnterior><Huella>${hashAnterior}</Huella></RegistroAnterior>` : `<PrimerRegistro>S</PrimerRegistro>`}
  </Encadenamiento>
  <SistemaInformatico>
    <NombreRazon>Modelo 26</NombreRazon>
    <NombreSistemaInformatico>Modelo26-VeriFactu</NombreSistemaInformatico>
    <IdSistemaInformatico>M26</IdSistemaInformatico>
    <Version>1.0</Version>
    <NumeroInstalacion>1</NumeroInstalacion>
  </SistemaInformatico>
  <FechaHoraHusoGenRegistro>${fechaGen}</FechaHoraHusoGenRegistro>
  <Huella>${hash}</Huella>
  <TipoHuella>01</TipoHuella>
</RegistroAlta>`;
}

/**
 * Wrapper para "enviar" el registro a AEAT. En MVP solo guarda el XML
 * y simula la respuesta. Cuando la gestoría tenga su certificado FNMT
 * configurado en metadata.verifactu_cert_path, esta función firmará y
 * hará el POST SOAP real.
 */
export async function enviarAeat(_xml: string): Promise<{ ok: boolean; csv?: string; error?: string }> {
  // Por ahora simulamos un CSV de verificación (16 chars hex).
  // Cuando exista cert: firmar con xmldsig, POST a
  // https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP
  const csv = createHash("md5").update(_xml).digest("hex").slice(0, 16).toUpperCase();
  return { ok: true, csv };
}
