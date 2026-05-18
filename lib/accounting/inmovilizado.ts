/**
 * Cálculo de amortización del inmovilizado (PGC PYMES).
 *
 * Métodos soportados:
 *   - lineal: cuota = (precio_adquisicion - valor_residual) / vida_util_anyos
 *   - degresivo simple: aplica % anual a valor neto contable cada año
 *
 * Tablas oficiales (RD 1777/2004, abreviadas):
 *   - Mobiliario: 10% lineal, 20 años máx
 *   - Equipos informáticos: 25% lineal, 8 años máx
 *   - Software: 33% lineal, 6 años máx
 *   - Vehículos turismos: 16% lineal, 14 años máx
 *   - Vehículos transporte: 20% lineal, 10 años máx
 *   - Maquinaria: 12% lineal, 18 años máx
 *   - Construcciones (excepto suelo): 3% lineal, 68 años máx
 *   - Instalaciones técnicas: 10% lineal, 20 años máx
 */

export type TipoInmovilizado =
  | "mobiliario"
  | "equipo_informatico"
  | "software"
  | "vehiculo_turismo"
  | "vehiculo_transporte"
  | "maquinaria"
  | "construccion"
  | "instalacion_tecnica"
  | "otro";

export const TABLAS_AMORTIZACION: Record<TipoInmovilizado, { coef_max: number; anyos_max: number; cuenta_inmov: string; cuenta_am_acum: string; cuenta_dotacion: string }> = {
  mobiliario:         { coef_max: 10, anyos_max: 20, cuenta_inmov: "216", cuenta_am_acum: "2816", cuenta_dotacion: "681" },
  equipo_informatico: { coef_max: 25, anyos_max: 8,  cuenta_inmov: "217", cuenta_am_acum: "2817", cuenta_dotacion: "681" },
  software:           { coef_max: 33, anyos_max: 6,  cuenta_inmov: "206", cuenta_am_acum: "2806", cuenta_dotacion: "680" },
  vehiculo_turismo:   { coef_max: 16, anyos_max: 14, cuenta_inmov: "218", cuenta_am_acum: "2818", cuenta_dotacion: "681" },
  vehiculo_transporte:{ coef_max: 20, anyos_max: 10, cuenta_inmov: "218", cuenta_am_acum: "2818", cuenta_dotacion: "681" },
  maquinaria:         { coef_max: 12, anyos_max: 18, cuenta_inmov: "213", cuenta_am_acum: "2813", cuenta_dotacion: "681" },
  construccion:       { coef_max: 3,  anyos_max: 68, cuenta_inmov: "211", cuenta_am_acum: "2811", cuenta_dotacion: "681" },
  instalacion_tecnica:{ coef_max: 10, anyos_max: 20, cuenta_inmov: "212", cuenta_am_acum: "2812", cuenta_dotacion: "681" },
  otro:               { coef_max: 10, anyos_max: 20, cuenta_inmov: "219", cuenta_am_acum: "2819", cuenta_dotacion: "681" },
};

export type AmortInput = {
  precio_adquisicion: number;
  valor_residual?: number;
  fecha_alta: string;        // YYYY-MM-DD
  vida_util_anyos: number;
  metodo?: "lineal" | "degresivo";
  porcentaje_degresivo?: number; // si degresivo
};

export type CuadroAmort = Array<{
  anyo: number;
  fecha_dotacion: string;
  cuota: number;
  amortizacion_acumulada: number;
  valor_neto_contable: number;
}>;

export function generarCuadroAmortizacion(input: AmortInput): CuadroAmort {
  const residual = Math.max(0, input.valor_residual ?? 0);
  const baseAmortizable = Math.max(0, input.precio_adquisicion - residual);
  const vida = Math.max(1, input.vida_util_anyos);
  const metodo = input.metodo ?? "lineal";
  const yearAlta = Number(input.fecha_alta.slice(0, 4));

  const cuadro: CuadroAmort = [];

  if (metodo === "lineal") {
    const cuotaAnual = Math.round((baseAmortizable / vida) * 100) / 100;
    let acumulada = 0;
    for (let i = 0; i < vida; i++) {
      const anyo = yearAlta + i;
      const cuota = i === vida - 1 ? Math.round((baseAmortizable - acumulada) * 100) / 100 : cuotaAnual;
      acumulada += cuota;
      cuadro.push({
        anyo,
        fecha_dotacion: `${anyo}-12-31`,
        cuota,
        amortizacion_acumulada: Math.round(acumulada * 100) / 100,
        valor_neto_contable: Math.round((input.precio_adquisicion - acumulada) * 100) / 100,
      });
    }
  } else {
    const pct = (input.porcentaje_degresivo ?? 100 / vida * 2) / 100;
    let acumulada = 0;
    let vnc = input.precio_adquisicion;
    for (let i = 0; i < vida; i++) {
      const anyo = yearAlta + i;
      let cuota = Math.max(0, Math.min(vnc - residual, vnc * pct));
      if (i === vida - 1) cuota = Math.max(0, vnc - residual); // último año iguala
      cuota = Math.round(cuota * 100) / 100;
      acumulada += cuota;
      vnc = Math.round((vnc - cuota) * 100) / 100;
      cuadro.push({
        anyo,
        fecha_dotacion: `${anyo}-12-31`,
        cuota,
        amortizacion_acumulada: Math.round(acumulada * 100) / 100,
        valor_neto_contable: vnc,
      });
    }
  }

  return cuadro;
}
