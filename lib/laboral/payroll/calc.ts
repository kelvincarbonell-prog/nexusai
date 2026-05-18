/**
 * Cálculo de nómina española simplificado (régimen general SS, contrato indefinido,
 * sin convenio específico). 2026 — tipos de cotización y tabla IRPF aproximada.
 *
 * NOTA: la versión final por convenio + edad + dependientes excede el MVP.
 *       Este motor es suficiente para presentar borrador y modelo 111/190
 *       coherente con lo que paga la empresa cada mes.
 */

import { getConcepto } from "@/lib/laboral/conceptos";

/** Concepto extra A3NOM aplicado al mes (referencia al catálogo + importe). */
export type ConceptoExtraInput = { codigo: string; importe: number };

export type NominaInputs = {
  salario_bruto_anual: number;        // bruto anual del trabajador
  pagas_anuales: number;              // 12 o 14 (default 12 con prorrata)
  irpf_pct_override?: number;         // si la empresa fija un % concreto
  hijos?: number;                     // hijos a cargo (a efectos IRPF, simplificado)
  base_extras?: number;               // pluses/variables del mes (van al bruto del mes)
  dias_periodo?: number;              // 30 default
  ya_devengado_ano?: number;          // bruto ya devengado en lo que va de año
  conceptos_extras?: ConceptoExtraInput[]; // del catálogo A3NOM
};

export type ConceptoLinea = { concepto: string; importe: number; tipo: "devengo" | "deduccion" };

export type NominaResult = {
  devengo_bruto: number;
  base_cotizacion_cc: number;     // contingencias comunes
  base_cotizacion_atyepy: number; // AT/EP, FOGASA, formación, MEI
  base_irpf: number;
  ss_trabajador: number;
  irpf_retenido: number;
  total_deducciones: number;
  liquido: number;
  ss_empresa: number;            // a cargo de la empresa
  conceptos: ConceptoLinea[];
  irpf_pct_aplicado: number;
};

// Cotización trabajador 2026 (orientativo)
const SS_TRABAJADOR = {
  cc: 4.7 / 100,          // contingencias comunes
  desempleo: 1.55 / 100,
  formacion: 0.1 / 100,
  mei: 0.13 / 100,
};

const SS_EMPRESA = {
  cc: 23.6 / 100,
  desempleo: 5.5 / 100,
  fogasa: 0.2 / 100,
  formacion: 0.6 / 100,
  at_ep: 1.5 / 100,       // tipo medio orientativo (varía por CNAE)
  mei: 0.67 / 100,
};

// Tabla IRPF 2026 orientativa para retenciones del trabajo
const IRPF_BRACKETS_2026 = [
  { max: 12450, pct: 19 },
  { max: 20200, pct: 24 },
  { max: 35200, pct: 30 },
  { max: 60000, pct: 37 },
  { max: 300000, pct: 45 },
  { max: Infinity, pct: 47 },
];

export type CircunstanciasIRPF = {
  hijos?: number;                            // hijos a cargo <25 años (o discapacitados)
  hijos_menor_3?: number;                    // de los hijos, cuántos <3 años (suplemento)
  ascendientes_mayor_65?: number;            // ascendientes >65 a cargo
  ascendientes_mayor_75?: number;            // de los anteriores, cuántos >75 (extra)
  discapacidad_pct?: number;                 // del trabajador (0..100)
  pension_compensatoria?: number;            // anual pagada
  anualidad_alimentos?: number;              // anual hijos divorcio
  edad?: number;                             // del trabajador (para mínimos)
};

// Minoración mínima personal según IRPF (orientativo 2026)
function minoracionPersonal(c: CircunstanciasIRPF) {
  // Mínimo personal base: 5.550 €
  let suma = 5550;
  // Incremento por edad
  if ((c.edad ?? 0) >= 65) suma += 1150;
  if ((c.edad ?? 0) >= 75) suma += 1400;
  // Mínimo por descendientes
  const hijos = c.hijos ?? 0;
  if (hijos >= 1) suma += 2400;
  if (hijos >= 2) suma += 2700;
  if (hijos >= 3) suma += 4000;
  if (hijos >= 4) suma += 4500 * (hijos - 3);
  // Suplemento por hijo <3 años
  suma += 2800 * Math.max(0, c.hijos_menor_3 ?? 0);
  // Mínimo por ascendientes
  suma += 1150 * Math.max(0, c.ascendientes_mayor_65 ?? 0);
  suma += 1400 * Math.max(0, c.ascendientes_mayor_75 ?? 0);
  // Mínimo por discapacidad del trabajador
  const disc = c.discapacidad_pct ?? 0;
  if (disc >= 33 && disc < 65) suma += 3000;
  else if (disc >= 65) suma += 9000;
  return suma;
}

export function calcularIrpfPct(bruto: number, hijosOrCirc: number | CircunstanciasIRPF = 0): number {
  const c: CircunstanciasIRPF = typeof hijosOrCirc === "number" ? { hijos: hijosOrCirc } : hijosOrCirc;

  // Base liquidable simplificada
  const ssEstim = bruto * 0.0648;
  const reduccion = 2000; // rendimientos del trabajo

  // Pensión compensatoria al ex-cónyuge: reduce la base general
  const pensionComp = Math.max(0, c.pension_compensatoria ?? 0);
  // Anualidades por alimentos: van a una escala independiente (simplificado: las descontamos también)
  const alimentos = Math.max(0, c.anualidad_alimentos ?? 0);

  const base = Math.max(0, bruto - ssEstim - reduccion - pensionComp - alimentos);

  // Cuota íntegra escalonada
  let cuota = 0;
  let prev = 0;
  for (const b of IRPF_BRACKETS_2026) {
    if (base > b.max) {
      cuota += (b.max - prev) * (b.pct / 100);
      prev = b.max;
    } else {
      cuota += (base - prev) * (b.pct / 100);
      break;
    }
  }
  // Aplicar minoración a la cuota (simplificado, lineal)
  const minoracion = minoracionPersonal(c);
  let cuotaMin = 0;
  let prev2 = 0;
  let restante = minoracion;
  for (const b of IRPF_BRACKETS_2026) {
    const slot = Math.min(restante, b.max - prev2);
    if (slot <= 0) break;
    cuotaMin += slot * (b.pct / 100);
    restante -= slot;
    prev2 = b.max;
  }
  const cuotaFinal = Math.max(0, cuota - cuotaMin);
  const pct = base > 0 ? (cuotaFinal / bruto) * 100 : 0;
  return Math.round(pct * 100) / 100;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcularNomina(input: NominaInputs): NominaResult {
  const pagas = input.pagas_anuales ?? 12;
  const brutoAnual = input.salario_bruto_anual;
  const brutoMensual = round2(brutoAnual / pagas);

  // Conceptos extras del catálogo A3NOM (devengos/deducciones puntuales)
  let devengosExtra = 0;
  let deduccionesExtra = 0;
  let cotizableExtra = 0;       // suma que aumenta bases SS
  let irpfImponibleExtra = 0;   // suma que aumenta base IRPF
  const conceptosExtraLineas: ConceptoLinea[] = [];
  for (const ce of input.conceptos_extras ?? []) {
    const cat = getConcepto(ce.codigo);
    if (!cat || !Number.isFinite(ce.importe) || ce.importe <= 0) continue;
    const importe = round2(ce.importe);
    // Exención mensual aproximada (catálogo guarda exención anual)
    const exentoMes = cat.exencion_anual ? cat.exencion_anual / 12 : 0;
    const tributable = exentoMes > 0 ? Math.max(0, importe - exentoMes) : importe;
    if (cat.tipo === "devengo") {
      devengosExtra += importe;
      if (cat.cotiza_cc || cat.cotiza_atyepy) cotizableExtra += tributable;
      if (cat.sujeto_irpf) irpfImponibleExtra += tributable;
      conceptosExtraLineas.push({ concepto: cat.nombre, importe, tipo: "devengo" });
    } else {
      deduccionesExtra += importe;
      conceptosExtraLineas.push({ concepto: cat.nombre, importe: -importe, tipo: "deduccion" });
    }
  }

  const brutoMes = round2(brutoMensual + (input.base_extras ?? 0) + devengosExtra);

  // Bases de cotización: con prorrata de pagas extras (sin tope MIN/MAX simplificado)
  const brutoConProrrata = round2((brutoAnual + (input.base_extras ?? 0) * 12) / 12 + cotizableExtra);
  const baseCC = brutoConProrrata;
  const baseATyEPyFormacion = brutoConProrrata;

  const ssTrabajadorCC = baseCC * SS_TRABAJADOR.cc;
  const ssTrabajadorDes = baseATyEPyFormacion * SS_TRABAJADOR.desempleo;
  const ssTrabajadorForm = baseATyEPyFormacion * SS_TRABAJADOR.formacion;
  const ssTrabajadorMei = baseCC * SS_TRABAJADOR.mei;
  const ssTrabajadorTotal = ssTrabajadorCC + ssTrabajadorDes + ssTrabajadorForm + ssTrabajadorMei;

  const ssEmpresaTotal =
    baseCC * SS_EMPRESA.cc +
    baseATyEPyFormacion * (SS_EMPRESA.desempleo + SS_EMPRESA.fogasa + SS_EMPRESA.formacion + SS_EMPRESA.at_ep) +
    baseCC * SS_EMPRESA.mei;

  const baseIrpfAnual = brutoAnual + (input.base_extras ?? 0) * 12 + irpfImponibleExtra * 12;
  const pctIrpf =
    input.irpf_pct_override != null ? input.irpf_pct_override : calcularIrpfPct(baseIrpfAnual, input.hijos ?? 0);
  const baseIrpfMes = brutoMensual + (input.base_extras ?? 0) + irpfImponibleExtra;
  const irpfRetenido = baseIrpfMes * (pctIrpf / 100);

  const totalDeducciones = ssTrabajadorTotal + irpfRetenido + deduccionesExtra;
  const liquido = brutoMes - totalDeducciones;

  const conceptos: ConceptoLinea[] = [
    { concepto: "Salario base", importe: round2(brutoMensual), tipo: "devengo" },
  ];
  if (input.base_extras && input.base_extras > 0) {
    conceptos.push({ concepto: "Pluses / variables", importe: round2(input.base_extras), tipo: "devengo" });
  }
  conceptos.push(...conceptosExtraLineas.filter((l) => l.tipo === "devengo"));
  conceptos.push(
    { concepto: "Contingencias comunes (4,70 %)", importe: round2(-ssTrabajadorCC), tipo: "deduccion" },
    { concepto: "Desempleo (1,55 %)", importe: round2(-ssTrabajadorDes), tipo: "deduccion" },
    { concepto: "Formación profesional (0,10 %)", importe: round2(-ssTrabajadorForm), tipo: "deduccion" },
    { concepto: "MEI (0,13 %)", importe: round2(-ssTrabajadorMei), tipo: "deduccion" },
    { concepto: `Retención IRPF (${pctIrpf.toFixed(2)} %)`, importe: round2(-irpfRetenido), tipo: "deduccion" },
  );
  conceptos.push(...conceptosExtraLineas.filter((l) => l.tipo === "deduccion"));

  return {
    devengo_bruto: round2(brutoMes),
    base_cotizacion_cc: round2(baseCC),
    base_cotizacion_atyepy: round2(baseATyEPyFormacion),
    base_irpf: round2(baseIrpfMes),
    ss_trabajador: round2(ssTrabajadorTotal),
    irpf_retenido: round2(irpfRetenido),
    total_deducciones: round2(totalDeducciones),
    liquido: round2(liquido),
    ss_empresa: round2(ssEmpresaTotal),
    conceptos,
    irpf_pct_aplicado: pctIrpf,
  };
}
