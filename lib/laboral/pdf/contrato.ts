import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Plantilla genérica de contrato laboral.
 * Modalidades soportadas: indefinido, temporal, prácticas, formación,
 * fijo-discontinuo, obra y servicio.
 */

export type ContratoModalidad =
  | "indefinido"
  | "temporal"
  | "practicas"
  | "formacion"
  | "fijo_discontinuo"
  | "obra_servicio";

export type ContratoInput = {
  modalidad: ContratoModalidad;
  empresa: { nombre: string; nif: string; direccion?: string; cif_representante?: string; nombre_representante?: string };
  trabajador: { nombre: string; dni: string; nss?: string; fecha_nacimiento?: string; direccion?: string; nacionalidad?: string };
  puesto: string;
  categoria_profesional?: string;
  convenio?: string;
  fecha_inicio: string;
  fecha_fin?: string;
  jornada_horas: number;
  jornada_tipo?: "completa" | "parcial";
  salario_bruto_anual: number;
  pagas_anuales?: 12 | 14;
  centro_trabajo?: string;
  causa_temporalidad?: string;       // requerida en temporal/obra
};

const TITULOS: Record<ContratoModalidad, string> = {
  indefinido: "CONTRATO DE TRABAJO INDEFINIDO",
  temporal: "CONTRATO DE TRABAJO TEMPORAL POR CIRCUNSTANCIAS DE LA PRODUCCIÓN",
  practicas: "CONTRATO FORMATIVO PARA LA OBTENCIÓN DE PRÁCTICA PROFESIONAL",
  formacion: "CONTRATO DE FORMACIÓN EN ALTERNANCIA",
  fijo_discontinuo: "CONTRATO INDEFINIDO FIJO-DISCONTINUO",
  obra_servicio: "CONTRATO POR SUSTITUCIÓN DE PERSONA TRABAJADORA",
};

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export async function generateContratoPDF(input: ContratoInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.04, 0.02, 0.06);
  const accent = rgb(0.54, 0.36, 0.96);
  const muted = rgb(0.45, 0.45, 0.5);

  page.drawRectangle({ x: 0, y: 800, width: 595, height: 42, color: rgb(0.024, 0.016, 0.05) });
  page.drawText(TITULOS[input.modalidad], { x: 42, y: 814, size: 11, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Modelo 26", { x: 500, y: 814, size: 10, font: bold, color: accent });

  let y = 770;
  page.drawText(`En ${input.centro_trabajo ?? "Madrid"}, a ${new Date(input.fecha_inicio + "T00:00:00").toLocaleDateString("es-ES")}`, {
    x: 42, y, size: 10, font: helv, color: ink,
  });

  y -= 24;
  page.drawText("REUNIDOS", { x: 42, y, size: 11, font: bold, color: accent });
  y -= 16;
  const empresaTexto = `De una parte, ${input.empresa.nombre}, con NIF ${input.empresa.nif}${input.empresa.direccion ? `, con domicilio en ${input.empresa.direccion}` : ""}${input.empresa.nombre_representante ? `, representada por ${input.empresa.nombre_representante}` : ""}, en adelante "LA EMPRESA".`;
  drawWrapped(page, empresaTexto, 42, y, 511, helv, 9, ink);
  y -= 36;
  const trabTexto = `De otra parte, ${input.trabajador.nombre}, mayor de edad, con DNI/NIE ${input.trabajador.dni}${input.trabajador.direccion ? `, con domicilio en ${input.trabajador.direccion}` : ""}${input.trabajador.nss ? `, número de Seguridad Social ${input.trabajador.nss}` : ""}, en adelante "EL/LA TRABAJADOR/A".`;
  drawWrapped(page, trabTexto, 42, y, 511, helv, 9, ink);

  y -= 36;
  page.drawText("ACUERDAN", { x: 42, y, size: 11, font: bold, color: accent });

  y -= 18;
  const clausulas: string[] = [
    `PRIMERO. — Objeto. El/La TRABAJADOR/A prestará sus servicios como ${input.puesto}${input.categoria_profesional ? `, categoría profesional ${input.categoria_profesional}` : ""} para LA EMPRESA bajo régimen laboral común.`,
    `SEGUNDO. — Duración. El contrato se concierta en modalidad ${input.modalidad.replace("_", " ")}, con fecha de inicio ${input.fecha_inicio}${input.fecha_fin ? ` y fecha de finalización prevista ${input.fecha_fin}` : ", de duración indefinida"}.${input.causa_temporalidad ? ` Causa: ${input.causa_temporalidad}.` : ""}`,
    `TERCERO. — Jornada. ${input.jornada_tipo === "parcial" ? "Jornada a tiempo parcial" : "Jornada completa"} de ${input.jornada_horas} horas semanales.`,
    `CUARTO. — Retribución. Salario bruto anual de ${EUR(input.salario_bruto_anual)}, distribuido en ${input.pagas_anuales ?? 12} pagas. Incluye los conceptos legales aplicables según convenio${input.convenio ? ` (${input.convenio})` : ""}.`,
    `QUINTO. — Período de prueba. Se establece un período de prueba conforme al artículo 14 del Estatuto de los Trabajadores y al convenio colectivo aplicable.`,
    `SEXTO. — Confidencialidad. El/La TRABAJADOR/A se compromete a guardar secreto profesional sobre toda información a la que tenga acceso durante la prestación de sus servicios.`,
    `SÉPTIMO. — Legislación aplicable. En todo lo no previsto se estará a lo dispuesto en el Estatuto de los Trabajadores, el convenio colectivo aplicable y demás normativa laboral vigente.`,
  ];

  for (const c of clausulas) {
    drawWrapped(page, c, 42, y, 511, helv, 9, ink);
    y -= linesNeeded(c, 511, 9) * 11 + 6;
    if (y < 130) break;
  }

  // Firmas
  y = Math.min(y, 130);
  page.drawText("Y para que conste, firman el presente contrato por duplicado:", { x: 42, y, size: 9, font: helv, color: muted });
  y -= 60;
  page.drawLine({ start: { x: 60, y }, end: { x: 240, y }, color: muted, thickness: 0.6 });
  page.drawLine({ start: { x: 360, y }, end: { x: 540, y }, color: muted, thickness: 0.6 });
  page.drawText("LA EMPRESA", { x: 105, y: y - 14, size: 9, font: bold, color: ink });
  page.drawText("EL/LA TRABAJADOR/A", { x: 395, y: y - 14, size: 9, font: bold, color: ink });

  page.drawText(`Modelo 26 · generado ${new Date().toLocaleDateString("es-ES")}`, { x: 42, y: 30, size: 8, font: helv, color: muted });

  return await pdf.save();
}

function linesNeeded(text: string, width: number, fontSize: number): number {
  // Aproximación grosera: ~0.5 * fontSize por carácter
  const charsPerLine = Math.floor(width / (fontSize * 0.5));
  return Math.ceil(text.length / charsPerLine);
}

function drawWrapped(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size: number,
  color: ReturnType<typeof rgb>,
) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      page.drawText(line, { x, y: yy, size, font, color });
      yy -= size + 2;
      line = w;
    } else {
      line = test;
    }
  }
  if (line) page.drawText(line, { x, y: yy, size, font, color });
}
