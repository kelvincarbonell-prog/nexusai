/**
 * Cálculo de nómina española simplificado (régimen general SS, contrato indefinido,
 * sin convenio específico). 2026 — tipos de cotización y tabla IRPF aproximada.
 *
 * NOTA: la versión final por convenio + edad + dependientes excede el MVP.
 *       Este motor es suficiente para presentar borrador y modelo 111/190
 *       coherente con lo que paga la empresa cada mes.
 */

export type NominaInputs = {
  salario_bruto_anual: number;        // bruto anual del trabajador
  pagas_anuales: number;              // 12 o 14 (default 12 con prorrata)
  irpf_pct_override?: number;         // si la empresa fija un % concreto
  hijos?: number;                     // hijos a cargo (a efectos IRPF, simplificado)
  base_extras?: number;               // pluses/variables del mes (van al bruto del mes)
  dias_periodo?: number;              // 30 default
  ya_devengado_ano?: number;          // bruto ya devengado en lo que va de año
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

// Minoración mínima personal (simplificado)
function minoracionPersonal(hijos: number) {
  // Mínimo personal: 5.550 €
  // +2.400 por primer hijo, +2.700 segundo, +4.000 tercero, +4.500 cuarto y siguientes
  let suma = 5550;
  if (hijos >= 1) suma += 2400;
  if (hijos >= 2) suma += 2700;
  if (hijos >= 3) suma += 4000;
  if (hijos >= 4) suma += 4500 * (hijos - 3);
  return suma;
}

export function calcularIrpfPct(bruto: number, hijos = 0): number {
  // Base liquidable simplificada: bruto - SS estimada (~6%) - reducción 2000 (rendimientos del trabajo)
  const ssEstim = bruto * 0.0648;
  const reduccion = 2000;
  const base = Math.max(0, bruto - ssEstim - reduccion);

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
  const minoracion = minoracionPersonal(hijos);
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
  const brutoMes = round2(brutoMensual + (input.base_extras ?? 0));

  // Bases de cotización: con prorrata de pagas extras (sin tope MIN/MAX simplificado)
  const brutoConProrrata = round2((brutoAnual + (input.base_extras ?? 0) * 12) / 12);
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

  const baseIrpfAnual = brutoAnual + (input.base_extras ?? 0) * 12;
  const pctIrpf =
    input.irpf_pct_override != null ? input.irpf_pct_override : calcularIrpfPct(baseIrpfAnual, input.hijos ?? 0);
  const irpfRetenido = brutoMes * (pctIrpf / 100);

  const totalDeducciones = ssTrabajadorTotal + irpfRetenido;
  const liquido = brutoMes - totalDeducciones;

  const conceptos: ConceptoLinea[] = [
    { concepto: "Salario base", importe: round2(brutoMensual), tipo: "devengo" },
  ];
  if (input.base_extras && input.base_extras > 0) {
    conceptos.push({ concepto: "Pluses / variables", importe: round2(input.base_extras), tipo: "devengo" });
  }
  conceptos.push(
    { concepto: "Contingencias comunes (4,70 %)", importe: round2(-ssTrabajadorCC), tipo: "deduccion" },
    { concepto: "Desempleo (1,55 %)", importe: round2(-ssTrabajadorDes), tipo: "deduccion" },
    { concepto: "Formación profesional (0,10 %)", importe: round2(-ssTrabajadorForm), tipo: "deduccion" },
    { concepto: "MEI (0,13 %)", importe: round2(-ssTrabajadorMei), tipo: "deduccion" },
    { concepto: `Retención IRPF (${pctIrpf.toFixed(2)} %)`, importe: round2(-irpfRetenido), tipo: "deduccion" },
  );

  return {
    devengo_bruto: round2(brutoMes),
    base_cotizacion_cc: round2(baseCC),
    base_cotizacion_atyepy: round2(baseATyEPyFormacion),
    base_irpf: round2(brutoMes),
    ss_trabajador: round2(ssTrabajadorTotal),
    irpf_retenido: round2(irpfRetenido),
    total_deducciones: round2(totalDeducciones),
    liquido: round2(liquido),
    ss_empresa: round2(ssEmpresaTotal),
    conceptos,
    irpf_pct_aplicado: pctIrpf,
  };
}
