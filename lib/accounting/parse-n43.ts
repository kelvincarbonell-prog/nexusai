/**
 * Parser Norma 43 (AEB43) — formato bancario español posicional.
 *
 * Estructura:
 *   - Registro tipo 11: cabecera de cuenta (banco, oficina, IBAN, fecha desde/hasta, saldo inicial)
 *   - Registro tipo 22: movimiento (fecha operación, valor, importe, concepto común, referencia 1, 2)
 *   - Registro tipo 23: concepto adicional 1
 *   - Registro tipo 24: concepto adicional 2
 *   - Registro tipo 33: pie de cuenta (saldo final, nº movimientos)
 *   - Registro tipo 88: fin de fichero
 *
 * Cada línea son 80 caracteres exactos.
 */

export type BankMovement = {
  fecha_operacion: string;        // YYYY-MM-DD
  fecha_valor: string;
  importe: number;                  // positivo = ingreso, negativo = pago
  concepto_comun: string;
  concepto_propio: string;          // concat 23+24
  referencia1: string;
  referencia2: string;
};

export type BankAccount = {
  banco: string;
  oficina: string;
  cuenta: string;
  iban: string;
  fecha_desde: string;
  fecha_hasta: string;
  saldo_inicial: number;
  divisa: string;
  movimientos: BankMovement[];
  saldo_final?: number;
};

export type ParseResult = {
  ok: boolean;
  cuentas: BankAccount[];
  error?: string;
  total_movimientos: number;
};

function impFromN43(s: string, signo: string): number {
  // 14 dígitos con 2 decimales implícitos, signo "1" debe, "2" haber
  const cents = parseInt(s.replace(/^0+/, "") || "0", 10);
  const value = cents / 100;
  return signo === "1" ? -value : value;
}

function fechaFromN43(s: string): string {
  // AAMMDD → YYYY-MM-DD (asumimos siglo 20 si yy >= 80, 21 en otro caso)
  const yy = parseInt(s.slice(0, 2), 10);
  const mm = s.slice(2, 4);
  const dd = s.slice(4, 6);
  const yyyy = yy >= 80 ? 1900 + yy : 2000 + yy;
  return `${yyyy}-${mm}-${dd}`;
}

export function parseN43(content: string): ParseResult {
  const lines = content.split(/\r?\n/).filter((l) => l.length >= 80 || l.length > 0);
  const cuentas: BankAccount[] = [];
  let current: BankAccount | null = null;
  let currentMov: BankMovement | null = null;
  let totalMov = 0;

  for (const raw of lines) {
    const line = raw.padEnd(80, " ").slice(0, 80);
    const tipo = line.slice(0, 2);

    if (tipo === "11") {
      // Cabecera cuenta
      const banco = line.slice(2, 6);
      const oficina = line.slice(6, 10);
      const cuenta = line.slice(10, 20);
      const fechaDesde = fechaFromN43(line.slice(20, 26));
      const fechaHasta = fechaFromN43(line.slice(26, 32));
      const signoIni = line.slice(32, 33);
      const saldoIni = impFromN43(line.slice(33, 47), signoIni);
      const divisa = line.slice(47, 50);
      // IBAN ES + 2 dígitos control + 4 banco + 4 oficina + 2 DC + 10 cuenta
      const iban = `ES00${banco}${oficina}00${cuenta}`;
      current = {
        banco, oficina, cuenta, iban,
        fecha_desde: fechaDesde, fecha_hasta: fechaHasta,
        saldo_inicial: saldoIni, divisa, movimientos: [],
      };
      cuentas.push(current);
      currentMov = null;
    } else if (tipo === "22" && current) {
      // Movimiento
      const fechaOp = fechaFromN43(line.slice(10, 16));
      const fechaVal = fechaFromN43(line.slice(16, 22));
      const conceptoComun = line.slice(22, 26).trim();
      const signo = line.slice(27, 28);
      const importe = impFromN43(line.slice(28, 42), signo);
      const ref1 = line.slice(52, 64).trim();
      const ref2 = line.slice(64, 80).trim();
      currentMov = {
        fecha_operacion: fechaOp,
        fecha_valor: fechaVal,
        importe,
        concepto_comun: CONCEPTOS_AEB[conceptoComun] ?? conceptoComun,
        concepto_propio: "",
        referencia1: ref1,
        referencia2: ref2,
      };
      current.movimientos.push(currentMov);
      totalMov++;
    } else if ((tipo === "23" || tipo === "24") && currentMov) {
      // Conceptos adicionales (2 líneas con texto libre)
      const txt = line.slice(4, 80).trim();
      currentMov.concepto_propio = (currentMov.concepto_propio + " " + txt).trim();
    } else if (tipo === "33" && current) {
      const signoFin = line.slice(40, 41);
      current.saldo_final = impFromN43(line.slice(41, 55), signoFin);
      currentMov = null;
    } else if (tipo === "88") {
      break;
    }
  }

  return {
    ok: cuentas.length > 0,
    cuentas,
    error: cuentas.length === 0 ? "El fichero no contiene registros de cuenta tipo 11." : undefined,
    total_movimientos: totalMov,
  };
}

// Códigos AEB de conceptos comunes (subset clave)
const CONCEPTOS_AEB: Record<string, string> = {
  "01": "Talones / cheques",
  "02": "Abono de cheques",
  "03": "Domiciliación de recibos",
  "04": "Giros / transferencias",
  "05": "Amortizaciones de préstamos, créditos",
  "06": "Remesas de efectos",
  "07": "Suscripciones",
  "08": "Operaciones con extranjero",
  "09": "Compras y ventas de valores",
  "10": "Cheques gasolina",
  "11": "Cajeros automáticos",
  "12": "Tarjetas de crédito y debito",
  "13": "Operaciones por correspondencia",
  "14": "Transferencias",
  "15": "Nóminas / pensiones",
  "16": "Timbres / pólizas / corretajes",
  "17": "Intereses / comisiones / custodia",
  "98": "Anulaciones",
  "99": "Otros conceptos",
};
