/**
 * Generador del fichero FAN (Fichero de Afiliación) para SILTRA / Sistema RED.
 *
 * Especificación TGSS resumida (longitudes posicionales):
 *   - Registros DAT prefijados con código tipo + relleno a longitud fija.
 *   - Importes 11 enteros + 2 decimales sin separador, padding ceros.
 *   - Fechas DDMMAAAA.
 *
 * IMPORTANTE: la TGSS publica el manual de comunicaciones; este módulo
 * implementa la estructura básica usada por la mayoría de empresas
 * (alta/baja/cotización mensual). Para casuísticas especiales (pluriempleo,
 * contratos formativos, etc.) hay campos adicionales que pueden tener que
 * personalizarse en producción.
 */

export type TipoMovimientoFAN = "AT" | "BT" | "CT"; // alta, baja, cambio
export type TipoFicheroFAN = "AFI" | "CRA" | "FAN_COTIZ";

export type EmpresaFAN = {
  ccc: string;                 // Código Cuenta Cotización (15 dígitos con régimen)
  nif: string;
  razon_social: string;
};

export type TrabajadorFAN = {
  naf: string;                 // Nº Afiliación SS (12 dígitos)
  dni: string;
  nombre: string;
  apellidos: string;
  fecha_nacimiento: string;    // YYYY-MM-DD
  sexo: "1" | "6";             // 1 hombre, 6 mujer (códigos TGSS)
  fecha_alta?: string;         // YYYY-MM-DD
  fecha_baja?: string;         // YYYY-MM-DD
  grupo_cotizacion?: number;   // 1..11
  tipo_contrato?: string;      // código TGSS (100, 200, 401, ...)
  base_cotizacion_cc: number;  // mensual
  base_cotizacion_atyepy: number;
  base_irpf: number;
  irpf_retenido: number;
  ss_trabajador: number;
  ss_empresa: number;
  liquido: number;
};

export type FanInput = {
  empresa: EmpresaFAN;
  periodo: { ejercicio: number; mes: number }; // mes 1..12
  tipo: TipoFicheroFAN;
  trabajadores: TrabajadorFAN[];
};

function pad(s: string | number, len: number, fill = " ", right = true): string {
  const v = String(s ?? "");
  if (right) return v.slice(0, len).padEnd(len, fill);
  return v.slice(-len).padStart(len, fill);
}
function padN(v: number | undefined | null, len: number): string {
  const n = Math.max(0, Math.round(Number(v ?? 0) * 100));
  return String(n).padStart(len, "0");
}
function fechaDDMMAAAA(iso?: string | null): string {
  if (!iso) return "        ";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "        ";
  return `${d}${m}${y}`;
}
function periodoAAAAMM(p: { ejercicio: number; mes: number }): string {
  return `${p.ejercicio}${String(p.mes).padStart(2, "0")}`;
}

/**
 * Registro DAT — datos comunes empresa + trabajador en cotización mensual.
 * Estructura simplificada:
 *   pos  1..2   tipo "DAT"
 *   pos  4..18  CCC (15)
 *   pos 19..30  NAF (12)
 *   pos 31..40  DNI (10)
 *   pos 41..80  Apellidos + nombre (40)
 *   pos 81..86  AAAAMM periodo (6)
 *   pos 87..94  fecha alta DDMMAAAA (8)
 *   pos 95..102 fecha baja DDMMAAAA (8)
 *   pos103..105 grupo cotización (3)
 *   pos106..108 tipo contrato (3)
 *   pos109..121 base CC (13)
 *   pos122..134 base AT/EP (13)
 *   pos135..147 base IRPF (13)
 *   pos148..160 IRPF retenido (13)
 *   pos161..173 SS trabajador (13)
 *   pos174..186 SS empresa (13)
 *   pos187..199 líquido (13)
 *   pos200      tipo movimiento (1)
 */
function registroDAT(empresa: EmpresaFAN, t: TrabajadorFAN, periodo: { ejercicio: number; mes: number }): string {
  const nombreCompleto = `${t.apellidos} ${t.nombre}`.trim().toUpperCase();
  const tipoMov: string = t.fecha_baja ? "B" : t.fecha_alta ? "A" : "C";
  return (
    pad("DAT", 3, " ") +
    pad(empresa.ccc, 15, "0", false) +
    pad(t.naf, 12, "0", false) +
    pad((t.dni ?? "").toUpperCase(), 10, " ") +
    pad(nombreCompleto, 40, " ") +
    periodoAAAAMM(periodo) +
    fechaDDMMAAAA(t.fecha_alta) +
    fechaDDMMAAAA(t.fecha_baja) +
    pad(String(t.grupo_cotizacion ?? 0), 3, "0", false) +
    pad(t.tipo_contrato ?? "0", 3, "0", false) +
    padN(t.base_cotizacion_cc, 13) +
    padN(t.base_cotizacion_atyepy, 13) +
    padN(t.base_irpf, 13) +
    padN(t.irpf_retenido, 13) +
    padN(t.ss_trabajador, 13) +
    padN(t.ss_empresa, 13) +
    padN(t.liquido, 13) +
    tipoMov
  );
}

/** Cabecera CAB: identifica empresa, periodo y nº de registros. */
function cabecera(empresa: EmpresaFAN, periodo: { ejercicio: number; mes: number }, n: number, tipo: TipoFicheroFAN): string {
  return (
    pad("CAB", 3, " ") +
    pad(tipo, 12, " ") +
    pad(empresa.nif, 12, " ") +
    pad(empresa.ccc, 15, "0", false) +
    periodoAAAAMM(periodo) +
    String(n).padStart(7, "0") +
    pad(empresa.razon_social.toUpperCase(), 60, " ")
  );
}

/** Pie FIN con totales. */
function pie(input: FanInput, totales: { base: number; ss_emp: number; ss_trab: number; irpf: number }): string {
  return (
    pad("FIN", 3, " ") +
    String(input.trabajadores.length).padStart(7, "0") +
    padN(totales.base, 15) +
    padN(totales.ss_emp, 15) +
    padN(totales.ss_trab, 15) +
    padN(totales.irpf, 15)
  );
}

export function generarFAN(input: FanInput): string {
  const lineas: string[] = [];
  lineas.push(cabecera(input.empresa, input.periodo, input.trabajadores.length, input.tipo));

  let baseTot = 0;
  let ssE = 0;
  let ssT = 0;
  let irpf = 0;
  for (const t of input.trabajadores) {
    lineas.push(registroDAT(input.empresa, t, input.periodo));
    baseTot += t.base_cotizacion_cc;
    ssE += t.ss_empresa;
    ssT += t.ss_trabajador;
    irpf += t.irpf_retenido;
  }
  lineas.push(pie(input, { base: baseTot, ss_emp: ssE, ss_trab: ssT, irpf }));

  return lineas.join("\r\n") + "\r\n";
}

/**
 * Validaciones mínimas antes de generar el FAN.
 * Devuelve lista de problemas; vacía = listo para presentar.
 */
export function validarFAN(input: FanInput): string[] {
  const errs: string[] = [];
  if (!input.empresa.ccc || input.empresa.ccc.length < 11) {
    errs.push("CCC (Código Cuenta Cotización) inválido o vacío. Debe tener al menos 11 dígitos.");
  }
  if (!input.empresa.nif) errs.push("NIF de la empresa vacío.");
  if (input.trabajadores.length === 0) errs.push("No hay trabajadores con nómina en el periodo.");
  input.trabajadores.forEach((t, i) => {
    if (!t.naf) errs.push(`Trabajador #${i + 1} (${t.nombre}) sin NAF (Nº Afiliación SS).`);
    if (!t.dni) errs.push(`Trabajador #${i + 1} (${t.nombre}) sin DNI.`);
    if (t.base_cotizacion_cc <= 0) errs.push(`Trabajador #${i + 1} (${t.nombre}) sin base de cotización.`);
  });
  return errs;
}
