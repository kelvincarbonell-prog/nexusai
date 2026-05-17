/**
 * Plantillas de asientos contables predefinidos para operaciones recurrentes.
 * El gestor selecciona la plantilla, rellena los importes y se genera el
 * asiento en el diario con un clic.
 */

export type AsientoInput = {
  name: string;
  label: string;
  type: "currency" | "number" | "text" | "date" | "percent";
  required?: boolean;
  placeholder?: string;
  defaultValue?: number | string;
};

export type LineaPlantilla = {
  /** Código PGC. Soporta sustitución {var} desde inputs. */
  accountCode: string;
  /** Descripción de la línea (también soporta {var}). */
  description: string;
  /** Fórmula simple: "{bruto}", "{bruto} - {irpf} - {ss}", etc. Resuelto en runtime. */
  debit?: string;
  credit?: string;
};

export type AsientoPlantilla = {
  id: string;
  category: "nominas" | "iva_irpf" | "amortizaciones" | "prestamos" | "otros";
  icon: string;        // lucide icon name
  title: string;
  description: string;
  inputs: AsientoInput[];
  lineas: LineaPlantilla[];
  /** Default descripción del asiento. Soporta {var}. */
  descripcionAsiento: string;
};

export const PLANTILLAS: AsientoPlantilla[] = [
  // ============================================================
  // NÓMINAS
  // ============================================================
  {
    id: "nomina-mensual",
    category: "nominas",
    icon: "Banknote",
    title: "Nómina mensual",
    description: "Contabilización de la nómina del mes: salario bruto, retención IRPF, SS trabajador, SS empresa.",
    inputs: [
      { name: "trabajador", label: "Trabajador", type: "text", required: true, placeholder: "Carlos Ruiz" },
      { name: "periodo", label: "Periodo (YYYY-MM)", type: "text", required: true, placeholder: "2026-05" },
      { name: "bruto", label: "Salario bruto", type: "currency", required: true, defaultValue: 2000 },
      { name: "irpf", label: "Retención IRPF", type: "currency", required: true, defaultValue: 240 },
      { name: "ss_trabajador", label: "SS a cargo del trabajador", type: "currency", required: true, defaultValue: 127 },
      { name: "ss_empresa", label: "SS a cargo de la empresa", type: "currency", required: true, defaultValue: 624 },
    ],
    descripcionAsiento: "Nómina {trabajador} · {periodo}",
    lineas: [
      { accountCode: "640", description: "Sueldos y salarios {trabajador}", debit: "{bruto}" },
      { accountCode: "642", description: "SS a cargo empresa {trabajador}", debit: "{ss_empresa}" },
      { accountCode: "4751", description: "IRPF retenido {trabajador}", credit: "{irpf}" },
      { accountCode: "476", description: "SS trabajador + empresa {trabajador}", credit: "{ss_trabajador} + {ss_empresa}" },
      { accountCode: "572", description: "Pago neto a {trabajador}", credit: "{bruto} - {irpf} - {ss_trabajador}" },
    ],
  },

  // ============================================================
  // IVA + IRPF
  // ============================================================
  {
    id: "liquidacion-iva-trimestral",
    category: "iva_irpf",
    icon: "Calculator",
    title: "Liquidación IVA trimestral (303)",
    description: "Compensa el IVA repercutido con el soportado del trimestre y registra el saldo a ingresar/devolver.",
    inputs: [
      { name: "periodo", label: "Periodo (1T 2026, etc.)", type: "text", required: true, placeholder: "1T 2026" },
      { name: "iva_repercutido", label: "IVA repercutido (cuenta 477)", type: "currency", required: true, defaultValue: 0 },
      { name: "iva_soportado", label: "IVA soportado (cuenta 472)", type: "currency", required: true, defaultValue: 0 },
    ],
    descripcionAsiento: "Liquidación IVA {periodo}",
    lineas: [
      { accountCode: "477", description: "Cancelación IVA repercutido {periodo}", debit: "{iva_repercutido}" },
      { accountCode: "472", description: "Cancelación IVA soportado {periodo}", credit: "{iva_soportado}" },
      { accountCode: "4750", description: "HP acreedora IVA {periodo}", credit: "{iva_repercutido} - {iva_soportado}" },
    ],
  },
  {
    id: "pago-iva-303",
    category: "iva_irpf",
    icon: "Receipt",
    title: "Pago modelo 303",
    description: "Pago a Hacienda del IVA liquidado.",
    inputs: [
      { name: "periodo", label: "Periodo", type: "text", required: true, placeholder: "1T 2026" },
      { name: "importe", label: "Importe pagado", type: "currency", required: true, defaultValue: 0 },
    ],
    descripcionAsiento: "Pago 303 {periodo}",
    lineas: [
      { accountCode: "4750", description: "Cancelación HP acreedora IVA {periodo}", debit: "{importe}" },
      { accountCode: "572", description: "Pago Modelo 303 {periodo}", credit: "{importe}" },
    ],
  },
  {
    id: "pago-irpf-111",
    category: "iva_irpf",
    icon: "FileText",
    title: "Pago modelo 111 retenciones IRPF",
    description: "Pago a Hacienda de las retenciones IRPF trabajadores/profesionales del trimestre.",
    inputs: [
      { name: "periodo", label: "Periodo", type: "text", required: true, placeholder: "1T 2026" },
      { name: "importe", label: "Importe pagado", type: "currency", required: true, defaultValue: 0 },
    ],
    descripcionAsiento: "Pago 111 retenciones IRPF {periodo}",
    lineas: [
      { accountCode: "4751", description: "Cancelación HP IRPF retenido {periodo}", debit: "{importe}" },
      { accountCode: "572", description: "Pago Modelo 111 {periodo}", credit: "{importe}" },
    ],
  },
  {
    id: "pago-fraccionado-130",
    category: "iva_irpf",
    icon: "Percent",
    title: "Pago fraccionado autónomo (130)",
    description: "Ingreso del 20% del rendimiento neto del trimestre.",
    inputs: [
      { name: "periodo", label: "Periodo", type: "text", required: true, placeholder: "1T 2026" },
      { name: "importe", label: "Importe pago", type: "currency", required: true, defaultValue: 0 },
    ],
    descripcionAsiento: "Pago fraccionado 130 {periodo}",
    lineas: [
      { accountCode: "473", description: "HP retenciones y pagos a cuenta {periodo}", debit: "{importe}" },
      { accountCode: "572", description: "Pago Modelo 130 {periodo}", credit: "{importe}" },
    ],
  },

  // ============================================================
  // AMORTIZACIONES
  // ============================================================
  {
    id: "amortizacion-mensual",
    category: "amortizaciones",
    icon: "TrendingDown",
    title: "Amortización mensual inmovilizado",
    description: "Dotación a la amortización del inmovilizado material (mobiliario, equipos, vehículos).",
    inputs: [
      { name: "elemento", label: "Elemento", type: "text", required: true, placeholder: "Mobiliario oficina" },
      { name: "mes", label: "Mes (YYYY-MM)", type: "text", required: true, placeholder: "2026-05" },
      { name: "importe", label: "Cuota amortización mensual", type: "currency", required: true, defaultValue: 0 },
      { name: "cuenta_inmovilizado", label: "Cuenta inmovilizado (216, 217, 218…)", type: "text", required: true, defaultValue: "216" },
      { name: "cuenta_amortizacion_acumulada", label: "Cuenta amortización acumulada", type: "text", required: true, defaultValue: "2816" },
    ],
    descripcionAsiento: "Amortización {elemento} · {mes}",
    lineas: [
      { accountCode: "681", description: "Dotación amortización {elemento} {mes}", debit: "{importe}" },
      { accountCode: "{cuenta_amortizacion_acumulada}", description: "Amortización acumulada {elemento}", credit: "{importe}" },
    ],
  },

  // ============================================================
  // PRÉSTAMOS
  // ============================================================
  {
    id: "amortizacion-prestamo",
    category: "prestamos",
    icon: "Landmark",
    title: "Cuota préstamo bancario",
    description: "Pago mensual de cuota: amortiza principal + paga intereses.",
    inputs: [
      { name: "prestamo", label: "Préstamo", type: "text", required: true, placeholder: "Préstamo 50.000 €" },
      { name: "mes", label: "Mes", type: "text", required: true, placeholder: "2026-05" },
      { name: "amortizacion", label: "Amortización principal", type: "currency", required: true, defaultValue: 0 },
      { name: "intereses", label: "Intereses pagados", type: "currency", required: true, defaultValue: 0 },
    ],
    descripcionAsiento: "Cuota {prestamo} · {mes}",
    lineas: [
      { accountCode: "170", description: "Amortización principal {prestamo}", debit: "{amortizacion}" },
      { accountCode: "662", description: "Intereses {prestamo} {mes}", debit: "{intereses}" },
      { accountCode: "572", description: "Pago cuota {prestamo} {mes}", credit: "{amortizacion} + {intereses}" },
    ],
  },

  // ============================================================
  // OTROS
  // ============================================================
  {
    id: "cobro-cliente",
    category: "otros",
    icon: "ArrowDownLeft",
    title: "Cobro de cliente",
    description: "Registra el cobro de una factura emitida (cliente paga).",
    inputs: [
      { name: "cliente", label: "Cliente", type: "text", required: true, placeholder: "Innova S.L." },
      { name: "factura", label: "Factura", type: "text", placeholder: "FAC-0001" },
      { name: "importe", label: "Importe cobrado", type: "currency", required: true, defaultValue: 0 },
    ],
    descripcionAsiento: "Cobro {cliente} · {factura}",
    lineas: [
      { accountCode: "572", description: "Cobro {cliente} {factura}", debit: "{importe}" },
      { accountCode: "430", description: "Cancelación deuda {cliente}", credit: "{importe}" },
    ],
  },
  {
    id: "pago-proveedor",
    category: "otros",
    icon: "ArrowUpRight",
    title: "Pago a proveedor",
    description: "Registra el pago de una factura recibida.",
    inputs: [
      { name: "proveedor", label: "Proveedor", type: "text", required: true, placeholder: "Movistar" },
      { name: "factura", label: "Factura", type: "text", placeholder: "F-2026-001" },
      { name: "importe", label: "Importe pagado", type: "currency", required: true, defaultValue: 0 },
    ],
    descripcionAsiento: "Pago {proveedor} · {factura}",
    lineas: [
      { accountCode: "410", description: "Cancelación deuda {proveedor}", debit: "{importe}" },
      { accountCode: "572", description: "Pago {proveedor} {factura}", credit: "{importe}" },
    ],
  },
];

/**
 * Resuelve una fórmula tipo "{a} + {b} - {c}" sustituyendo los valores
 * del map de inputs y evaluando la suma/resta.
 */
export function resolveFormula(formula: string, inputs: Record<string, string | number>): number {
  let resolved = formula;
  for (const [k, v] of Object.entries(inputs)) {
    resolved = resolved.replace(new RegExp(`\\{${k}\\}`, "g"), String(Number(v) || 0));
  }
  // Evalúa solo si quedan + - y números/decimales — no inyectable.
  const safe = resolved.replace(/[^0-9.+\-\s]/g, "");
  if (!safe) return 0;
  try {
    // Suma/resta sin alegrías
    const tokens = safe.replace(/\s/g, "").split(/(?=[+\-])/);
    return tokens.reduce((acc, t) => acc + Number(t), 0);
  } catch {
    return 0;
  }
}

export function resolveTemplate(s: string, inputs: Record<string, string | number>): string {
  let out = s;
  for (const [k, v] of Object.entries(inputs)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v ?? ""));
  }
  return out;
}

export function getPlantilla(id: string): AsientoPlantilla | undefined {
  return PLANTILLAS.find((p) => p.id === id);
}

export function plantillasByCategory(): Record<AsientoPlantilla["category"], AsientoPlantilla[]> {
  const grouped: Record<AsientoPlantilla["category"], AsientoPlantilla[]> = {
    nominas: [], iva_irpf: [], amortizaciones: [], prestamos: [], otros: [],
  };
  for (const p of PLANTILLAS) grouped[p.category].push(p);
  return grouped;
}
