import type { Casillas303 } from "@/lib/aeat/calc/m303";

/**
 * Generador de fichero AEAT en formato texto posicional para Modelo 303 (ej. 2026).
 * Importes con 2 decimales implícitos: 1.234,56 € → "000000123456".
 * Signos: " " para positivo, "N" para negativo en el campo de resultado.
 *
 * NOTA: La especificación oficial puede variar año a año. Esta es una versión
 *       resumida del MVP — antes de presentar oficialmente conviene validar con
 *       la última especificación publicada en la sede AEAT.
 */

export type Header303 = {
  nif: string;
  razon_social: string;
  ejercicio: number;
  periodo: "1T" | "2T" | "3T" | "4T";
  telefono?: string;
};

function padRight(s: string, len: number): string {
  return (s ?? "").slice(0, len).padEnd(len, " ");
}

function padLeft(s: string, len: number): string {
  return (s ?? "").slice(0, len).padStart(len, "0");
}

function impNum(value: number): string {
  // Casillas numéricas de 15 posiciones, 2 decimales implícitos, sin signo
  const cents = Math.round(value * 100);
  return padLeft(String(Math.abs(cents)), 15);
}

function impSigned(value: number): string {
  // 1 carácter de signo + 16 cifras (campos de resultado)
  const cents = Math.round(value * 100);
  const sign = cents < 0 ? "N" : " ";
  return sign + padLeft(String(Math.abs(cents)), 16);
}

const PERIOD_MAP: Record<string, string> = {
  "1T": "1T", "2T": "2T", "3T": "3T", "4T": "4T",
};

export function generateFicheroM303(header: Header303, casillas: Casillas303): string {
  const lines: string[] = [];

  // ===== Registro tipo 1 - Cabecera =====
  const tipo1 =
    "1" +                                  // tipo registro
    "303" +                                // modelo
    String(header.ejercicio) +             // ejercicio
    PERIOD_MAP[header.periodo] +           // periodo
    padRight(header.nif, 9) +              // NIF declarante
    padRight(header.razon_social, 80) +    // apellidos/razón social
    padRight(header.telefono ?? "", 9);    // teléfono

  lines.push(tipo1);

  // ===== Registro tipo 2 - Datos liquidación =====
  const tipo2Parts = [
    "2",                                   // tipo registro
    "303",                                 // modelo
    String(header.ejercicio),
    PERIOD_MAP[header.periodo],
    padRight(header.nif, 9),

    // IVA devengado régimen general
    impNum(casillas.c01), impNum(casillas.c02), impNum(casillas.c03),
    impNum(casillas.c04), impNum(casillas.c05), impNum(casillas.c06),
    impNum(casillas.c07), impNum(casillas.c08), impNum(casillas.c09),

    // Intracomunitarias
    impNum(casillas.c10), impNum(casillas.c11),
    // ISP
    impNum(casillas.c12), impNum(casillas.c13),
    // Modificación bases
    impNum(casillas.c14), impNum(casillas.c15),

    impNum(casillas.c27),                  // total devengado

    // IVA soportado
    impNum(casillas.c28), impNum(casillas.c29),
    impNum(casillas.c30), impNum(casillas.c31),
    impNum(casillas.c32), impNum(casillas.c33),
    impNum(casillas.c34), impNum(casillas.c35),
    impNum(casillas.c36), impNum(casillas.c37),
    impNum(casillas.c38), impNum(casillas.c39),
    impNum(casillas.c40), impNum(casillas.c41),

    impNum(casillas.c45),                  // total a deducir
    impSigned(casillas.c46),               // diferencia
    impSigned(casillas.c66),               // atribuible al Estado
    impNum(casillas.c69),                  // a compensar anteriores
    impNum(casillas.c70),                  // regularización anual
    impSigned(casillas.c71),               // resultado
  ];
  lines.push(tipo2Parts.join(""));

  return lines.join("\n") + "\n";
}

export function suggestFilenameM303(header: Header303): string {
  return `303_${header.ejercicio}${header.periodo}_${header.nif}.txt`;
}
