/**
 * Match de datos extraídos de la factura con los datos de la empresa.
 *
 * Detecta facturas que NO corresponden a la empresa para que el gestor
 * las arregle manualmente o las borre antes de que entren en libros.
 */

export type EmpresaMatch = {
  nif: string | null | undefined;
  nombre: string | null | undefined;
};

export type DatosExtraidos = {
  vendor_name?: string | null;
  vendor_nif?: string | null;
  client_name?: string | null;
  client_nif?: string | null;
  total?: number | null;
  base?: number | null;
  iva?: number | null;
  issue_date?: string | null;
  [k: string]: unknown;
};

export type MatchResult = {
  ok: boolean;             // true si pasa los checks mínimos
  score: number;           // 0..100 confianza del match
  warnings: string[];      // problemas detectados
  /** Si la factura es de tipo gasto (recibida): empresa debería ser el cliente. */
  empresa_es_cliente: boolean | null;
};

// Normaliza un NIF español para comparar
function normNif(s: string | null | undefined): string {
  return (s ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

// Similaridad simple de strings (case-insensitive, sin tildes ni puntuación)
function normName(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jaccard(a: string, b: string): number {
  if (!a || !b) return 0;
  const sa = new Set(a.split(" ").filter((t) => t.length > 2));
  const sb = new Set(b.split(" ").filter((t) => t.length > 2));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

/**
 * Comprueba si los datos extraídos corresponden a la empresa.
 * Reglas:
 *   - Si la factura es RECIBIDA (proveedor → empresa), empresa debería aparecer
 *     como CLIENT_NIF o CLIENT_NAME en el ticket.
 *   - Si es EMITIDA (empresa → cliente), empresa debería aparecer como VENDOR_NIF.
 *   - Si no encontramos el NIF de la empresa en ningún lado, warning bloqueante.
 */
export function matchFacturaEmpresa(datos: DatosExtraidos, empresa: EmpresaMatch): MatchResult {
  const warnings: string[] = [];
  let score = 100;
  const empresaNif = normNif(empresa.nif);
  const empresaNombre = normName(empresa.nombre);
  const vendorNif = normNif(datos.vendor_nif);
  const clientNif = normNif(datos.client_nif);
  const vendorName = normName(datos.vendor_name);
  const clientName = normName(datos.client_name);

  // 1. ¿Aparece el NIF de la empresa en algún sitio?
  let empresaEsCliente: boolean | null = null;
  if (empresaNif) {
    if (clientNif === empresaNif) empresaEsCliente = true;
    else if (vendorNif === empresaNif) empresaEsCliente = false;
    else {
      // Comparación parcial: a veces el OCR captura mal una letra
      const matchClient = clientNif && empresaNif.length > 5 && clientNif.includes(empresaNif.slice(-7));
      const matchVendor = vendorNif && empresaNif.length > 5 && vendorNif.includes(empresaNif.slice(-7));
      if (matchClient) { empresaEsCliente = true; score -= 10; warnings.push("NIF empresa coincide parcialmente como cliente — verifica."); }
      else if (matchVendor) { empresaEsCliente = false; score -= 10; warnings.push("NIF empresa coincide parcialmente como emisor — verifica."); }
      else {
        warnings.push(`El NIF de la empresa (${empresa.nif}) no aparece en la factura. Posible factura de otro destinatario.`);
        score -= 50;
      }
    }
  } else {
    warnings.push("La empresa no tiene NIF configurado: no se puede validar el matching.");
    score -= 20;
  }

  // 2. ¿Coincide el nombre de la empresa?
  if (empresaNombre && empresaEsCliente !== null) {
    const compararContra = empresaEsCliente ? clientName : vendorName;
    const sim = jaccard(empresaNombre, compararContra);
    if (sim < 0.3) {
      warnings.push(`El nombre del ${empresaEsCliente ? "cliente" : "emisor"} en la factura no parece coincidir con "${empresa.nombre}".`);
      score -= 15;
    }
  }

  // 3. ¿Totales razonables?
  const total = Number(datos.total ?? 0);
  const base = Number(datos.base ?? 0);
  const iva = Number(datos.iva ?? 0);
  if (total > 0 && base > 0 && iva >= 0) {
    const diff = Math.abs(total - (base + iva));
    if (diff > Math.max(1, total * 0.02)) {
      warnings.push(`Descuadre en importes: total ${total.toFixed(2)} ≠ base+IVA ${(base + iva).toFixed(2)}.`);
      score -= 10;
    }
  } else if (!total) {
    warnings.push("No se ha podido extraer el total de la factura.");
    score -= 30;
  }

  return {
    ok: score >= 60 && empresaEsCliente !== null,
    score: Math.max(0, Math.min(100, score)),
    warnings,
    empresa_es_cliente: empresaEsCliente,
  };
}
