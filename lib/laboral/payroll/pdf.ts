import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { NominaResult } from "@/lib/laboral/payroll/calc";

export type PayrollPDFInput = {
  empresa: { nombre: string; nif: string; direccion?: string };
  trabajador: { nombre: string; dni?: string; nss?: string; puesto?: string };
  periodo: string; // YYYY-MM
  result: NominaResult;
  generado_en: string;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export async function generatePayrollPDF(input: PayrollPDFInput): Promise<{ bytes: Uint8Array; sha256: string }> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.04, 0.02, 0.06);
  const accent = rgb(0.54, 0.36, 0.96);
  const muted = rgb(0.45, 0.45, 0.5);
  const line = rgb(0.85, 0.85, 0.85);

  // Header band
  page.drawRectangle({ x: 0, y: 770, width: 595, height: 72, color: rgb(0.024, 0.016, 0.05) });
  page.drawText("RECIBO DE SALARIOS", { x: 42, y: 805, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`Periodo · ${input.periodo}`, { x: 42, y: 786, size: 10, font: helv, color: rgb(0.7, 0.75, 0.95) });
  page.drawText("Modelo 26", { x: 470, y: 805, size: 12, font: bold, color: accent });
  page.drawText("tecnología fiscal · firma electrónica", { x: 380, y: 786, size: 8, font: helv, color: rgb(0.7, 0.75, 0.95) });

  let y = 745;
  // Empresa
  page.drawText("Empresa", { x: 42, y, size: 8, font: bold, color: muted });
  page.drawText("Trabajador/a", { x: 320, y, size: 8, font: bold, color: muted });
  y -= 14;
  page.drawText(input.empresa.nombre, { x: 42, y, size: 11, font: bold, color: ink });
  page.drawText(input.trabajador.nombre, { x: 320, y, size: 11, font: bold, color: ink });
  y -= 13;
  page.drawText(`NIF: ${input.empresa.nif}`, { x: 42, y, size: 9, font: helv, color: muted });
  page.drawText(`DNI: ${input.trabajador.dni ?? "-"}`, { x: 320, y, size: 9, font: helv, color: muted });
  y -= 12;
  if (input.empresa.direccion) page.drawText(input.empresa.direccion, { x: 42, y, size: 9, font: helv, color: muted });
  page.drawText(`Nº SS: ${input.trabajador.nss ?? "-"}`, { x: 320, y, size: 9, font: helv, color: muted });
  y -= 12;
  page.drawText(`Puesto: ${input.trabajador.puesto ?? "-"}`, { x: 320, y, size: 9, font: helv, color: muted });

  y -= 24;
  // Tabla
  page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, color: line, thickness: 0.6 });
  y -= 14;
  page.drawText("Concepto", { x: 42, y, size: 9, font: bold, color: muted });
  page.drawText("Devengo", { x: 380, y, size: 9, font: bold, color: muted });
  page.drawText("Deducción", { x: 480, y, size: 9, font: bold, color: muted });
  y -= 8;
  page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, color: line, thickness: 0.6 });

  for (const c of input.result.conceptos) {
    y -= 16;
    page.drawText(c.concepto, { x: 42, y, size: 10, font: helv, color: ink });
    if (c.tipo === "devengo") {
      page.drawText(EUR(c.importe), { x: 380, y, size: 10, font: helv, color: ink });
    } else {
      page.drawText(EUR(Math.abs(c.importe)), { x: 480, y, size: 10, font: helv, color: ink });
    }
  }

  y -= 22;
  page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, color: ink, thickness: 1 });
  y -= 18;
  page.drawText("Total devengos", { x: 42, y, size: 11, font: bold, color: ink });
  page.drawText(EUR(input.result.devengo_bruto), { x: 380, y, size: 11, font: bold, color: ink });
  const yDed = y - 18;
  page.drawText("Total deducciones", { x: 42, y: yDed, size: 11, font: bold, color: ink });
  page.drawText(EUR(input.result.total_deducciones), { x: 480, y: yDed, size: 11, font: bold, color: ink });

  y -= 50;
  page.drawRectangle({ x: 42, y, width: 511, height: 40, color: rgb(0.94, 0.93, 0.99) });
  page.drawText("LÍQUIDO A PERCIBIR", { x: 56, y: y + 22, size: 11, font: bold, color: muted });
  page.drawText(EUR(input.result.liquido), { x: 56, y: y + 8, size: 18, font: bold, color: accent });
  page.drawText(`IRPF ${input.result.irpf_pct_aplicado.toFixed(2)} %`, { x: 420, y: y + 22, size: 9, font: helv, color: muted });
  page.drawText(`SS empresa: ${EUR(input.result.ss_empresa)}`, { x: 420, y: y + 8, size: 9, font: helv, color: muted });

  // Bases de cotización
  y -= 30;
  page.drawText("Base CC", { x: 42, y, size: 9, font: bold, color: muted });
  page.drawText(EUR(input.result.base_cotizacion_cc), { x: 42, y: y - 12, size: 10, font: helv, color: ink });
  page.drawText("Base AT/EP/Formación", { x: 200, y, size: 9, font: bold, color: muted });
  page.drawText(EUR(input.result.base_cotizacion_atyepy), { x: 200, y: y - 12, size: 10, font: helv, color: ink });
  page.drawText("Base IRPF", { x: 400, y, size: 9, font: bold, color: muted });
  page.drawText(EUR(input.result.base_irpf), { x: 400, y: y - 12, size: 10, font: helv, color: ink });

  // Footer
  page.drawText(`Generado por Modelo 26 · ${new Date(input.generado_en).toLocaleString("es-ES")}`, {
    x: 42, y: 36, size: 8, font: helv, color: muted,
  });
  page.drawText("Documento no fiscal hasta su firma y entrega al trabajador.", {
    x: 42, y: 24, size: 8, font: helv, color: muted,
  });

  const bytes = await pdf.save();
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const sha256 = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { bytes, sha256 };
}
