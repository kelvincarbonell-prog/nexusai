/**
 * Modelo 720 — Declaración informativa sobre bienes y derechos situados
 * en el extranjero. Anual, presentación: enero–marzo.
 *
 * Obligatorio cuando se supera 50.000 € por bloque:
 *   - Cuentas en entidades financieras extranjeras
 *   - Valores, derechos, seguros y rentas
 *   - Bienes inmuebles en el extranjero
 *
 * No es a ingresar (informativo). Sanciones por no declarar limitadas
 * tras STJUE 2022 (eliminadas las desproporcionadas).
 */

export type BienExtranjero = {
  tipo: "cuenta" | "valor" | "inmueble";
  pais: string;
  identificacion: string;
  titularidad_pct: number;
  valor: number;             // saldo a 31/12 o valor de adquisición
  fecha_apertura?: string;
};

const UMBRAL = 50_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

export type Casillas720 = {
  cuentas_num: number;
  cuentas_valor: number;
  valores_num: number;
  valores_valor: number;
  inmuebles_num: number;
  inmuebles_valor: number;
  total_bloques_obligados: number;
};

export function calcular720(input: { bienes: BienExtranjero[] }): {
  casillas: Casillas720;
  warnings: string[];
  bloques: { tipo: string; obligado: boolean; valor: number; num: number }[];
} {
  const warnings: string[] = [];
  const bloques: { tipo: string; obligado: boolean; valor: number; num: number }[] = [];

  const cuentas = input.bienes.filter((b) => b.tipo === "cuenta");
  const valores = input.bienes.filter((b) => b.tipo === "valor");
  const inmuebles = input.bienes.filter((b) => b.tipo === "inmueble");

  const calcular = (lista: BienExtranjero[]) => {
    const valor = lista.reduce((s, b) => s + (Number(b.valor) * Number(b.titularidad_pct ?? 100)) / 100, 0);
    return { valor: round2(valor), num: lista.length, obligado: valor >= UMBRAL };
  };

  const bCuentas = calcular(cuentas);
  const bValores = calcular(valores);
  const bInmuebles = calcular(inmuebles);

  bloques.push({ tipo: "Cuentas extranjeras", ...bCuentas });
  bloques.push({ tipo: "Valores/derechos", ...bValores });
  bloques.push({ tipo: "Inmuebles extranjeros", ...bInmuebles });

  const obligados = bloques.filter((b) => b.obligado).length;
  if (obligados === 0) {
    warnings.push("Ningún bloque supera los 50.000 €. NO existe obligación de presentar el 720 este año.");
  }

  return {
    casillas: {
      cuentas_num: bCuentas.num,
      cuentas_valor: bCuentas.valor,
      valores_num: bValores.num,
      valores_valor: bValores.valor,
      inmuebles_num: bInmuebles.num,
      inmuebles_valor: bInmuebles.valor,
      total_bloques_obligados: obligados,
    },
    warnings,
    bloques,
  };
}
