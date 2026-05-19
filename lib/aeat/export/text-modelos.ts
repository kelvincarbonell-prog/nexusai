/**
 * Generadores de fichero AEAT (formato texto posicional) para los modelos
 * trimestrales y anuales más usados. Cada función devuelve el contenido del
 * fichero listo para descargar y subir a la sede AEAT (Renta WEB, Sociedades
 * WEB o las plataformas específicas de cada modelo).
 *
 * NOTA: las especificaciones AEAT cambian año a año. Verifica el último PDF
 * de "Especificación funcional fichero" del modelo antes de presentar oficialmente.
 */

import { cabeceraT1, impNum, impSigned, intNum, nifAeat, padLeft, padRight, type AeatHeader } from "@/lib/aeat/export/common";

/* ==========================================================================
   MODELO 111 — Retenciones e ingresos a cuenta IRPF (trabajadores y profesionales)
   Trimestral
========================================================================== */
export function generateFicheroM111(
  header: AeatHeader,
  casillas: { c01: number; c02: number; c03: number; c04: number; c05: number; c06: number; c28: number; [k: string]: number },
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo: "111" }));

  // Tipo 2: liquidación
  const t2 =
    "2" +
    padRight("111", 3) +
    padLeft(String(header.ejercicio), 4) +
    padRight(header.periodo, 2) +
    nifAeat(header.nif) +
    // Trabajadores (clave A)
    intNum(casillas.c01, 9) +     // nº perceptores
    impNum(casillas.c02) +         // base retenciones
    impNum(casillas.c03) +         // retenciones e ingresos a cuenta
    // Profesionales (clave G)
    intNum(casillas.c04, 9) +
    impNum(casillas.c05) +
    impNum(casillas.c06) +
    // Premios, ganancias, etc. (0 si no aplica)
    intNum(casillas.c07 ?? 0, 9) + impNum(casillas.c08 ?? 0) + impNum(casillas.c09 ?? 0) +
    intNum(casillas.c10 ?? 0, 9) + impNum(casillas.c11 ?? 0) + impNum(casillas.c12 ?? 0) +
    intNum(casillas.c13 ?? 0, 9) + impNum(casillas.c14 ?? 0) + impNum(casillas.c15 ?? 0) +
    // Total
    impNum(casillas.c28);
  lines.push(t2);
  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 115 — Retenciones por alquileres
   Trimestral
========================================================================== */
export function generateFicheroM115(
  header: AeatHeader,
  casillas: { c01: number; c02: number; c03: number; c28: number },
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo: "115" }));
  const t2 =
    "2" +
    padRight("115", 3) +
    padLeft(String(header.ejercicio), 4) +
    padRight(header.periodo, 2) +
    nifAeat(header.nif) +
    intNum(casillas.c01, 9) +     // nº arrendadores
    impNum(casillas.c02) +         // base retenciones
    impNum(casillas.c03) +         // retenciones (19%)
    impNum(casillas.c28);          // total a ingresar
  lines.push(t2);
  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 123 — Retenciones capital mobiliario
   Trimestral
========================================================================== */
export function generateFicheroM123(
  header: AeatHeader,
  casillas: { c01: number; c02: number; c03: number; c28: number },
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo: "123" }));
  const t2 =
    "2" +
    padRight("123", 3) +
    padLeft(String(header.ejercicio), 4) +
    padRight(header.periodo, 2) +
    nifAeat(header.nif) +
    intNum(casillas.c01, 9) +     // nº perceptores
    impNum(casillas.c02) +         // base
    impNum(casillas.c03) +         // retenciones 19%
    impNum(casillas.c28);
  lines.push(t2);
  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 130 — Pago fraccionado IRPF autónomos (estimación directa)
   Trimestral
========================================================================== */
export function generateFicheroM130(
  header: AeatHeader,
  casillas: { c01: number; c02: number; c03: number; c04: number; c05: number; c06: number; c07: number; c12: number; c14: number; c19: number },
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo: "130" }));
  const t2 =
    "2" +
    padRight("130", 3) +
    padLeft(String(header.ejercicio), 4) +
    padRight(header.periodo, 2) +
    nifAeat(header.nif) +
    impNum(casillas.c01) +         // ingresos computables
    impNum(casillas.c02) +         // gastos deducibles
    impSigned(casillas.c03) +      // rendimiento neto (signo)
    impNum(casillas.c04) +         // 20% sobre rendimiento neto
    impNum(casillas.c05) +         // retenciones soportadas
    impNum(casillas.c06) +         // pagos fraccionados anteriores
    impNum(casillas.c07) +         // compensación pérdidas anteriores
    impSigned(casillas.c12) +      // diferencia
    impNum(casillas.c14) +         // deducción art. 110.3
    impSigned(casillas.c19);       // resultado a ingresar/devolver
  lines.push(t2);
  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 349 — Operaciones intracomunitarias
   Trimestral o mensual, con detalle por operador
========================================================================== */
export type Operacion349 = {
  nif_operador: string;       // NIF intracom (con prefijo país, p.ej. "ES12345678X" o "DE123456789")
  nombre_operador: string;
  clave: "E" | "A" | "T" | "S" | "I";  // E entregas, A adquisiciones, T triangulares, S servicios prestados, I servicios recibidos
  base: number;
};

export function generateFicheroM349(
  header: AeatHeader,
  operaciones: Operacion349[],
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo: "349" }));

  for (const op of operaciones) {
    const t2 =
      "2" +
      padRight("349", 3) +
      padLeft(String(header.ejercicio), 4) +
      padRight(header.periodo, 2) +
      nifAeat(header.nif) +
      padRight(op.nif_operador, 17) +
      padRight(op.nombre_operador, 40) +
      op.clave +
      impNum(op.base);
    lines.push(t2);
  }

  // Pie con totales
  const totalBase = operaciones.reduce((s, o) => s + o.base, 0);
  const totales =
    "3" +
    padRight("349", 3) +
    padLeft(String(header.ejercicio), 4) +
    padRight(header.periodo, 2) +
    nifAeat(header.nif) +
    intNum(operaciones.length, 9) +
    impNum(totalBase);
  lines.push(totales);

  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 347 — Operaciones con terceros (>3.005,06 € anuales)
   Anual con detalle por tercero
========================================================================== */
export type Operador347 = {
  nif: string;
  nombre: string;
  clave: "A" | "B" | "C" | "D" | "E" | "F";  // A compras, B ventas, etc.
  importe_anual: number;
  // Importes trimestrales (obligatorio en 347)
  t1: number;
  t2: number;
  t3: number;
  t4: number;
};

export function generateFicheroM347(
  header: AeatHeader,
  operadores: Operador347[],
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo: "347", periodo: "0A" }));

  for (const op of operadores) {
    const t2 =
      "2" +
      padRight("347", 3) +
      padLeft(String(header.ejercicio), 4) +
      "0A" +
      nifAeat(header.nif) +
      nifAeat(op.nif) +
      padRight(op.nombre, 40) +
      op.clave +
      impNum(op.importe_anual) +
      impNum(op.t1) + impNum(op.t2) + impNum(op.t3) + impNum(op.t4);
    lines.push(t2);
  }
  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 390 — Resumen anual IVA
========================================================================== */
export function generateFicheroM390(
  header: AeatHeader,
  casillas: Record<string, number>,
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo: "390", periodo: "0A" }));

  // El 390 tiene muchísimas casillas (>200). Reproducimos un subset clave;
  // el resto se rellena a 0 desde la AEAT al importar.
  const claves = [
    "c01","c02","c03","c04","c05","c06","c07","c08","c09",
    "c28","c29","c30","c31","c32",
    "c95","c97","c98","c99",
    "c662","c663","c664",
  ];
  let casillasBuf = "";
  for (const c of claves) {
    casillasBuf += impNum(casillas[c] ?? 0);
  }
  const t2 =
    "2" +
    padRight("390", 3) +
    padLeft(String(header.ejercicio), 4) +
    "0A" +
    nifAeat(header.nif) +
    casillasBuf;
  lines.push(t2);
  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 180 — Resumen anual alquileres
========================================================================== */
export function generateFicheroM180(
  header: AeatHeader,
  casillas: { c01: number; c02: number; c03: number },
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo: "180", periodo: "0A" }));
  const t2 =
    "2" +
    padRight("180", 3) +
    padLeft(String(header.ejercicio), 4) +
    "0A" +
    nifAeat(header.nif) +
    intNum(casillas.c01, 9) +
    impNum(casillas.c02) +
    impNum(casillas.c03);
  lines.push(t2);
  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 190 — Resumen anual IRPF
========================================================================== */
export function generateFicheroM190(
  header: AeatHeader,
  casillas: { c01: number; c03: number; c04: number; c06: number; total_perceptores: number; total_retenciones: number },
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo: "190", periodo: "0A" }));
  const t2 =
    "2" +
    padRight("190", 3) +
    padLeft(String(header.ejercicio), 4) +
    "0A" +
    nifAeat(header.nif) +
    intNum(casillas.c01, 9) + impNum(casillas.c03) +   // clave A
    intNum(casillas.c04, 9) + impNum(casillas.c06) +   // clave G
    intNum(casillas.total_perceptores, 9) +
    impNum(casillas.total_retenciones);
  lines.push(t2);
  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 193 — Resumen anual capital mobiliario
========================================================================== */
export function generateFicheroM193(
  header: AeatHeader,
  casillas: { num_perceptores: number; total_base: number; total_retenciones: number },
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo: "193", periodo: "0A" }));
  const t2 =
    "2" +
    padRight("193", 3) +
    padLeft(String(header.ejercicio), 4) +
    "0A" +
    nifAeat(header.nif) +
    intNum(casillas.num_perceptores, 9) +
    impNum(casillas.total_base) +
    impNum(casillas.total_retenciones);
  lines.push(t2);
  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 200 — Impuesto sobre Sociedades
   Estructura simplificada. La presentación real va por Sociedades WEB.
========================================================================== */
export function generateFicheroM200(
  header: AeatHeader,
  casillas: Record<string, number>,
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo: "200", periodo: "0A" }));

  // Subset clave 200
  const claves = [
    "c500", "c501", "c502", "c503",     // resultado contable
    "c511", "c513", "c515", "c517",     // ajustes
    "c550", "c552",                       // bin
    "c560", "c562",                       // BI
    "c570", "c592",                       // cuota
    "c595", "c598", "c599",               // retenciones, pagos, resultado
  ];
  let buf = "";
  for (const c of claves) buf += impSigned(casillas[c] ?? 0);
  const t2 =
    "2" +
    padRight("200", 3) +
    padLeft(String(header.ejercicio), 4) +
    "0A" +
    nifAeat(header.nif) +
    buf;
  lines.push(t2);
  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 202 — Pago fraccionado IS
========================================================================== */
export function generateFicheroM202(
  header: AeatHeader,
  casillas: { c01: number; c03: number; c04: number; c10: number; c12: number; c14: number },
): string {
  const lines: string[] = [];
  // El 202 usa periodos 1P/2P/3P en lugar de 1T/2T/3T
  const periodoMap: Record<string, string> = { "1T": "1P", "2T": "2P", "4T": "3P" };
  const periodo202 = periodoMap[header.periodo] ?? header.periodo;
  lines.push(cabeceraT1({ ...header, modelo: "202", periodo: periodo202 }));
  const t2 =
    "2" +
    padRight("202", 3) +
    padLeft(String(header.ejercicio), 4) +
    padRight(periodo202, 2) +
    nifAeat(header.nif) +
    impNum(casillas.c01) +
    intNum(casillas.c03, 4) +
    impNum(casillas.c04) +
    impNum(casillas.c10) +
    impNum(casillas.c12) +
    impSigned(casillas.c14);
  lines.push(t2);
  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 309 — IVA no periódico
========================================================================== */
export function generateFicheroM309(
  header: AeatHeader,
  casillas: { c01: number; c02: number; c03: number; c04: number; c05: number },
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo: "309" }));
  const t2 =
    "2" +
    padRight("309", 3) +
    padLeft(String(header.ejercicio), 4) +
    padRight(header.periodo, 2) +
    nifAeat(header.nif) +
    impNum(casillas.c01) +
    intNum(casillas.c02, 4) +
    impNum(casillas.c03) +
    impNum(casillas.c04) +
    impSigned(casillas.c05);
  lines.push(t2);
  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 210 — No residentes
========================================================================== */
export function generateFicheroM210(
  header: AeatHeader,
  casillas: { c01: number; c02: number; c03: number; c04: number; c05: number; c06: number; c07: number },
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo: "210" }));
  const t2 =
    "2" +
    padRight("210", 3) +
    padLeft(String(header.ejercicio), 4) +
    padRight(header.periodo, 2) +
    nifAeat(header.nif) +
    impNum(casillas.c01) +
    impNum(casillas.c02) +
    impNum(casillas.c03) +
    intNum(casillas.c04, 4) +
    impNum(casillas.c05) +
    impNum(casillas.c06) +
    impSigned(casillas.c07);
  lines.push(t2);
  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 296 — Resumen anual no residentes
========================================================================== */
export function generateFicheroM296(
  header: AeatHeader,
  casillas: { num_perceptores: number; total_base: number; total_retenciones: number },
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo: "296", periodo: "0A" }));
  const t2 =
    "2" +
    padRight("296", 3) +
    padLeft(String(header.ejercicio), 4) +
    "0A" +
    nifAeat(header.nif) +
    intNum(casillas.num_perceptores, 9) +
    impNum(casillas.total_base) +
    impNum(casillas.total_retenciones);
  lines.push(t2);
  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 232 — Operaciones vinculadas / paraísos fiscales
========================================================================== */
export function generateFicheroM232(
  header: AeatHeader,
  casillas: { total_vinculados: number; importe_vinculados: number; total_paraisos: number; importe_paraisos: number },
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo: "232", periodo: "0A" }));
  const t2 =
    "2" +
    padRight("232", 3) +
    padLeft(String(header.ejercicio), 4) +
    "0A" +
    nifAeat(header.nif) +
    intNum(casillas.total_vinculados, 9) +
    impNum(casillas.importe_vinculados) +
    intNum(casillas.total_paraisos, 9) +
    impNum(casillas.importe_paraisos);
  lines.push(t2);
  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 720 — Bienes en el extranjero
========================================================================== */
export function generateFicheroM720(
  header: AeatHeader,
  casillas: { cuentas_num: number; cuentas_valor: number; valores_num: number; valores_valor: number; inmuebles_num: number; inmuebles_valor: number },
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo: "720", periodo: "0A" }));
  const t2 =
    "2" +
    padRight("720", 3) +
    padLeft(String(header.ejercicio), 4) +
    "0A" +
    nifAeat(header.nif) +
    intNum(casillas.cuentas_num, 9) + impNum(casillas.cuentas_valor) +
    intNum(casillas.valores_num, 9) + impNum(casillas.valores_valor) +
    intNum(casillas.inmuebles_num, 9) + impNum(casillas.inmuebles_valor);
  lines.push(t2);
  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 184 — Atribución de rentas
========================================================================== */
export function generateFicheroM184(
  header: AeatHeader,
  casillas: { total_ingresos: number; total_gastos: number; rendimiento_neto: number; num_comuneros: number },
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo: "184", periodo: "0A" }));
  const t2 =
    "2" +
    padRight("184", 3) +
    padLeft(String(header.ejercicio), 4) +
    "0A" +
    nifAeat(header.nif) +
    impNum(casillas.total_ingresos) +
    impNum(casillas.total_gastos) +
    impSigned(casillas.rendimiento_neto) +
    intNum(casillas.num_comuneros, 9);
  lines.push(t2);
  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 100 — IRPF anual
========================================================================== */
export function generateFicheroM100(
  header: AeatHeader,
  casillas: Record<string, number>,
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo: "100", periodo: "0A" }));
  const claves = ["c0500", "c0220", "c0085", "c0030", "c0400", "c0510", "c0455", "c0545", "c0625", "c0670"];
  let buf = "";
  for (const c of claves) buf += impSigned(casillas[c] ?? 0);
  const t2 =
    "2" +
    padRight("100", 3) +
    padLeft(String(header.ejercicio), 4) +
    "0A" +
    nifAeat(header.nif) +
    buf;
  lines.push(t2);
  return lines.join("\r\n") + "\r\n";
}

/* ==========================================================================
   MODELO 036 / 037 — Declaración Censal
   No es un fichero de importe; es un formulario de datos maestros.
   El AEAT pide un PDF firmado en su sede, pero para portabilidad
   exportamos un .txt estructurado con todas las claves.
========================================================================== */
function declCensal(
  header: AeatHeader,
  modelo: "036" | "037",
  c: { causa: string; fecha_efectos: string; nif: string; nombre: string; regimen_iva: string; regimen_irpf: string; num_iaes: number; num_locales: number; alta_roi: boolean; obligado_retener: boolean },
  resumen: Record<string, unknown>,
): string {
  const lines: string[] = [];
  lines.push(cabeceraT1({ ...header, modelo, periodo: "0A" }));
  const t2 =
    "2" +
    padRight(modelo, 3) +
    padLeft(String(header.ejercicio), 4) +
    "0A" +
    nifAeat(c.nif) +
    padRight((c.nombre ?? "").toUpperCase(), 80) +
    padRight(c.causa, 12) +
    padRight(c.fecha_efectos.replace(/-/g, ""), 8) +
    padRight(c.regimen_iva, 24) +
    padRight(c.regimen_irpf, 32) +
    intNum(c.num_iaes, 3) +
    intNum(c.num_locales, 3) +
    (c.alta_roi ? "S" : "N") +
    (c.obligado_retener ? "S" : "N");
  lines.push(t2);

  // T3: IAEs (epígrafes)
  const iaes = (resumen.iaes ?? []) as Array<{ epigrafe: string; descripcion?: string; fecha_inicio?: string; principal?: boolean }>;
  for (const iae of iaes) {
    lines.push(
      "3" +
      padRight(modelo, 3) +
      padRight(iae.epigrafe ?? "", 6) +
      padRight((iae.descripcion ?? "").toUpperCase(), 60) +
      padRight((iae.fecha_inicio ?? "").replace(/-/g, ""), 8) +
      (iae.principal ? "S" : "N")
    );
  }

  // T4: Locales afectos
  const locales = (resumen.locales ?? []) as Array<{ direccion: string; superficie_m2?: number; uso?: string }>;
  for (const loc of locales) {
    lines.push(
      "4" +
      padRight(modelo, 3) +
      padRight((loc.direccion ?? "").toUpperCase(), 80) +
      intNum(Math.round(loc.superficie_m2 ?? 0), 6) +
      padRight(loc.uso ?? "principal", 12)
    );
  }

  return lines.join("\r\n") + "\r\n";
}

export function generateFicheroM036(
  header: AeatHeader,
  casillas: { causa: string; fecha_efectos: string; nif: string; nombre: string; regimen_iva: string; regimen_irpf: string; num_iaes: number; num_locales: number; alta_roi: boolean; obligado_retener: boolean },
  resumen: Record<string, unknown>,
): string {
  return declCensal(header, "036", casillas, resumen);
}

export function generateFicheroM037(
  header: AeatHeader,
  casillas: { causa: string; fecha_efectos: string; nif: string; nombre: string; regimen_iva: string; regimen_irpf: string; num_iaes: number; num_locales: number; alta_roi: boolean; obligado_retener: boolean },
  resumen: Record<string, unknown>,
): string {
  return declCensal(header, "037", casillas, resumen);
}
