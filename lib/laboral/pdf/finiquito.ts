import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { FiniquitoResult } from "@/lib/laboral/payroll/finiquito";

export type FiniquitoPDFInput = {
  empresa: { nombre: string; nif: string; direccion?: string };
  trabajador: { nombre: string; dni: string; nss?: string; puesto?: string; fecha_alta: string };
  fecha_baja: string;
  causa: string;
  result: FiniquitoResult;
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export async function generateFiniquitoPDF(input: FiniquitoPDFInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.04, 0.02, 0.06);
  const accent = rgb(0.54, 0.36, 0.96);
  const muted = rgb(0.45, 0.45, 0.5);
  const line = rgb(0.85, 0.85, 0.85);

  page.drawRectangle({ x: 0, y: 790, width: 595, height: 52, color: rgb(0.024, 0.016, 0.05) });
  page.drawText("FINIQUITO Y RECIBÍ", { x: 42, y: 815, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText(`Causa: ${input.causa.replace("_", " ")}`, { x: 42, y: 797, size: 10, font: helv, color: rgb(0.7, 0.75, 0.95) });
  page.drawText("Modelo 26", { x: 500, y: 815, size: 12, font: bold, color: accent });

  let y = 760;
  page.drawText("EMPRESA", { x: 42, y, size: 8, font: bold, color: muted });
  page.drawText("TRABAJADOR/A", { x: 320, y, size: 8, font: bold, color: muted });
  y -= 14;
  page.drawText(input.empresa.nombre, { x: 42, y, size: 12, font: bold, color: ink });
  page.drawText(input.trabajador.nombre, { x: 320, y, size: 12, font: bold, color: ink });
  y -= 14;
  page.drawText(`NIF: ${input.empresa.nif}`, { x: 42, y, size: 10, font: helv, color: muted });
  page.drawText(`DNI: ${input.trabajador.dni}`, { x: 320, y, size: 10, font: helv, color: muted });
  y -= 12;
  page.drawText(`Fecha alta: ${input.trabajador.fecha_alta}`, { x: 320, y, size: 10, font: helv, color: muted });
  y -= 12;
  page.drawText(`Fecha baja: ${input.fecha_baja}`, { x: 320, y, size: 10, font: helv, color: muted });

  // Desglose
  y -= 30;
  page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, color: line, thickness: 0.6 });
  y -= 14;
  page.drawText("CONCEPTOS LIQUIDADOS", { x: 42, y, size: 9, font: bold, color: muted });
  y -= 6;
  page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, color: line, thickness: 0.3 });

  for (const c of input.result.desglose) {
    y -= 16;
    page.drawText(c.concepto.slice(0, 65), { x: 42, y, size: 10, font: helv, color: ink });
    page.drawText(EUR(c.importe), { x: 490, y, size: 10, font: bold, color: ink });
    if (!c.sujeto_irpf) {
      page.drawText("(exento)", { x: 400, y, size: 8, font: helv, color: muted });
    }
  }

  // Totales
  y -= 24;
  page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, color: ink, thickness: 1 });
  y -= 18;
  page.drawText("Total devengado bruto", { x: 42, y, size: 11, font: bold, color: ink });
  page.drawText(EUR(input.result.total_bruto), { x: 480, y, size: 11, font: bold, color: ink });
  y -= 16;
  page.drawText(`IRPF retenido (sobre ${EUR(input.result.base_irpf)})`, { x: 42, y, size: 10, font: helv, color: muted });
  page.drawText(`− ${EUR(input.result.irpf_retenido)}`, { x: 480, y, size: 10, font: helv, color: muted });

  y -= 30;
  page.drawRectangle({ x: 42, y, width: 511, height: 40, color: rgb(0.94, 0.93, 0.99) });
  page.drawText("LÍQUIDO A PERCIBIR", { x: 56, y: y + 22, size: 11, font: bold, color: muted });
  page.drawText(EUR(input.result.total_neto), { x: 56, y: y + 8, size: 18, font: bold, color: accent });

  // Recibí
  y -= 60;
  page.drawText("RECIBÍ Y SALDO", { x: 42, y, size: 10, font: bold, color: muted });
  y -= 14;
  page.drawText(
    `Recibo de la empresa la cantidad de ${EUR(input.result.total_neto)} en concepto de liquidación final por la `,
    { x: 42, y, size: 9, font: helv, color: ink },
  );
  page.drawText(
    `extinción del contrato. Considero saldada y finiquitada toda relación laboral con esta empresa.`,
    { x: 42, y: y - 12, size: 9, font: helv, color: ink },
  );

  y -= 60;
  page.drawRectangle({ x: 42, y, width: 220, height: 60, borderColor: line, borderWidth: 0.6 });
  page.drawText("Firma del trabajador/a", { x: 52, y: y + 70, size: 8, font: helv, color: muted });
  page.drawRectangle({ x: 333, y, width: 220, height: 60, borderColor: line, borderWidth: 0.6 });
  page.drawText("Firma y sello empresa", { x: 343, y: y + 70, size: 8, font: helv, color: muted });

  page.drawText(`Generado por Modelo 26 · ${new Date().toLocaleDateString("es-ES")}`, { x: 42, y: 30, size: 8, font: helv, color: muted });
  return await pdf.save();
}
