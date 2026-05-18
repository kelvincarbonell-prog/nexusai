/**
 * Validaciones y normalizaciones para identificadores españoles.
 *
 * - NIF (DNI) personas físicas: 8 dígitos + letra (módulo 23)
 * - NIE: X/Y/Z + 7 dígitos + letra
 * - CIF: letra + 7 dígitos + dígito control (varias reglas)
 * - IBAN: módulo 97 estándar IBAN
 * - CCC (cuenta cotización SS): 11 dígitos (régimen + provincia + correlativo + control)
 */

const NIF_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

export function validarNIF(nif: string): { ok: boolean; tipo: "dni" | "nie" | "cif" | null; razon?: string } {
  if (!nif) return { ok: false, tipo: null, razon: "Vacío" };
  const v = nif.toUpperCase().replace(/[^A-Z0-9]/g, "");

  // DNI: 8 dígitos + letra
  if (/^\d{8}[A-Z]$/.test(v)) {
    const num = Number(v.slice(0, 8));
    const expected = NIF_LETTERS[num % 23];
    return { ok: v[8] === expected, tipo: "dni", razon: v[8] === expected ? undefined : `Letra incorrecta, debería ser ${expected}` };
  }
  // NIE: X/Y/Z + 7 dígitos + letra
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    const map: Record<string, string> = { X: "0", Y: "1", Z: "2" };
    const num = Number(map[v[0]] + v.slice(1, 8));
    const expected = NIF_LETTERS[num % 23];
    return { ok: v[8] === expected, tipo: "nie", razon: v[8] === expected ? undefined : `Letra incorrecta, debería ser ${expected}` };
  }
  // CIF: letra + 7 dígitos + dígito/letra de control
  if (/^[ABCDEFGHJKLMNPQRSUVW]\d{7}[A-J0-9]$/.test(v)) {
    const letter = v[0];
    const nums = v.slice(1, 8);
    let suma = 0;
    for (let i = 0; i < 7; i++) {
      const d = Number(nums[i]);
      if (i % 2 === 0) {
        const doble = (d * 2).toString();
        suma += Number(doble[0]) + (doble.length > 1 ? Number(doble[1]) : 0);
      } else {
        suma += d;
      }
    }
    const control = (10 - (suma % 10)) % 10;
    const letterCtrl = "JABCDEFGHI"[control];
    const ctrlChar = v[8];
    // Para letras KQPNRSW el control debe ser letra; para A/B/E/H debe ser número; resto, cualquiera
    const requiereLetra = "KPQSNW".includes(letter);
    const requiereNumero = "ABEH".includes(letter);
    const okLetra = ctrlChar === letterCtrl;
    const okNumero = ctrlChar === String(control);
    const ok = requiereLetra ? okLetra : requiereNumero ? okNumero : (okLetra || okNumero);
    return { ok, tipo: "cif", razon: ok ? undefined : `Control incorrecto, debería ser ${requiereLetra ? letterCtrl : control}` };
  }
  return { ok: false, tipo: null, razon: "Formato no reconocido (no es DNI/NIE/CIF)" };
}

export function validarIBAN(iban: string): { ok: boolean; razon?: string } {
  if (!iban) return { ok: false, razon: "Vacío" };
  const v = iban.toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(v)) return { ok: false, razon: "Formato inválido" };
  if (v.startsWith("ES") && v.length !== 24) return { ok: false, razon: "IBAN español debe tener 24 caracteres" };

  // Módulo 97 IBAN: rotar 4 chars al final y convertir letras a números (A=10..Z=35)
  const rearranged = v.slice(4) + v.slice(0, 4);
  let acumulado = "";
  for (const c of rearranged) {
    acumulado += /[A-Z]/.test(c) ? (c.charCodeAt(0) - 55).toString() : c;
  }
  // Cálculo módulo 97 sobre string largo
  let resto = 0;
  for (const d of acumulado) {
    resto = (resto * 10 + Number(d)) % 97;
  }
  return resto === 1 ? { ok: true } : { ok: false, razon: "Dígitos de control IBAN incorrectos" };
}

export function validarCCC(ccc: string): { ok: boolean; razon?: string } {
  if (!ccc) return { ok: false, razon: "Vacío" };
  const v = ccc.replace(/[^0-9]/g, "");
  if (v.length < 11 || v.length > 15) {
    return { ok: false, razon: "CCC debe tener entre 11 y 15 dígitos (régimen + provincia + nº)" };
  }
  // El régimen son los primeros 4 dígitos, provincia siguientes 2, el resto secuencia + control(es)
  // Validación básica: provincia 01-52
  const prov = Number(v.slice(4, 6));
  if (prov < 1 || prov > 52) return { ok: false, razon: `Código de provincia ${prov} fuera de rango 01-52` };
  return { ok: true };
}

/** Limpia y formatea IBAN como ES00 0000 0000 00 0000000000 */
export function formatearIBAN(iban: string): string {
  const v = iban.toUpperCase().replace(/\s+/g, "");
  return v.replace(/(.{4})/g, "$1 ").trim();
}

/** Detecta el tipo de identificador sin validar exhaustivamente. */
export function detectarTipoNIF(v: string): "dni" | "nie" | "cif" | "unknown" {
  const x = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (/^\d{8}[A-Z]$/.test(x)) return "dni";
  if (/^[XYZ]\d{7}[A-Z]$/.test(x)) return "nie";
  if (/^[A-Z]\d{8}$/.test(x)) return "cif";
  return "unknown";
}
