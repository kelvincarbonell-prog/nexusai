/**
 * Cuenta de Pérdidas y Ganancias + Balance de Situación
 * según el PGC PYMES (Orden EHA/3360/2010).
 *
 * Entrada: lista de saldos por cuenta (code, debit, credit).
 * Salida: estructura jerárquica con bloques oficiales.
 */

export type Saldo = {
  code: string;        // p.ej. "700", "430", "4751"
  name?: string;
  debit: number;
  credit: number;
};

/**
 * El "saldo" contable habitual: deudor positivo (debit - credit) para
 * cuentas de activo/gasto, acreedor positivo (credit - debit) para
 * pasivo/ingreso. Para PyG/Balance trabajamos con valor absoluto del
 * importe que aporta cada cuenta a su línea.
 */
function importe(s: Saldo): number {
  return Math.round((s.debit - s.credit) * 100) / 100;
}

function importeAcreedor(s: Saldo): number {
  return Math.round((s.credit - s.debit) * 100) / 100;
}

function startsWith(code: string, prefixes: string[]): boolean {
  return prefixes.some((p) => code.startsWith(p));
}

/* ----------------------------------------------------------------
   CUENTA DE PÉRDIDAS Y GANANCIAS
---------------------------------------------------------------- */

export type PyGLinea = {
  code: string;
  label: string;
  importe: number;
  cuentas?: string[]; // qué cuentas contables agregan
  bold?: boolean;
  level?: 0 | 1 | 2;
};

export type PyGResult = {
  lineas: PyGLinea[];
  totales: {
    importe_neto_cifra_negocios: number;
    aprovisionamientos: number;
    gastos_personal: number;
    otros_gastos_explotacion: number;
    resultado_explotacion: number;
    resultado_financiero: number;
    resultado_antes_impuestos: number;
    impuesto_beneficios: number;
    resultado_ejercicio: number;
  };
};

export function calcularPyG(saldos: Saldo[]): PyGResult {
  // Acumuladores
  const agrupado = new Map<string, number>();
  for (const s of saldos) {
    agrupado.set(s.code, (agrupado.get(s.code) ?? 0) + importe(s));
  }

  function sumGrupo(prefixes: string[], sign: 1 | -1 = 1): number {
    let total = 0;
    for (const [code, imp] of agrupado.entries()) {
      if (startsWith(code, prefixes)) total += sign * imp;
    }
    return Math.round(total * 100) / 100;
  }

  // Cifra de negocios: 70 ventas y prestaciones de servicios
  // Saldos del 70 son acreedores → importe es negativo. Cambiamos signo.
  const cifraNegocios = -sumGrupo(["70"]);

  // Otros ingresos explotación: 75 + 73
  const otrosIngresos = -sumGrupo(["73", "75"]);

  // Aprovisionamientos: 60 compras - 61 variación existencias
  const aprovisionamientos = sumGrupo(["60"]) - sumGrupo(["61"]);

  // Gastos de personal: 64 (sueldos + SS)
  const gastosPersonal = sumGrupo(["64"]);

  // Otros gastos explotación: 62 + 63 (excl. 6300)
  const serviciosExteriores = sumGrupo(["62"]);
  const tributos = sumGrupo(["63"]) - (agrupado.get("6300") ?? 0); // sin IS
  const otrosGastosExp = serviciosExteriores + tributos + sumGrupo(["65"]) + sumGrupo(["694", "695"]);

  // Amortizaciones: 68
  const amortizacion = sumGrupo(["68"]);

  // Deterioros y resultado por enajenaciones inmovilizado: 67/69 selectivo
  const deteriorosInmov = sumGrupo(["67", "69"]) - sumGrupo(["694", "695"]);

  // Resultado de explotación
  const resultadoExp =
    cifraNegocios + otrosIngresos - aprovisionamientos - gastosPersonal -
    otrosGastosExp - amortizacion - deteriorosInmov;

  // Resultado financiero: 76 ingresos finan, 66 gastos finan, 76-67 diferencias cambio
  const ingresosFinancieros = -sumGrupo(["76"]);
  const gastosFinancieros = sumGrupo(["66"]);
  const resultadoFin = ingresosFinancieros - gastosFinancieros;

  const resultadoAntesImpuestos = resultadoExp + resultadoFin;
  const impuestoBeneficios = agrupado.get("6300") ?? 0;
  const resultadoEjercicio = resultadoAntesImpuestos - impuestoBeneficios;

  const lineas: PyGLinea[] = [
    { code: "A.1", label: "Importe neto de la cifra de negocios", importe: cifraNegocios, cuentas: ["70"], bold: true, level: 1 },
    { code: "A.2", label: "Otros ingresos de explotación", importe: otrosIngresos, cuentas: ["73", "75"], level: 1 },
    { code: "A.3", label: "Aprovisionamientos", importe: -aprovisionamientos, cuentas: ["60", "61"], level: 1 },
    { code: "A.4", label: "Gastos de personal", importe: -gastosPersonal, cuentas: ["64"], level: 1 },
    { code: "A.5", label: "Otros gastos de explotación", importe: -otrosGastosExp, cuentas: ["62", "63", "65"], level: 1 },
    { code: "A.6", label: "Amortización del inmovilizado", importe: -amortizacion, cuentas: ["68"], level: 1 },
    { code: "A.7", label: "Deterioros y resultado enajenación inmovilizado", importe: -deteriorosInmov, cuentas: ["67", "69"], level: 1 },
    { code: "A", label: "RESULTADO DE EXPLOTACIÓN", importe: resultadoExp, bold: true, level: 0 },

    { code: "B.1", label: "Ingresos financieros", importe: ingresosFinancieros, cuentas: ["76"], level: 1 },
    { code: "B.2", label: "Gastos financieros", importe: -gastosFinancieros, cuentas: ["66"], level: 1 },
    { code: "B", label: "RESULTADO FINANCIERO", importe: resultadoFin, bold: true, level: 0 },

    { code: "C", label: "RESULTADO ANTES DE IMPUESTOS (A + B)", importe: resultadoAntesImpuestos, bold: true, level: 0 },
    { code: "D.1", label: "Impuesto sobre beneficios", importe: -impuestoBeneficios, cuentas: ["6300"], level: 1 },
    { code: "D", label: "RESULTADO DEL EJERCICIO", importe: resultadoEjercicio, bold: true, level: 0 },
  ];

  return {
    lineas,
    totales: {
      importe_neto_cifra_negocios: cifraNegocios,
      aprovisionamientos,
      gastos_personal: gastosPersonal,
      otros_gastos_explotacion: otrosGastosExp,
      resultado_explotacion: resultadoExp,
      resultado_financiero: resultadoFin,
      resultado_antes_impuestos: resultadoAntesImpuestos,
      impuesto_beneficios: impuestoBeneficios,
      resultado_ejercicio: resultadoEjercicio,
    },
  };
}

/* ----------------------------------------------------------------
   BALANCE DE SITUACIÓN
---------------------------------------------------------------- */

export type BalanceLinea = {
  code: string;
  label: string;
  importe: number;
  cuentas?: string[];
  bold?: boolean;
  level?: 0 | 1 | 2;
};

export type BalanceResult = {
  activo: BalanceLinea[];
  pasivo: BalanceLinea[];
  totales: {
    activo_no_corriente: number;
    activo_corriente: number;
    total_activo: number;
    patrimonio_neto: number;
    pasivo_no_corriente: number;
    pasivo_corriente: number;
    total_pasivo: number;
    diferencia: number; // activo - (PN+pasivo); debe ser ~0
  };
};

export function calcularBalance(saldos: Saldo[], resultadoEjercicio: number = 0): BalanceResult {
  const agrupado = new Map<string, number>();
  for (const s of saldos) {
    agrupado.set(s.code, (agrupado.get(s.code) ?? 0) + importe(s));
  }

  function sumGrupo(prefixes: string[]): number {
    let total = 0;
    for (const [code, imp] of agrupado.entries()) {
      if (startsWith(code, prefixes)) total += imp;
    }
    return Math.round(total * 100) / 100;
  }

  function sumAcreedor(prefixes: string[]): number {
    let total = 0;
    for (const s of saldos) {
      if (startsWith(s.code, prefixes)) total += importeAcreedor(s);
    }
    return Math.round(total * 100) / 100;
  }

  // ACTIVO NO CORRIENTE
  const inmovilizadoIntangible = sumGrupo(["20", "21"]) - sumAcreedor(["280", "281", "290", "291"]);
  const inmovilizadoMaterial = sumGrupo(["22", "23"]) - sumAcreedor(["282", "283", "284", "291", "292"]);
  const inversionesInmobiliarias = sumGrupo(["220", "221"]);
  const inversionesLargoPlazo = sumGrupo(["24", "25"]);
  const activosImpuestoDiferido = sumGrupo(["474"]);

  const activoNoCorriente =
    inmovilizadoIntangible + inmovilizadoMaterial + inversionesInmobiliarias +
    inversionesLargoPlazo + activosImpuestoDiferido;

  // ACTIVO CORRIENTE
  const existencias = sumGrupo(["30", "31", "32", "33", "34", "35", "36"]) - sumAcreedor(["390", "391", "392", "393", "394"]);
  const clientes = sumGrupo(["43", "44"]);
  const inversionesCortoPlazo = sumGrupo(["54"]);
  const hpDeudora = sumGrupo(["470", "471", "472", "473"]);
  const tesoreria = sumGrupo(["57"]);
  const periodificaciones = sumGrupo(["480", "567"]);

  const activoCorriente =
    existencias + clientes + inversionesCortoPlazo + hpDeudora + tesoreria + periodificaciones;

  const totalActivo = activoNoCorriente + activoCorriente;

  // PATRIMONIO NETO
  const capital = sumAcreedor(["100", "101"]);
  const reservas = sumAcreedor(["11"]);
  const resultadosAnteriores = sumAcreedor(["120", "121"]);
  // Si no se pasa explícito, usar saldo de 129
  const resultadoCalc = resultadoEjercicio !== 0 ? resultadoEjercicio : sumAcreedor(["129"]);
  const subvenciones = sumAcreedor(["13"]);

  const patrimonioNeto = capital + reservas + resultadosAnteriores + resultadoCalc + subvenciones;

  // PASIVO NO CORRIENTE
  const provisionesLp = sumAcreedor(["14"]);
  const deudasLp = sumAcreedor(["17"]);
  const acreedoresLp = sumAcreedor(["18"]);

  const pasivoNoCorriente = provisionesLp + deudasLp + acreedoresLp;

  // PASIVO CORRIENTE
  const deudasCp = sumAcreedor(["50", "51", "52"]);
  const proveedores = sumAcreedor(["40", "41"]);
  const hpAcreedora = sumAcreedor(["475", "476", "477"]);
  const otrosAcreedores = sumAcreedor(["46", "55"]);
  const periodificacionesPasivo = sumAcreedor(["485", "568"]);

  const pasivoCorriente = deudasCp + proveedores + hpAcreedora + otrosAcreedores + periodificacionesPasivo;

  const totalPasivo = patrimonioNeto + pasivoNoCorriente + pasivoCorriente;

  const activo: BalanceLinea[] = [
    { code: "A", label: "ACTIVO NO CORRIENTE", importe: activoNoCorriente, bold: true, level: 0 },
    { code: "A.I", label: "Inmovilizado intangible", importe: inmovilizadoIntangible, cuentas: ["20", "21"], level: 1 },
    { code: "A.II", label: "Inmovilizado material", importe: inmovilizadoMaterial, cuentas: ["22", "23"], level: 1 },
    { code: "A.III", label: "Inversiones inmobiliarias", importe: inversionesInmobiliarias, cuentas: ["220", "221"], level: 1 },
    { code: "A.IV", label: "Inversiones financieras a l/p", importe: inversionesLargoPlazo, cuentas: ["24", "25"], level: 1 },
    { code: "A.V", label: "Activos por impuesto diferido", importe: activosImpuestoDiferido, cuentas: ["474"], level: 1 },

    { code: "B", label: "ACTIVO CORRIENTE", importe: activoCorriente, bold: true, level: 0 },
    { code: "B.I", label: "Existencias", importe: existencias, cuentas: ["30", "31", "32", "33"], level: 1 },
    { code: "B.II", label: "Deudores comerciales y otras cuentas a cobrar", importe: clientes, cuentas: ["43", "44"], level: 1 },
    { code: "B.III", label: "Inversiones financieras a c/p", importe: inversionesCortoPlazo, cuentas: ["54"], level: 1 },
    { code: "B.IV", label: "Hacienda Pública deudora", importe: hpDeudora, cuentas: ["470", "471", "472", "473"], level: 1 },
    { code: "B.V", label: "Efectivo y otros activos líquidos", importe: tesoreria, cuentas: ["57"], level: 1 },
    { code: "B.VI", label: "Periodificaciones c/p", importe: periodificaciones, cuentas: ["480", "567"], level: 1 },

    { code: "TOTAL_A", label: "TOTAL ACTIVO (A + B)", importe: totalActivo, bold: true, level: 0 },
  ];

  const pasivo: BalanceLinea[] = [
    { code: "A", label: "PATRIMONIO NETO", importe: patrimonioNeto, bold: true, level: 0 },
    { code: "A.I", label: "Capital", importe: capital, cuentas: ["100", "101"], level: 1 },
    { code: "A.II", label: "Reservas", importe: reservas, cuentas: ["11"], level: 1 },
    { code: "A.III", label: "Resultados ejercicios anteriores", importe: resultadosAnteriores, cuentas: ["120", "121"], level: 1 },
    { code: "A.IV", label: "Resultado del ejercicio", importe: resultadoCalc, cuentas: ["129"], level: 1 },
    { code: "A.V", label: "Subvenciones, donaciones y legados", importe: subvenciones, cuentas: ["13"], level: 1 },

    { code: "B", label: "PASIVO NO CORRIENTE", importe: pasivoNoCorriente, bold: true, level: 0 },
    { code: "B.I", label: "Provisiones l/p", importe: provisionesLp, cuentas: ["14"], level: 1 },
    { code: "B.II", label: "Deudas l/p con entidades de crédito", importe: deudasLp, cuentas: ["17"], level: 1 },
    { code: "B.III", label: "Acreedores l/p", importe: acreedoresLp, cuentas: ["18"], level: 1 },

    { code: "C", label: "PASIVO CORRIENTE", importe: pasivoCorriente, bold: true, level: 0 },
    { code: "C.I", label: "Deudas c/p con entidades de crédito", importe: deudasCp, cuentas: ["50", "51", "52"], level: 1 },
    { code: "C.II", label: "Acreedores comerciales y otras cuentas a pagar", importe: proveedores, cuentas: ["40", "41"], level: 1 },
    { code: "C.III", label: "Hacienda Pública acreedora", importe: hpAcreedora, cuentas: ["475", "476", "477"], level: 1 },
    { code: "C.IV", label: "Otros acreedores", importe: otrosAcreedores, cuentas: ["46", "55"], level: 1 },
    { code: "C.V", label: "Periodificaciones c/p", importe: periodificacionesPasivo, cuentas: ["485", "568"], level: 1 },

    { code: "TOTAL_P", label: "TOTAL PATRIMONIO NETO Y PASIVO (A + B + C)", importe: totalPasivo, bold: true, level: 0 },
  ];

  return {
    activo,
    pasivo,
    totales: {
      activo_no_corriente: activoNoCorriente,
      activo_corriente: activoCorriente,
      total_activo: totalActivo,
      patrimonio_neto: patrimonioNeto,
      pasivo_no_corriente: pasivoNoCorriente,
      pasivo_corriente: pasivoCorriente,
      total_pasivo: totalPasivo,
      diferencia: Math.round((totalActivo - totalPasivo) * 100) / 100,
    },
  };
}
