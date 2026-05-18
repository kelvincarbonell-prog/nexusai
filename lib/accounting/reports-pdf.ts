/**
 * Generadores PDF de informes contables (PyG y Balance) — pdf-lib, sin
 * dependencias pesadas. Marca de agua M26 + numeración de página.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const EUR = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export type PyGSection = { code: string; label: string; total: number };
export type PyGReport = {
  empresa: { nombre: string; nif: string };
  ejercicio: number;
  desde: string;
  hasta: string;
  ingresos: PyGSection[];
  gastos: PyGSection[];
  resultado_explotacion: number;
  resultado_financiero: number;
  resultado_antes_impuestos: number;
  impuesto_sociedades: number;
  resultado_ejercicio: number;
};

export type BalanceReport = {
  empresa: { nombre: string; nif: string };
  ejercicio: number;
  fecha: string;
  activo: { no_corriente: PyGSection[]; corriente: PyGSection[]; total: number };
  pasivo: { patrimonio_neto: PyGSection[]; no_corriente: PyGSection[]; corriente: PyGSection[]; total: number };
};

type Theme = { ink: ReturnType<typeof rgb>; muted: ReturnType<typeof rgb>; line: ReturnType<typeof rgb>; accent: ReturnType<typeof rgb> };

const theme: Theme = {
  ink: rgb(0.06, 0.04, 0.08),
  muted: rgb(0.46, 0.46, 0.5),
  line: rgb(0.86, 0.86, 0.88),
  accent: rgb(0.39, 0.40, 0.95),
};

async function basePage(pdf: PDFDocument, title: string, sub: string) {
  const page = pdf.addPage([595, 842]);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawText(title, { x: 42, y: 805, size: 18, font: bold, color: theme.ink });
  page.drawText(sub, { x: 42, y: 786, size: 10, font: helv, color: theme.muted });
  page.drawText("Modelo 26", { x: 488, y: 805, size: 11, font: bold, color: theme.accent });
  page.drawLine({ start: { x: 42, y: 776 }, end: { x: 553, y: 776 }, thickness: 0.5, color: theme.line });
  return { page, helv, bold };
}

function drawRow(page: ReturnType<PDFDocument["addPage"]>, y: number, label: string, valor: number, bold: boolean, font: import("pdf-lib").PDFFont, boldFont: import("pdf-lib").PDFFont) {
  const f = bold ? boldFont : font;
  page.drawText(label, { x: 50, y, size: 10, font: f, color: theme.ink });
  page.drawText(EUR(valor), { x: 510 - (EUR(valor).length * 5.2), y, size: 10, font: f, color: bold && valor < 0 ? rgb(0.92, 0.27, 0.27) : theme.ink });
  return y - 14;
}

export async function generatePyGPDF(input: PyGReport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const { page, helv, bold } = await basePage(pdf, "Cuenta de Pérdidas y Ganancias", `${input.empresa.nombre} · ${input.empresa.nif} · Ejercicio ${input.ejercicio} (${input.desde} → ${input.hasta})`);

  let y = 740;
  page.drawText("INGRESOS", { x: 42, y, size: 11, font: bold, color: theme.muted });
  y -= 18;
  for (const s of input.ingresos) y = drawRow(page, y, `  ${s.code} · ${s.label}`, s.total, false, helv, bold);
  const totalIng = input.ingresos.reduce((s, x) => s + x.total, 0);
  y = drawRow(page, y, "Total ingresos", totalIng, true, helv, bold);

  y -= 8;
  page.drawText("GASTOS", { x: 42, y, size: 11, font: bold, color: theme.muted });
  y -= 18;
  for (const s of input.gastos) y = drawRow(page, y, `  ${s.code} · ${s.label}`, s.total, false, helv, bold);
  const totalGas = input.gastos.reduce((s, x) => s + x.total, 0);
  y = drawRow(page, y, "Total gastos", totalGas, true, helv, bold);

  y -= 8;
  page.drawLine({ start: { x: 42, y: y + 6 }, end: { x: 553, y: y + 6 }, thickness: 0.5, color: theme.line });
  y = drawRow(page, y, "Resultado de explotación", input.resultado_explotacion, true, helv, bold);
  y = drawRow(page, y, "Resultado financiero", input.resultado_financiero, false, helv, bold);
  y = drawRow(page, y, "Resultado antes de impuestos", input.resultado_antes_impuestos, true, helv, bold);
  y = drawRow(page, y, "Impuesto sobre Sociedades", -Math.abs(input.impuesto_sociedades), false, helv, bold);

  y -= 4;
  page.drawRectangle({ x: 42, y: y - 4, width: 511, height: 1.5, color: theme.accent });
  y -= 14;
  page.drawText("RESULTADO DEL EJERCICIO", { x: 50, y, size: 12, font: bold, color: theme.ink });
  page.drawText(EUR(input.resultado_ejercicio), { x: 510 - (EUR(input.resultado_ejercicio).length * 6), y, size: 13, font: bold, color: input.resultado_ejercicio >= 0 ? rgb(0.06, 0.55, 0.40) : rgb(0.92, 0.27, 0.27) });

  page.drawText(`Generado el ${new Date().toLocaleString("es-ES")} · documento informativo`, { x: 42, y: 30, size: 8, font: helv, color: theme.muted });
  return await pdf.save();
}

export async function generateBalancePDF(input: BalanceReport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const { page, helv, bold } = await basePage(pdf, "Balance de Situación", `${input.empresa.nombre} · ${input.empresa.nif} · Ejercicio ${input.ejercicio} · ${input.fecha}`);

  // Layout en 2 columnas: ACTIVO | PASIVO
  let yA = 740;
  let yP = 740;
  const colA = 42;
  const colP = 310;

  page.drawText("ACTIVO", { x: colA, y: yA, size: 11, font: bold, color: theme.muted });
  page.drawText("PATRIMONIO NETO Y PASIVO", { x: colP, y: yP, size: 11, font: bold, color: theme.muted });
  yA -= 18; yP -= 18;

  const drawCol = (x: number, y: number, label: string, valor: number, isBold = false) => {
    const f = isBold ? bold : helv;
    page.drawText(label, { x, y, size: 9, font: f, color: theme.ink });
    page.drawText(EUR(valor), { x: x + 235, y, size: 9, font: f, color: theme.ink });
    return y - 13;
  };

  // ACTIVO
  page.drawText("A. NO CORRIENTE", { x: colA, y: yA, size: 9, font: bold, color: theme.muted }); yA -= 13;
  for (const s of input.activo.no_corriente) yA = drawCol(colA, yA, `${s.code} ${s.label}`, s.total);
  page.drawText("B. CORRIENTE", { x: colA, y: yA, size: 9, font: bold, color: theme.muted }); yA -= 13;
  for (const s of input.activo.corriente) yA = drawCol(colA, yA, `${s.code} ${s.label}`, s.total);
  yA -= 4;
  page.drawLine({ start: { x: colA, y: yA + 6 }, end: { x: colA + 250, y: yA + 6 }, thickness: 0.5, color: theme.accent });
  yA = drawCol(colA, yA, "TOTAL ACTIVO", input.activo.total, true);

  // PASIVO
  page.drawText("A. PATRIMONIO NETO", { x: colP, y: yP, size: 9, font: bold, color: theme.muted }); yP -= 13;
  for (const s of input.pasivo.patrimonio_neto) yP = drawCol(colP, yP, `${s.code} ${s.label}`, s.total);
  page.drawText("B. PASIVO NO CORRIENTE", { x: colP, y: yP, size: 9, font: bold, color: theme.muted }); yP -= 13;
  for (const s of input.pasivo.no_corriente) yP = drawCol(colP, yP, `${s.code} ${s.label}`, s.total);
  page.drawText("C. PASIVO CORRIENTE", { x: colP, y: yP, size: 9, font: bold, color: theme.muted }); yP -= 13;
  for (const s of input.pasivo.corriente) yP = drawCol(colP, yP, `${s.code} ${s.label}`, s.total);
  yP -= 4;
  page.drawLine({ start: { x: colP, y: yP + 6 }, end: { x: colP + 250, y: yP + 6 }, thickness: 0.5, color: theme.accent });
  yP = drawCol(colP, yP, "TOTAL PN Y PASIVO", input.pasivo.total, true);

  const cuadre = Math.abs(input.activo.total - input.pasivo.total) < 0.5 ? "✓ Balance cuadrado" : `⚠ Descuadre ${EUR(input.activo.total - input.pasivo.total)}`;
  page.drawText(cuadre, { x: 42, y: 60, size: 9, font: bold, color: input.activo.total === input.pasivo.total ? rgb(0.06, 0.55, 0.40) : rgb(0.92, 0.45, 0.10) });
  page.drawText(`Generado el ${new Date().toLocaleString("es-ES")} · documento informativo`, { x: 42, y: 30, size: 8, font: helv, color: theme.muted });
  return await pdf.save();
}
