/**
 * Catálogo de conceptos de nómina inspirado en A3NOM.
 *
 * Cada concepto tiene:
 *   - tipo (devengo o deducción)
 *   - tributación: cotiza a SS? sujeto a IRPF? exento total/parcial?
 *   - formula descriptiva
 *
 * El gestor selecciona conceptos del catálogo y los aplica a la nómina del
 * trabajador en el mes (con importe o cantidad). Luego calcularNomina los
 * suma a los devengos / deducciones.
 */

export type TipoConcepto = "devengo" | "deduccion";

export type ConceptoCatalogo = {
  codigo: string;
  nombre: string;
  tipo: TipoConcepto;
  /** Cotiza a contingencias comunes SS. */
  cotiza_cc: boolean;
  /** Cotiza a contingencias profesionales (AT/EP). */
  cotiza_atyepy: boolean;
  /** Sujeto a retención IRPF. */
  sujeto_irpf: boolean;
  /** Si está exento parcialmente, importe máximo exento (al año). */
  exencion_anual?: number;
  descripcion: string;
};

export const CONCEPTOS_NOMINA: ConceptoCatalogo[] = [
  // ===== DEVENGOS SALARIALES =====
  { codigo: "001", nombre: "Salario base", tipo: "devengo", cotiza_cc: true, cotiza_atyepy: true, sujeto_irpf: true, descripcion: "Retribución fija según convenio y categoría." },
  { codigo: "002", nombre: "Plus convenio", tipo: "devengo", cotiza_cc: true, cotiza_atyepy: true, sujeto_irpf: true, descripcion: "Complemento fijo establecido en convenio." },
  { codigo: "003", nombre: "Antigüedad / trienios", tipo: "devengo", cotiza_cc: true, cotiza_atyepy: true, sujeto_irpf: true, descripcion: "Complemento por años de antigüedad en la empresa." },
  { codigo: "004", nombre: "Plus nocturnidad", tipo: "devengo", cotiza_cc: true, cotiza_atyepy: true, sujeto_irpf: true, descripcion: "Plus por trabajar entre 22h y 6h (+25% sobre hora base orientativo)." },
  { codigo: "005", nombre: "Plus festivos", tipo: "devengo", cotiza_cc: true, cotiza_atyepy: true, sujeto_irpf: true, descripcion: "Plus por trabajar domingos / festivos." },
  { codigo: "006", nombre: "Plus turnicidad", tipo: "devengo", cotiza_cc: true, cotiza_atyepy: true, sujeto_irpf: true, descripcion: "Plus por trabajo en turnos rotativos." },
  { codigo: "007", nombre: "Plus peligrosidad / penosidad", tipo: "devengo", cotiza_cc: true, cotiza_atyepy: true, sujeto_irpf: true, descripcion: "Plus por trabajos con riesgo o penosos." },
  { codigo: "008", nombre: "Horas extraordinarias estructurales", tipo: "devengo", cotiza_cc: true, cotiza_atyepy: true, sujeto_irpf: true, descripcion: "Horas extra estructurales (mantenimiento, atención cliente)." },
  { codigo: "009", nombre: "Horas extraordinarias por fuerza mayor", tipo: "devengo", cotiza_cc: true, cotiza_atyepy: true, sujeto_irpf: true, descripcion: "Horas extra por fuerza mayor (incendios, daños, accidentes)." },
  { codigo: "010", nombre: "Comisiones", tipo: "devengo", cotiza_cc: true, cotiza_atyepy: true, sujeto_irpf: true, descripcion: "Comisiones por ventas o gestión." },
  { codigo: "011", nombre: "Bonus / incentivo", tipo: "devengo", cotiza_cc: true, cotiza_atyepy: true, sujeto_irpf: true, descripcion: "Bonus de objetivos." },
  { codigo: "012", nombre: "Paga extraordinaria junio", tipo: "devengo", cotiza_cc: true, cotiza_atyepy: true, sujeto_irpf: true, descripcion: "Paga extra de verano (julio o junio)." },
  { codigo: "013", nombre: "Paga extraordinaria diciembre", tipo: "devengo", cotiza_cc: true, cotiza_atyepy: true, sujeto_irpf: true, descripcion: "Paga extra de Navidad." },
  { codigo: "014", nombre: "Paga de beneficios", tipo: "devengo", cotiza_cc: true, cotiza_atyepy: true, sujeto_irpf: true, descripcion: "Paga de beneficios (algunos convenios)." },
  { codigo: "015", nombre: "Atrasos convenio", tipo: "devengo", cotiza_cc: true, cotiza_atyepy: true, sujeto_irpf: true, descripcion: "Diferencias retroactivas por firma convenio." },

  // ===== DIETAS Y KILOMETRAJE (exenciones parciales LIRPF art. 9) =====
  { codigo: "020", nombre: "Dieta estancia España", tipo: "devengo", cotiza_cc: false, cotiza_atyepy: false, sujeto_irpf: false, exencion_anual: 91.35 * 365, descripcion: "Dieta por manutención con pernoctación en España (hasta 91,35 €/día)." },
  { codigo: "021", nombre: "Dieta sin pernocta España", tipo: "devengo", cotiza_cc: false, cotiza_atyepy: false, sujeto_irpf: false, exencion_anual: 26.67 * 365, descripcion: "Dieta sin pernocta en España (hasta 26,67 €/día)." },
  { codigo: "022", nombre: "Dieta estancia extranjero", tipo: "devengo", cotiza_cc: false, cotiza_atyepy: false, sujeto_irpf: false, exencion_anual: 91.35 * 365, descripcion: "Dieta extranjero con pernocta (hasta 91,35 €/día)." },
  { codigo: "023", nombre: "Kilometraje vehículo propio", tipo: "devengo", cotiza_cc: false, cotiza_atyepy: false, sujeto_irpf: false, descripcion: "Compensación uso vehículo propio (hasta 0,26 €/km exento)." },
  { codigo: "024", nombre: "Transporte público (abono)", tipo: "devengo", cotiza_cc: false, cotiza_atyepy: false, sujeto_irpf: false, descripcion: "Abono transporte público (exento hasta 1.500 €/año)." },
  { codigo: "025", nombre: "Cheque restaurante / comida", tipo: "devengo", cotiza_cc: false, cotiza_atyepy: false, sujeto_irpf: false, exencion_anual: 11 * 220, descripcion: "Vales comida (hasta 11 €/día laborable exento)." },
  { codigo: "026", nombre: "Cheque guardería", tipo: "devengo", cotiza_cc: false, cotiza_atyepy: false, sujeto_irpf: false, descripcion: "Servicio primer ciclo educación infantil (exento)." },
  { codigo: "027", nombre: "Seguro médico (familia)", tipo: "devengo", cotiza_cc: false, cotiza_atyepy: false, sujeto_irpf: false, exencion_anual: 500 * 4, descripcion: "Seguro de enfermedad (exento hasta 500 €/persona/año)." },
  { codigo: "028", nombre: "Formación", tipo: "devengo", cotiza_cc: false, cotiza_atyepy: false, sujeto_irpf: false, descripcion: "Formación afín al puesto, abonada por la empresa." },

  // ===== RETRIBUCIÓN EN ESPECIE (cotiza, tributa) =====
  { codigo: "040", nombre: "Vehículo de empresa", tipo: "devengo", cotiza_cc: true, cotiza_atyepy: true, sujeto_irpf: true, descripcion: "Uso vehículo empresa para fines particulares. Valor 20% coste anual." },
  { codigo: "041", nombre: "Vivienda de empresa", tipo: "devengo", cotiza_cc: true, cotiza_atyepy: true, sujeto_irpf: true, descripcion: "Uso vivienda propiedad empresa (10% valor catastral)." },
  { codigo: "042", nombre: "Stock options", tipo: "devengo", cotiza_cc: true, cotiza_atyepy: true, sujeto_irpf: true, descripcion: "Acciones / opciones sobre acciones." },

  // ===== DEDUCCIONES =====
  { codigo: "100", nombre: "SS a cargo trabajador", tipo: "deduccion", cotiza_cc: false, cotiza_atyepy: false, sujeto_irpf: false, descripcion: "Cuota SS del trabajador (CC + desempleo + FP + MEI)." },
  { codigo: "101", nombre: "Retención IRPF", tipo: "deduccion", cotiza_cc: false, cotiza_atyepy: false, sujeto_irpf: false, descripcion: "Retención a cuenta IRPF." },
  { codigo: "102", nombre: "Embargo judicial", tipo: "deduccion", cotiza_cc: false, cotiza_atyepy: false, sujeto_irpf: false, descripcion: "Cuota mensual de embargo según LEC art. 607." },
  { codigo: "103", nombre: "Anticipo a recuperar", tipo: "deduccion", cotiza_cc: false, cotiza_atyepy: false, sujeto_irpf: false, descripcion: "Cuota de devolución de anticipo." },
  { codigo: "104", nombre: "Préstamo empresa", tipo: "deduccion", cotiza_cc: false, cotiza_atyepy: false, sujeto_irpf: false, descripcion: "Cuota mensual de devolución de préstamo." },
  { codigo: "105", nombre: "Sanción / huelga", tipo: "deduccion", cotiza_cc: false, cotiza_atyepy: false, sujeto_irpf: false, descripcion: "Deducción por sanción disciplinaria o ejercicio derecho huelga." },
  { codigo: "106", nombre: "Cuota sindical", tipo: "deduccion", cotiza_cc: false, cotiza_atyepy: false, sujeto_irpf: false, descripcion: "Cuota voluntaria sindicato." },
];

export function getConcepto(codigo: string): ConceptoCatalogo | undefined {
  return CONCEPTOS_NOMINA.find((c) => c.codigo === codigo);
}

export function conceptosPorTipo(tipo: TipoConcepto): ConceptoCatalogo[] {
  return CONCEPTOS_NOMINA.filter((c) => c.tipo === tipo);
}
