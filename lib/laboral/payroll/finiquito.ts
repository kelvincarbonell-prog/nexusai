/**
 * Cálculo de finiquito de un trabajador a fecha de baja.
 *
 * Componentes:
 *  - Salario pendiente del mes (días trabajados / días naturales del mes)
 *  - Vacaciones devengadas no disfrutadas (proporcional a meses trabajados año)
 *  - Pagas extras prorrateadas (si no se cobran en nómina, dos pagas al año:
 *    salario_mensual_bruto × meses_trabajados / 6)
 *  - Indemnización (si procede): según causa
 *     · Despido objetivo / fin contrato temporal: 20 días por año, máx 12 meses
 *     · Despido improcedente: 33 días por año, máx 24 meses (contratos post 2012)
 *     · Despido procedente: 0 (excepto justificadas como objetivo)
 *     · Fin contrato formación: 0
 *     · Dimisión: 0
 */

export type FiniquitoInput = {
  salario_bruto_anual: number;
  fecha_alta: string;             // YYYY-MM-DD
  fecha_baja: string;             // YYYY-MM-DD
  causa: "despido_improcedente" | "despido_objetivo" | "fin_contrato" | "dimision" | "mutuo_acuerdo" | "jubilacion";
  pagas_anuales?: 12 | 14;
  dias_vacaciones_anuales?: number;       // 30 default
  dias_vacaciones_disfrutadas_anyo?: number;
  pagas_extras_prorrateadas_en_nomina?: boolean;  // si ya van en nómina mensual
  irpf_pct?: number;
};

export type FiniquitoResult = {
  salario_pendiente: number;
  vacaciones_devengadas: number;
  pagas_extras_prorrateadas: number;
  indemnizacion: number;
  base_irpf: number;
  irpf_retenido: number;
  total_bruto: number;
  total_neto: number;
  meses_trabajados: number;
  dias_pendientes: number;
  desglose: { concepto: string; importe: number; sujeto_irpf: boolean }[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function diasEntre(a: string, b: string): number {
  return Math.floor((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86_400_000) + 1;
}

function diasMes(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function calcularFiniquito(input: FiniquitoInput): FiniquitoResult {
  const bruto = Number(input.salario_bruto_anual);
  const pagas = input.pagas_anuales ?? 12;
  const salarioMensualBruto = bruto / pagas;

  const fechaBaja = new Date(input.fecha_baja + "T00:00:00");
  const fechaAlta = new Date(input.fecha_alta + "T00:00:00");
  const anyoActual = fechaBaja.getUTCFullYear();
  const inicioAnyo = new Date(Date.UTC(anyoActual, 0, 1));
  const inicioComputo = fechaAlta > inicioAnyo ? fechaAlta : inicioAnyo;
  const diasComputo = diasEntre(inicioComputo.toISOString().slice(0, 10), input.fecha_baja);
  const mesesComputo = diasComputo / 30;

  // 1. Salario pendiente del mes en curso
  const mesBaja = fechaBaja.getUTCMonth() + 1;
  const diaBaja = fechaBaja.getUTCDate();
  const diasMesActual = diasMes(anyoActual, mesBaja);
  const salarioMesPendiente = (salarioMensualBruto / diasMesActual) * diaBaja;

  // 2. Vacaciones devengadas no disfrutadas
  const vacAnuales = input.dias_vacaciones_anuales ?? 30;
  const vacDevengadas = (vacAnuales * diasComputo) / 365 - (input.dias_vacaciones_disfrutadas_anyo ?? 0);
  const valorDia = bruto / 365;
  const vacacionesImporte = Math.max(0, vacDevengadas * valorDia);

  // 3. Pagas extras (si NO van prorrateadas en nómina)
  let pagasExtras = 0;
  if (!input.pagas_extras_prorrateadas_en_nomina) {
    // 2 pagas extras al año = salarioMensualBruto cada una
    pagasExtras = (salarioMensualBruto * 2 * mesesComputo) / 12;
  }

  // 4. Indemnización
  const anyosTrabajados = diasEntre(input.fecha_alta, input.fecha_baja) / 365;
  let indemnizacion = 0;
  if (input.causa === "despido_improcedente") {
    indemnizacion = Math.min(salarioMensualBruto * 24, (salarioMensualBruto / 30) * 33 * anyosTrabajados);
  } else if (input.causa === "despido_objetivo" || input.causa === "fin_contrato") {
    indemnizacion = Math.min(salarioMensualBruto * 12, (salarioMensualBruto / 30) * 20 * anyosTrabajados);
  }
  // Dimisión, mutuo, jubilación: 0 indemnización

  const baseIrpf = round2(salarioMesPendiente + vacacionesImporte + pagasExtras);
  const pctIrpf = input.irpf_pct ?? 0;
  const irpfRetenido = round2(baseIrpf * (pctIrpf / 100));
  const totalBruto = round2(baseIrpf + indemnizacion);
  // La indemnización dentro de los límites está exenta de IRPF (LIRPF art. 7.e).
  const totalNeto = round2(totalBruto - irpfRetenido);

  const desglose: FiniquitoResult["desglose"] = [
    { concepto: `Salario pendiente del mes (${diaBaja} días de ${diasMesActual})`, importe: round2(salarioMesPendiente), sujeto_irpf: true },
    { concepto: `Vacaciones devengadas no disfrutadas (${round2(vacDevengadas)} días)`, importe: round2(vacacionesImporte), sujeto_irpf: true },
  ];
  if (pagasExtras > 0) {
    desglose.push({ concepto: `Pagas extras prorrateadas (${round2(mesesComputo)} meses)`, importe: round2(pagasExtras), sujeto_irpf: true });
  }
  if (indemnizacion > 0) {
    desglose.push({ concepto: `Indemnización · ${input.causa.replace("_", " ")} (exenta IRPF dentro de límites)`, importe: round2(indemnizacion), sujeto_irpf: false });
  }

  return {
    salario_pendiente: round2(salarioMesPendiente),
    vacaciones_devengadas: round2(vacacionesImporte),
    pagas_extras_prorrateadas: round2(pagasExtras),
    indemnizacion: round2(indemnizacion),
    base_irpf: baseIrpf,
    irpf_retenido: irpfRetenido,
    total_bruto: totalBruto,
    total_neto: totalNeto,
    meses_trabajados: round2(mesesComputo),
    dias_pendientes: diaBaja,
    desglose,
  };
}
