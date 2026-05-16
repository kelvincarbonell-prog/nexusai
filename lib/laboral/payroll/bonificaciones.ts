/**
 * Bonificaciones de Seguridad Social — descuentos sobre la cuota empresarial.
 * Datos 2026. Cifras orientativas según RD-Ley y leyes de empleo.
 */

export type BonificacionInput = {
  edad: number;
  fecha_alta: string;             // YYYY-MM-DD
  tipo_contrato: string;
  genero?: "M" | "F";
  discapacidad_pct?: number;
  victima_violencia?: boolean;
  parado_larga_duracion?: boolean;
  primer_empleo_joven?: boolean;
  zona_rural_despoblada?: boolean;
  emprendedor_autonomo?: boolean;
};

export type BonificacionAplicada = {
  codigo: string;
  nombre: string;
  importe_anual: number;
  duracion_meses: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function calcularBonificaciones(input: BonificacionInput): BonificacionAplicada[] {
  const bonis: BonificacionAplicada[] = [];

  // Discapacidad ≥ 33 %
  if (input.discapacidad_pct && input.discapacidad_pct >= 33) {
    const severa = input.discapacidad_pct >= 65;
    bonis.push({
      codigo: "DISC",
      nombre: `Trabajador con discapacidad${severa ? " severa" : ""}`,
      importe_anual: severa ? 6300 : 4500,
      duracion_meses: 999, // indefinida mientras dure el contrato
    });
  }

  // Mujer víctima de violencia de género
  if (input.victima_violencia) {
    bonis.push({
      codigo: "VVG",
      nombre: "Víctima violencia de género o doméstica",
      importe_anual: 1500,
      duracion_meses: 48,
    });
  }

  // Primer empleo joven (<30 años, contrato indefinido)
  const isIndefinido = input.tipo_contrato.toLowerCase().includes("indefinido");
  if (input.primer_empleo_joven && input.edad < 30 && isIndefinido) {
    bonis.push({
      codigo: "JOVEN",
      nombre: "Primer empleo joven < 30 años",
      importe_anual: 500,
      duracion_meses: 12,
    });
  }

  // Parado de larga duración
  if (input.parado_larga_duracion && isIndefinido) {
    bonis.push({
      codigo: "PLD",
      nombre: "Parado de larga duración",
      importe_anual: input.edad >= 45 ? 1500 : 1300,
      duracion_meses: 36,
    });
  }

  // Mayor de 45 años con contrato indefinido
  if (input.edad >= 45 && isIndefinido && !input.parado_larga_duracion) {
    bonis.push({
      codigo: "M45",
      nombre: "Trabajador mayor de 45 años",
      importe_anual: 1300,
      duracion_meses: 36,
    });
  }

  // Zona rural despoblada (Reto Demográfico)
  if (input.zona_rural_despoblada && isIndefinido) {
    bonis.push({
      codigo: "RURAL",
      nombre: "Contratación en zona rural despoblada",
      importe_anual: 1200,
      duracion_meses: 36,
    });
  }

  // Formación / prácticas
  if (input.tipo_contrato === "formacion") {
    bonis.push({
      codigo: "FORM",
      nombre: "Contrato de formación en alternancia",
      importe_anual: 1650, // reducción 100 % cuotas empresariales hasta cierto tope
      duracion_meses: 24,
    });
  }
  if (input.tipo_contrato === "practicas") {
    bonis.push({
      codigo: "PRACT",
      nombre: "Contrato formativo prácticas",
      importe_anual: 825,
      duracion_meses: 36,
    });
  }

  return bonis.map((b) => ({ ...b, importe_anual: round2(b.importe_anual) }));
}
