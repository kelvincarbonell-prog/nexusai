import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/**
 * Modelo 145 — Comunicación de datos del perceptor al pagador.
 * El trabajador rellena este formulario para que la empresa calcule
 * correctamente la retención del IRPF. Tipo aplicable según LIRPF.
 */

export type Modelo145Input = {
  empresa: { nombre: string; nif: string };
  trabajador: {
    nombre: string;
    apellidos: string;
    dni: string;
    fecha_nacimiento?: string;
    nss?: string;
    direccion?: string;
    estado_civil?: "soltero" | "casado" | "viudo" | "separado" | "divorciado";
    discapacidad_pct?: number;
    pension_compensatoria?: number;
    anualidades_hijos?: number;
  };
  conyuge?: { nombre: string; dni: string; rendimientos_anuales?: number };
  hijos?: Array<{ nombre: string; fecha_nacimiento: string; discapacidad_pct?: number; vinculacion?: "comun" | "exclusiva" }>;
  ascendientes?: Array<{ nombre: string; fecha_nacimiento: string; rendimientos_anuales?: number; discapacidad_pct?: number }>;
  movilidad_geografica?: boolean;
  hipoteca_vivienda?: boolean;
};

export async function generateModelo145PDF(input: Modelo145Input): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.04, 0.02, 0.06);
  const accent = rgb(0.54, 0.36, 0.96);
  const muted = rgb(0.45, 0.45, 0.5);
  const line = rgb(0.85, 0.85, 0.85);

  // Cabecera
  page.drawRectangle({ x: 0, y: 770, width: 595, height: 72, color: rgb(0.024, 0.016, 0.05) });
  page.drawText("MODELO 145", { x: 42, y: 805, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Comunicación de datos del perceptor al pagador", { x: 42, y: 786, size: 10, font: helv, color: rgb(0.7, 0.75, 0.95) });
  page.drawText("Modelo 26", { x: 470, y: 805, size: 12, font: bold, color: accent });

  let y = 750;
  // Empresa
  page.drawText("PAGADOR (EMPRESA)", { x: 42, y, size: 9, font: bold, color: muted });
  y -= 14;
  page.drawText(input.empresa.nombre, { x: 42, y, size: 11, font: bold, color: ink });
  page.drawText(`NIF: ${input.empresa.nif}`, { x: 320, y, size: 10, font: helv, color: muted });

  y -= 24;
  page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, color: line, thickness: 0.6 });
  y -= 14;
  page.drawText("DATOS DEL TRABAJADOR", { x: 42, y, size: 9, font: bold, color: muted });

  const t = input.trabajador;
  const field = (label: string, value: string | undefined, x: number, yy: number) => {
    page.drawText(label, { x, y: yy, size: 8, font: bold, color: muted });
    page.drawText(value || "—", { x, y: yy - 11, size: 10, font: helv, color: ink });
  };

  y -= 18;
  field("Nombre", t.nombre, 42, y);
  field("Apellidos", t.apellidos, 220, y);
  field("DNI / NIE", t.dni, 420, y);
  y -= 30;
  field("Fecha nacimiento", t.fecha_nacimiento, 42, y);
  field("Nº SS", t.nss, 220, y);
  field("Estado civil", t.estado_civil, 420, y);
  y -= 30;
  field("Dirección", t.direccion, 42, y);
  field("Discapacidad %", t.discapacidad_pct ? `${t.discapacidad_pct} %` : "—", 420, y);

  // Cónyuge
  if (input.conyuge) {
    y -= 30;
    page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, color: line, thickness: 0.6 });
    y -= 14;
    page.drawText("CÓNYUGE", { x: 42, y, size: 9, font: bold, color: muted });
    y -= 18;
    field("Nombre", input.conyuge.nombre, 42, y);
    field("DNI", input.conyuge.dni, 320, y);
    y -= 30;
    field("Rendimientos anuales", input.conyuge.rendimientos_anuales != null ? `${input.conyuge.rendimientos_anuales} €` : "—", 42, y);
  }

  // Hijos
  if (input.hijos && input.hijos.length > 0) {
    y -= 30;
    page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, color: line, thickness: 0.6 });
    y -= 14;
    page.drawText(`HIJOS Y DESCENDIENTES (${input.hijos.length})`, { x: 42, y, size: 9, font: bold, color: muted });
    for (const h of input.hijos.slice(0, 5)) {
      y -= 18;
      page.drawText(`· ${h.nombre} · nac. ${h.fecha_nacimiento}${h.discapacidad_pct ? ` · disc. ${h.discapacidad_pct}%` : ""}${h.vinculacion === "exclusiva" ? " · vínculo exclusivo" : ""}`, {
        x: 42, y, size: 10, font: helv, color: ink,
      });
    }
  }

  // Otras circunstancias
  y -= 30;
  page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, color: line, thickness: 0.6 });
  y -= 14;
  page.drawText("OTRAS CIRCUNSTANCIAS", { x: 42, y, size: 9, font: bold, color: muted });
  y -= 18;
  page.drawText(`Movilidad geográfica: ${input.movilidad_geografica ? "SÍ" : "NO"}`, { x: 42, y, size: 10, font: helv, color: ink });
  page.drawText(`Hipoteca vivienda habitual: ${input.hipoteca_vivienda ? "SÍ" : "NO"}`, { x: 320, y, size: 10, font: helv, color: ink });
  if (t.pension_compensatoria) {
    y -= 16;
    page.drawText(`Pensión compensatoria a ex-cónyuge: ${t.pension_compensatoria} €/año`, { x: 42, y, size: 10, font: helv, color: ink });
  }
  if (t.anualidades_hijos) {
    y -= 16;
    page.drawText(`Anualidades por alimentos a hijos: ${t.anualidades_hijos} €/año`, { x: 42, y, size: 10, font: helv, color: ink });
  }

  // Firma
  y -= 60;
  page.drawText("Declaración del perceptor:", { x: 42, y, size: 9, font: bold, color: muted });
  y -= 14;
  page.drawText("Manifiesto que los datos arriba expuestos son ciertos y me comprometo a comunicar cualquier", { x: 42, y, size: 9, font: helv, color: ink });
  page.drawText("variación en mi situación personal o familiar que afecte a la retención.", { x: 42, y: y - 11, size: 9, font: helv, color: ink });

  y -= 50;
  page.drawRectangle({ x: 42, y, width: 220, height: 60, borderColor: line, borderWidth: 0.6 });
  page.drawText("Firma del trabajador", { x: 52, y: y + 70, size: 8, font: helv, color: muted });
  page.drawRectangle({ x: 333, y, width: 220, height: 60, borderColor: line, borderWidth: 0.6 });
  page.drawText("Recibí · empresa", { x: 343, y: y + 70, size: 8, font: helv, color: muted });

  page.drawText(`Modelo 26 · ${new Date().toLocaleDateString("es-ES")}`, { x: 42, y: 30, size: 8, font: helv, color: muted });

  return await pdf.save();
}
