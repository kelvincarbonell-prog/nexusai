/**
 * Validación de NIF/NIE/CIF español y comprobaciones de coherencia
 * para declaraciones AEAT.
 */

const NIF_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

export function validateNif(raw: string | null | undefined): { ok: boolean; tipo?: "DNI" | "NIE" | "CIF"; reason?: string } {
  if (!raw) return { ok: false, reason: "NIF vacío" };
  const nif = raw.toUpperCase().replace(/\s|-/g, "");
  if (!/^[A-Z0-9]{9}$/.test(nif)) return { ok: false, reason: "Formato inválido" };

  // DNI: 8 dígitos + letra
  if (/^\d{8}[A-Z]$/.test(nif)) {
    const num = Number(nif.slice(0, 8));
    const expected = NIF_LETTERS[num % 23];
    if (expected !== nif[8]) return { ok: false, tipo: "DNI", reason: "Letra de control incorrecta" };
    return { ok: true, tipo: "DNI" };
  }
  // NIE: X/Y/Z + 7 dígitos + letra
  if (/^[XYZ]\d{7}[A-Z]$/.test(nif)) {
    const prefix = { X: "0", Y: "1", Z: "2" }[nif[0] as "X" | "Y" | "Z"];
    const num = Number(prefix + nif.slice(1, 8));
    const expected = NIF_LETTERS[num % 23];
    if (expected !== nif[8]) return { ok: false, tipo: "NIE", reason: "Letra de control incorrecta" };
    return { ok: true, tipo: "NIE" };
  }
  // CIF: letra + 7 dígitos + dígito o letra
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(nif)) {
    const digits = nif.slice(1, 8);
    let sumPair = 0, sumOdd = 0;
    for (let i = 0; i < digits.length; i++) {
      const d = Number(digits[i]);
      if (i % 2 === 0) {
        const doubled = d * 2;
        sumOdd += Math.floor(doubled / 10) + (doubled % 10);
      } else {
        sumPair += d;
      }
    }
    const control = (10 - ((sumPair + sumOdd) % 10)) % 10;
    const last = nif[8];
    const lettersCif = "JABCDEFGHI";
    const validNum = String(control);
    const validLetter = lettersCif[control];
    if (last === validNum || last === validLetter) return { ok: true, tipo: "CIF" };
    return { ok: false, tipo: "CIF", reason: "Dígito de control incorrecto" };
  }
  return { ok: false, reason: "Formato no reconocido (DNI/NIE/CIF)" };
}

export function checkCasillaCoherencia(
  base: number,
  cuota: number,
  pct: number,
  tolerance = 0.05,
): { ok: boolean; delta?: number } {
  const expected = Math.round(base * pct) / 100;
  const delta = Math.abs(expected - cuota);
  return { ok: delta <= tolerance, delta };
}
