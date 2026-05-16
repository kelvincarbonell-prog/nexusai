import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Empresa = { nombre: string; nif?: string; direccion?: string; logo_url?: string; color_primario?: string };
type Linea = { descripcion: string; cantidad: number; precio_unitario: number; descuento_pct: number; iva_pct: number; base: number; iva: number; total: number };
type Presupuesto = {
  numero: string;
  estado: string;
  cliente_nombre: string;
  cliente_nif?: string | null;
  cliente_email?: string | null;
  cliente_direccion?: string | null;
  fecha_emision: string;
  fecha_validez?: string | null;
  base: number;
  iva: number;
  total: number;
  notas?: string | null;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
const fmtDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("es-ES");

function hexToRgb01(hex?: string): { r: number; g: number; b: number } {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return { r: 0.54, g: 0.36, b: 0.96 };
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

export async function generatePresupuestoPDF(input: { empresa: Empresa; presupuesto: Presupuesto; lineas: Linea[] }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const c = hexToRgb01(input.empresa.color_primario);
  const accent = rgb(c.r, c.g, c.b);
  const ink = rgb(0.04, 0.02, 0.06);
  const muted = rgb(0.45, 0.45, 0.5);
  const line = rgb(0.85, 0.85, 0.85);

  // Cabecera
  page.drawRectangle({ x: 0, y: 770, width: 595, height: 72, color: rgb(0.02, 0.01, 0.05) });
  page.drawText("PRESUPUESTO", { x: 42, y: 808, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText(input.presupuesto.numero, { x: 42, y: 788, size: 11, font: helv, color: rgb(0.7, 0.75, 0.95) });
  page.drawText(input.empresa.nombre.toUpperCase(), { x: 380, y: 808, size: 11, font: bold, color: accent });
  page.drawText(`NIF ${input.empresa.nif ?? "—"}`, { x: 380, y: 790, size: 9, font: helv, color: rgb(0.8, 0.85, 1) });

  // Datos
  let y = 740;
  page.drawText("PARA", { x: 42, y, size: 8, font: bold, color: muted });
  page.drawText("FECHAS", { x: 380, y, size: 8, font: bold, color: muted });
  y -= 14;
  page.drawText(input.presupuesto.cliente_nombre, { x: 42, y, size: 12, font: bold, color: ink });
  page.drawText(`Emisión: ${fmtDate(input.presupuesto.fecha_emision)}`, { x: 380, y, size: 10, font: helv, color: ink });
  y -= 14;
  page.drawText(`NIF: ${input.presupuesto.cliente_nif ?? "—"}`, { x: 42, y, size: 10, font: helv, color: muted });
  if (input.presupuesto.fecha_validez) {
    page.drawText(`Válido hasta: ${fmtDate(input.presupuesto.fecha_validez)}`, { x: 380, y, size: 10, font: helv, color: ink });
  }
  if (input.presupuesto.cliente_direccion) {
    y -= 12;
    page.drawText(input.presupuesto.cliente_direccion, { x: 42, y, size: 10, font: helv, color: muted });
  }

  // Líneas
  y -= 30;
  page.drawRectangle({ x: 42, y, width: 511, height: 22, color: accent });
  const headTextColor = rgb(1, 1, 1);
  page.drawText("Concepto", { x: 50, y: y + 7, size: 10, font: bold, color: headTextColor });
  page.drawText("Cantidad", { x: 320, y: y + 7, size: 10, font: bold, color: headTextColor });
  page.drawText("Precio", { x: 390, y: y + 7, size: 10, font: bold, color: headTextColor });
  page.drawText("IVA", { x: 450, y: y + 7, size: 10, font: bold, color: headTextColor });
  page.drawText("Total", { x: 495, y: y + 7, size: 10, font: bold, color: headTextColor });

  y -= 6;
  for (const l of input.lineas) {
    y -= 18;
    page.drawText(l.descripcion.slice(0, 50), { x: 50, y, size: 10, font: helv, color: ink });
    page.drawText(String(l.cantidad), { x: 320, y, size: 10, font: helv, color: ink });
    page.drawText(EUR(l.precio_unitario), { x: 390, y, size: 10, font: helv, color: ink });
    page.drawText(`${l.iva_pct}%`, { x: 450, y, size: 10, font: helv, color: ink });
    page.drawText(EUR(l.total), { x: 495, y, size: 10, font: bold, color: ink });
    page.drawLine({ start: { x: 42, y: y - 5 }, end: { x: 553, y: y - 5 }, color: line, thickness: 0.3 });
  }

  // Totales
  y -= 36;
  page.drawText("Base imponible", { x: 380, y, size: 10, font: helv, color: muted });
  page.drawText(EUR(input.presupuesto.base), { x: 495, y, size: 10, font: helv, color: ink });
  y -= 16;
  page.drawText("IVA", { x: 380, y, size: 10, font: helv, color: muted });
  page.drawText(EUR(input.presupuesto.iva), { x: 495, y, size: 10, font: helv, color: ink });
  y -= 26;
  page.drawRectangle({ x: 380, y: y - 6, width: 173, height: 30, color: rgb(0.94, 0.93, 0.99) });
  page.drawText("TOTAL", { x: 392, y: y + 6, size: 12, font: bold, color: muted });
  page.drawText(EUR(input.presupuesto.total), { x: 495, y: y + 6, size: 14, font: bold, color: accent });

  // Notas + pie
  if (input.presupuesto.notas) {
    y -= 60;
    page.drawText("Notas", { x: 42, y, size: 9, font: bold, color: muted });
    y -= 14;
    page.drawText(input.presupuesto.notas.slice(0, 400), { x: 42, y, size: 9, font: helv, color: ink });
  }

  page.drawText("Generado con Modelo 26", { x: 42, y: 30, size: 8, font: helv, color: muted });
  return await pdf.save();
}
