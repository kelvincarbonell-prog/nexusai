/**
 * Exportadores de asientos contables al formato de los principales programas
 * usados en España: A3CON, Contasol y SAGE 50. Permite migrar a/desde M26.
 *
 * Cada formato es CSV/TXT con su propia estructura. Usamos punto y coma como
 * separador estándar en España, importes con coma decimal y fechas dd/mm/yyyy.
 */

export type AsientoLinea = {
  entry_number: number | string;
  fecha: string;         // YYYY-MM-DD
  cuenta_pgc: string;    // p.ej. '430.001'
  descripcion: string;
  debe: number;
  haber: number;
  documento?: string;
  empresa_codigo?: string;
};

const formatDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
const numES = (n: number) => n.toFixed(2).replace(".", ",");
const escape = (s: string) => s.replace(/"/g, '""').replace(/[\r\n]+/g, " ").slice(0, 240);

/**
 * A3CON formato simplificado:
 * Asiento;Fecha;Cuenta;Concepto;Debe;Haber;Documento
 */
export function toA3con(lineas: AsientoLinea[]): string {
  const lines: string[] = ["Asiento;Fecha;Cuenta;Concepto;Debe;Haber;Documento"];
  for (const l of lineas) {
    lines.push([
      String(l.entry_number).padStart(6, "0"),
      formatDate(l.fecha),
      l.cuenta_pgc,
      `"${escape(l.descripcion)}"`,
      numES(l.debe),
      numES(l.haber),
      l.documento ?? "",
    ].join(";"));
  }
  return lines.join("\r\n") + "\r\n";
}

/**
 * Contasol formato de importación:
 * Empresa;Asiento;Fecha;Cuenta;Concepto;Debe;Haber;Documento
 */
export function toContasol(lineas: AsientoLinea[], empresaCodigo = "001"): string {
  const lines: string[] = ["Empresa;Asiento;Fecha;Cuenta;Concepto;Debe;Haber;Documento"];
  for (const l of lineas) {
    lines.push([
      l.empresa_codigo ?? empresaCodigo,
      String(l.entry_number).padStart(8, "0"),
      formatDate(l.fecha),
      l.cuenta_pgc,
      `"${escape(l.descripcion)}"`,
      numES(l.debe),
      numES(l.haber),
      l.documento ?? "",
    ].join(";"));
  }
  return lines.join("\r\n") + "\r\n";
}

/**
 * SAGE 50 formato típico de importación de diario:
 * Fecha,Asiento,Cuenta,Concepto,Debe,Haber,Documento
 * (coma como separador)
 */
export function toSage(lineas: AsientoLinea[]): string {
  const lines: string[] = ["Fecha,Asiento,Cuenta,Concepto,Debe,Haber,Documento"];
  for (const l of lineas) {
    lines.push([
      formatDate(l.fecha),
      String(l.entry_number),
      l.cuenta_pgc,
      `"${escape(l.descripcion)}"`,
      numES(l.debe),
      numES(l.haber),
      l.documento ?? "",
    ].join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
