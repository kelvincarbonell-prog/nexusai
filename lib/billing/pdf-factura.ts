import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Empresa = { nombre: string; nif?: string; direccion?: string; logo_url?: string; color_primario?: string; pie_factura?: string };
type Factura = {
  numero: string | null;
  contacto_nombre: string | null;
  contacto_nif?: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  base: number;
  iva: number;
  total: number;
  estado: string;
  payment_link_url?: string | null;
  metadata?: Record<string, unknown> | null;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
const fmtDate = (s: string | null) => s ? new Date(s + "T00:00:00").toLocaleDateString("es-ES") : "—";

function hexToRgb01(hex?: string): { r: number; g: number; b: number } {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return { r: 0.54, g: 0.36, b: 0.96 };
  return {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

export async function generateFacturaPDF(input: { empresa: Empresa; factura: Factura }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const c = hexToRgb01(input.empresa.color_primario);
  const accent = rgb(c.r, c.g, c.b);
  const ink = rgb(0.04, 0.02, 0.06);
  const muted = rgb(0.45, 0.45, 0.5);
  const line = rgb(0.85, 0.85, 0.85);

  page.drawRectangle({ x: 0, y: 770, width: 595, height: 72, color: rgb(0.02, 0.01, 0.05) });
  page.drawText("FACTURA", { x: 42, y: 808, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText(input.factura.numero ?? "—", { x: 42, y: 786, size: 12, font: helv, color: rgb(0.7, 0.75, 0.95) });
  page.drawText(input.empresa.nombre.toUpperCase(), { x: 380, y: 808, size: 11, font: bold, color: accent });
  page.drawText(`NIF ${input.empresa.nif ?? "—"}`, { x: 380, y: 790, size: 9, font: helv, color: rgb(0.8, 0.85, 1) });

  let y = 740;
  page.drawText("FACTURAR A", { x: 42, y, size: 8, font: bold, color: muted });
  page.drawText("FECHAS", { x: 380, y, size: 8, font: bold, color: muted });
  y -= 14;
  page.drawText(input.factura.contacto_nombre ?? "—", { x: 42, y, size: 12, font: bold, color: ink });
  page.drawText(`Emisión: ${fmtDate(input.factura.fecha_emision)}`, { x: 380, y, size: 10, font: helv, color: ink });
  y -= 14;
  if (input.factura.contacto_nif) {
    page.drawText(`NIF: ${input.factura.contacto_nif}`, { x: 42, y, size: 10, font: helv, color: muted });
  }
  if (input.factura.fecha_vencimiento) {
    page.drawText(`Vencimiento: ${fmtDate(input.factura.fecha_vencimiento)}`, { x: 380, y, size: 10, font: helv, color: ink });
  }

  // Bloque total destacado
  y -= 70;
  page.drawRectangle({ x: 42, y, width: 511, height: 60, color: rgb(c.r, c.g, c.b, ) });
  page.drawText("IMPORTE A PAGAR", { x: 56, y: y + 38, size: 10, font: bold, color: rgb(1, 1, 1) });
  page.drawText(EUR(input.factura.total), { x: 56, y: y + 12, size: 26, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`Base ${EUR(input.factura.base)} · IVA ${EUR(input.factura.iva)}`, { x: 360, y: y + 36, size: 9, font: helv, color: rgb(0.85, 0.85, 1) });

  // Estado y enlace pago
  y -= 40;
  const estadoCol = input.factura.estado === "cobrada" ? rgb(0.12, 0.48, 0.30) : input.factura.estado === "vencida" ? rgb(0.72, 0.19, 0.11) : muted;
  page.drawText(`Estado: ${input.factura.estado.toUpperCase()}`, { x: 42, y, size: 10, font: bold, color: estadoCol });
  if (input.factura.payment_link_url) {
    page.drawText("💳 Pago online:", { x: 220, y, size: 9, font: bold, color: accent });
    page.drawText(input.factura.payment_link_url.slice(0, 60), { x: 220, y: y - 12, size: 8, font: helv, color: muted });
  }

  // Pie
  y -= 80;
  page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, color: line, thickness: 0.6 });
  y -= 18;
  page.drawText(input.empresa.pie_factura ?? "Gracias por confiar en nosotros.", { x: 42, y, size: 9, font: helv, color: muted });

  page.drawText("Generado con Modelo 26", { x: 42, y: 30, size: 8, font: helv, color: muted });
  return await pdf.save();
}
