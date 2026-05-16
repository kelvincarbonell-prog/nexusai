/**
 * Catálogo de agentes especializados que pueden ejecutar acciones reales
 * sobre los endpoints de la plataforma. Cada agente define qué hace, qué
 * inputs necesita del gestor y a qué endpoint llama internamente.
 */

export type AgentInput = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "trabajador" | "modelo_aeat" | "periodo";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string | number;
};

export type AgentSpec = {
  id: string;
  category: "fiscal" | "laboral" | "facturacion" | "contabilidad" | "analisis";
  icon: string; // lucide icon name
  title: string;
  description: string;
  inputs: AgentInput[];
  /**
   * Acción a ejecutar. El runner lee este objeto y hace fetch al endpoint.
   * Los placeholders {input.X} se reemplazan por los valores que escribe el gestor.
   * Los placeholders {empresa_id} se sustituyen automáticamente.
   */
  action: {
    endpoint: string;        // p.ej. "/api/aeat/303"
    method: "GET" | "POST";
    body?: Record<string, unknown>;
    query?: Record<string, string>;
  };
  resultRenderer?: "casillas-aeat" | "nomina" | "finiquito" | "bonificaciones" | "json" | "lista" | "factura" | "calendario";
};

export const AGENT_CATALOG: AgentSpec[] = [
  // ============================================================
  // FISCALES
  // ============================================================
  {
    id: "fiscal-calcular-modelo",
    category: "fiscal",
    icon: "Calculator",
    title: "Calcular modelo AEAT",
    description: "Calcula el borrador de cualquier modelo trimestral (303, 111, 115, 130, 123, 349…) con datos reales de facturas y gastos.",
    inputs: [
      {
        name: "modelo",
        label: "Modelo",
        type: "select",
        required: true,
        defaultValue: "303",
        options: [
          { value: "303", label: "303 · IVA trimestral" },
          { value: "111", label: "111 · Retenciones IRPF" },
          { value: "115", label: "115 · Retenciones alquileres" },
          { value: "130", label: "130 · Pago fraccionado autónomos" },
          { value: "123", label: "123 · Retenciones capital mobiliario" },
          { value: "349", label: "349 · Operaciones intracomunitarias" },
          { value: "309", label: "309 · IVA no periódico" },
        ],
      },
      { name: "ejercicio", label: "Ejercicio", type: "number", required: true, defaultValue: new Date().getUTCFullYear() },
      {
        name: "periodo",
        label: "Periodo",
        type: "select",
        required: true,
        defaultValue: `${Math.ceil((new Date().getUTCMonth() + 1) / 3)}T`,
        options: [
          { value: "1T", label: "1T (ene-mar)" },
          { value: "2T", label: "2T (abr-jun)" },
          { value: "3T", label: "3T (jul-sep)" },
          { value: "4T", label: "4T (oct-dic)" },
        ],
      },
    ],
    action: {
      endpoint: "/api/aeat/{input.modelo}",
      method: "GET",
      query: { empresa_id: "{empresa_id}", ejercicio: "{input.ejercicio}", periodo: "{input.periodo}" },
    },
    resultRenderer: "casillas-aeat",
  },
  {
    id: "fiscal-presentar-modelo",
    category: "fiscal",
    icon: "FileCheck",
    title: "Marcar modelo como presentado",
    description: "Cierra el borrador y lo marca como presentado en AEAT, dejando trazabilidad con fecha y usuario.",
    inputs: [
      {
        name: "modelo",
        label: "Modelo",
        type: "select",
        required: true,
        options: [
          { value: "303", label: "303" },
          { value: "111", label: "111" },
          { value: "115", label: "115" },
          { value: "130", label: "130" },
          { value: "200", label: "200" },
          { value: "390", label: "390" },
          { value: "347", label: "347" },
        ],
      },
      { name: "ejercicio", label: "Ejercicio", type: "number", required: true, defaultValue: new Date().getUTCFullYear() },
      { name: "periodo", label: "Periodo", type: "select", required: true, options: [
        { value: "1T", label: "1T" }, { value: "2T", label: "2T" }, { value: "3T", label: "3T" }, { value: "4T", label: "4T" }, { value: "ANUAL", label: "ANUAL" },
      ]},
    ],
    action: {
      endpoint: "/api/aeat/{input.modelo}",
      method: "POST",
      body: {
        empresa_id: "{empresa_id}",
        ejercicio: "{input.ejercicio}",
        periodo: "{input.periodo}",
        status: "presentado",
      },
    },
    resultRenderer: "json",
  },
  {
    id: "fiscal-calcular-prorrata",
    category: "fiscal",
    icon: "Percent",
    title: "Calcular prorrata IVA",
    description: "Calcula la prorrata general y especial del IVA cuando hay operaciones con y sin derecho a deducir.",
    inputs: [
      { name: "operaciones_con_derecho", label: "Operaciones con derecho (€)", type: "number", required: true, defaultValue: 0 },
      { name: "operaciones_sin_derecho", label: "Operaciones sin derecho (€)", type: "number", required: true, defaultValue: 0 },
      { name: "iva_soportado_total", label: "IVA soportado total (€)", type: "number", required: true, defaultValue: 0 },
      { name: "iva_soportado_uso_exclusivo_con_derecho", label: "IVA uso exclusivo con derecho (€)", type: "number", defaultValue: 0 },
      { name: "iva_soportado_uso_exclusivo_sin_derecho", label: "IVA uso exclusivo sin derecho (€)", type: "number", defaultValue: 0 },
      { name: "iva_soportado_uso_mixto", label: "IVA uso mixto (€)", type: "number", defaultValue: 0 },
    ],
    action: {
      endpoint: "/api/aeat/prorrata",
      method: "POST",
      body: {
        operaciones_con_derecho: "{input.operaciones_con_derecho}",
        operaciones_sin_derecho: "{input.operaciones_sin_derecho}",
        iva_soportado_total: "{input.iva_soportado_total}",
        iva_soportado_uso_exclusivo_con_derecho: "{input.iva_soportado_uso_exclusivo_con_derecho}",
        iva_soportado_uso_exclusivo_sin_derecho: "{input.iva_soportado_uso_exclusivo_sin_derecho}",
        iva_soportado_uso_mixto: "{input.iva_soportado_uso_mixto}",
      },
    },
    resultRenderer: "json",
  },
  {
    id: "fiscal-cerrar-ejercicio",
    category: "contabilidad",
    icon: "Lock",
    title: "Cerrar y abrir ejercicio contable",
    description: "Genera el asiento de regularización (6/7 vs 129), el asiento de cierre y la apertura del siguiente ejercicio. Pide preview primero.",
    inputs: [
      { name: "ejercicio", label: "Ejercicio a cerrar", type: "number", required: true, defaultValue: new Date().getUTCFullYear() - 1 },
      { name: "preview", label: "Modo", type: "select", required: true, defaultValue: "true", options: [
        { value: "true", label: "Previsualizar" },
        { value: "false", label: "Contabilizar definitivamente" },
      ]},
    ],
    action: {
      endpoint: "/api/accounting/year-close",
      method: "POST",
      body: { empresa_id: "{empresa_id}", ejercicio: "{input.ejercicio}", preview: "{input.preview}" },
    },
    resultRenderer: "json",
  },
  {
    id: "fiscal-calendario",
    category: "fiscal",
    icon: "CalendarClock",
    title: "Calendario fiscal del cliente",
    description: "Devuelve las próximas obligaciones AEAT del cliente con fechas límite y días restantes.",
    inputs: [],
    action: {
      endpoint: "/api/aeat/calendario",
      method: "GET",
      query: { empresa_id: "{empresa_id}" },
    },
    resultRenderer: "calendario",
  },

  // ============================================================
  // LABORALES
  // ============================================================
  {
    id: "laboral-alta-trabajador",
    category: "laboral",
    icon: "UserPlus",
    title: "Alta de trabajador",
    description: "Da de alta un trabajador con sus datos básicos. Genera contrato indefinido por defecto.",
    inputs: [
      { name: "nombre", label: "Nombre completo", type: "text", required: true, placeholder: "Carlos Ruiz Pérez" },
      { name: "dni", label: "DNI / NIE", type: "text", required: true, placeholder: "12345678X" },
      { name: "nss", label: "Nº Seguridad Social", type: "text", placeholder: "281234567890" },
      { name: "puesto", label: "Puesto", type: "text", placeholder: "Desarrollador backend" },
      { name: "tipo_contrato", label: "Tipo de contrato", type: "select", defaultValue: "indefinido", options: [
        { value: "indefinido", label: "Indefinido" }, { value: "temporal", label: "Temporal" }, { value: "obra y servicio", label: "Obra y servicio" }, { value: "practicas", label: "Prácticas" }, { value: "formacion", label: "Formación" }, { value: "fijo discontinuo", label: "Fijo discontinuo" },
      ]},
      { name: "salario_bruto_anual", label: "Salario bruto anual (€)", type: "number", required: true, defaultValue: 24000 },
      { name: "irpf_pct", label: "% IRPF", type: "number", defaultValue: 0 },
      { name: "jornada_horas", label: "Jornada (h/semana)", type: "number", defaultValue: 40 },
      { name: "fecha_alta", label: "Fecha de alta", type: "date", required: true, defaultValue: new Date().toISOString().slice(0, 10) },
      { name: "email", label: "Email", type: "text" },
      { name: "telefono", label: "Teléfono", type: "text" },
    ],
    action: {
      endpoint: "/api/laboral/trabajadores",
      method: "POST",
      body: {
        empresa_id: "{empresa_id}",
        nombre: "{input.nombre}",
        dni: "{input.dni}",
        nss: "{input.nss}",
        puesto: "{input.puesto}",
        tipo_contrato: "{input.tipo_contrato}",
        salario_bruto_anual: "{input.salario_bruto_anual}",
        irpf_pct: "{input.irpf_pct}",
        jornada_horas: "{input.jornada_horas}",
        fecha_alta: "{input.fecha_alta}",
        email: "{input.email}",
        telefono: "{input.telefono}",
      },
    },
    resultRenderer: "json",
  },
  {
    id: "laboral-calcular-nomina",
    category: "laboral",
    icon: "Banknote",
    title: "Calcular nómina del mes",
    description: "Calcula la nómina de un trabajador para el mes indicado: bruto, IRPF, SS trabajador, SS empresa y neto.",
    inputs: [
      { name: "trabajador_id", label: "Trabajador", type: "trabajador", required: true },
      { name: "periodo", label: "Periodo (YYYY-MM)", type: "text", required: true, placeholder: "2026-05", defaultValue: new Date().toISOString().slice(0, 7) },
    ],
    action: {
      endpoint: "/api/laboral/nominas/calcular",
      method: "POST",
      body: { trabajador_id: "{input.trabajador_id}", periodo: "{input.periodo}" },
    },
    resultRenderer: "nomina",
  },
  {
    id: "laboral-calcular-finiquito",
    category: "laboral",
    icon: "FileMinus",
    title: "Calcular finiquito",
    description: "Calcula el finiquito de un trabajador: vacaciones pendientes, pagas extras prorrateadas, días del mes, indemnización (si procede), IRPF y neto.",
    inputs: [
      { name: "trabajador_id", label: "Trabajador", type: "trabajador", required: true },
      { name: "fecha_baja", label: "Fecha de baja", type: "date", required: true, defaultValue: new Date().toISOString().slice(0, 10) },
      { name: "causa", label: "Causa", type: "select", required: true, defaultValue: "despido_improcedente", options: [
        { value: "despido_improcedente", label: "Despido improcedente (33 d/año)" },
        { value: "despido_objetivo", label: "Despido objetivo (20 d/año)" },
        { value: "fin_contrato", label: "Fin de contrato (12 d/año)" },
        { value: "dimision", label: "Dimisión" },
        { value: "mutuo_acuerdo", label: "Mutuo acuerdo" },
        { value: "jubilacion", label: "Jubilación" },
      ]},
    ],
    action: {
      endpoint: "/api/laboral/finiquito",
      method: "POST",
      body: {
        empresa_id: "{empresa_id}",
        trabajador_id: "{input.trabajador_id}",
        fecha_baja: "{input.fecha_baja}",
        causa: "{input.causa}",
      },
    },
    resultRenderer: "finiquito",
  },
  {
    id: "laboral-bonificaciones",
    category: "laboral",
    icon: "Percent",
    title: "Calcular bonificaciones SS",
    description: "Calcula las bonificaciones de la cuota empresarial SS aplicables a un trabajador según su edad, contrato y circunstancias.",
    inputs: [
      { name: "trabajador_id", label: "Trabajador", type: "trabajador", required: true },
      { name: "parado_larga_duracion", label: "Parado larga duración", type: "select", defaultValue: "false", options: [
        { value: "false", label: "No" }, { value: "true", label: "Sí" },
      ]},
      { name: "primer_empleo_joven", label: "Primer empleo joven", type: "select", defaultValue: "false", options: [
        { value: "false", label: "No" }, { value: "true", label: "Sí" },
      ]},
      { name: "victima_violencia", label: "Víctima violencia género", type: "select", defaultValue: "false", options: [
        { value: "false", label: "No" }, { value: "true", label: "Sí" },
      ]},
      { name: "zona_rural_despoblada", label: "Zona rural despoblada", type: "select", defaultValue: "false", options: [
        { value: "false", label: "No" }, { value: "true", label: "Sí" },
      ]},
    ],
    action: {
      endpoint: "/api/laboral/bonificaciones",
      method: "POST",
      body: {
        trabajador_id: "{input.trabajador_id}",
        parado_larga_duracion: "{input.parado_larga_duracion}",
        primer_empleo_joven: "{input.primer_empleo_joven}",
        victima_violencia: "{input.victima_violencia}",
        zona_rural_despoblada: "{input.zona_rural_despoblada}",
      },
    },
    resultRenderer: "bonificaciones",
  },
  {
    id: "laboral-calendario",
    category: "laboral",
    icon: "Calendar",
    title: "Calendario laboral",
    description: "Días laborables del mes/año por comunidad autónoma con festivos nacionales y autonómicos.",
    inputs: [
      { name: "ejercicio", label: "Año", type: "number", required: true, defaultValue: new Date().getUTCFullYear() },
      { name: "ccaa", label: "Comunidad autónoma", type: "select", defaultValue: "madrid", options: [
        { value: "madrid", label: "Madrid" }, { value: "cataluna", label: "Cataluña" }, { value: "valencia", label: "Valencia" },
        { value: "andalucia", label: "Andalucía" }, { value: "pais_vasco", label: "País Vasco" }, { value: "galicia", label: "Galicia" },
      ]},
    ],
    action: {
      endpoint: "/api/laboral/calendario",
      method: "GET",
      query: { ejercicio: "{input.ejercicio}", ccaa: "{input.ccaa}" },
    },
    resultRenderer: "json",
  },

  // ============================================================
  // FACTURACIÓN
  // ============================================================
  {
    id: "factura-rapida",
    category: "facturacion",
    icon: "FilePlus",
    title: "Emitir factura rápida",
    description: "Emite una factura con un solo concepto. Número automático según la serie configurada.",
    inputs: [
      { name: "contacto_nombre", label: "Cliente", type: "text", required: true, placeholder: "Cliente S.L." },
      { name: "contacto_nif", label: "NIF del cliente", type: "text", placeholder: "B12345678" },
      { name: "descripcion", label: "Concepto", type: "text", required: true, placeholder: "Servicios de consultoría · Mayo 2026" },
      { name: "precio_unitario", label: "Importe base (€)", type: "number", required: true, defaultValue: 1000 },
      { name: "iva_pct", label: "% IVA", type: "select", defaultValue: "21", options: [
        { value: "0", label: "0%" }, { value: "4", label: "4%" }, { value: "10", label: "10%" }, { value: "21", label: "21%" },
      ]},
      { name: "irpf_pct", label: "% Retención IRPF", type: "number", defaultValue: 0 },
      { name: "fecha_emision", label: "Fecha emisión", type: "date", required: true, defaultValue: new Date().toISOString().slice(0, 10) },
    ],
    action: {
      endpoint: "/api/billing/facturas",
      method: "POST",
      body: {
        empresa_id: "{empresa_id}",
        tipo: "emitida",
        contacto_nombre: "{input.contacto_nombre}",
        contacto_nif: "{input.contacto_nif}",
        fecha_emision: "{input.fecha_emision}",
        irpf_pct: "{input.irpf_pct}",
        lineas: [{
          descripcion: "{input.descripcion}",
          cantidad: 1,
          precio_unitario: "{input.precio_unitario}",
          iva_pct: "{input.iva_pct}",
          descuento_pct: 0,
        }],
        estado: "emitida",
      },
    },
    resultRenderer: "factura",
  },
  {
    id: "factura-recordatorio",
    category: "facturacion",
    icon: "Bell",
    title: "Generar recordatorio de cobro IA",
    description: "Redacta un email de recordatorio de cobro con tono adaptado a los días vencidos de la factura.",
    inputs: [
      { name: "factura_id", label: "ID de la factura", type: "text", required: true, placeholder: "uuid de la factura" },
    ],
    action: {
      endpoint: "/api/billing/facturas/{input.factura_id}/recordatorio",
      method: "POST",
    },
    resultRenderer: "json",
  },

  // ============================================================
  // ANÁLISIS
  // ============================================================
  {
    id: "analisis-inteligencia",
    category: "analisis",
    icon: "Brain",
    title: "Análisis de inteligencia de la cartera",
    description: "Devuelve un análisis IA con riesgos detectados, oportunidades de ahorro fiscal y predicciones de la cartera.",
    inputs: [],
    action: {
      endpoint: "/api/inteligencia",
      method: "GET",
    },
    resultRenderer: "json",
  },
  {
    id: "analisis-duplicados",
    category: "analisis",
    icon: "Copy",
    title: "Detectar facturas duplicadas",
    description: "Busca facturas duplicadas comparando NIF de proveedor + importe + fecha cercana, usando IA para detectar variaciones tipográficas.",
    inputs: [],
    action: {
      endpoint: "/api/agents/duplicate-check",
      method: "POST",
      body: { empresa_id: "{empresa_id}" },
    },
    resultRenderer: "lista",
  },
];

export function agentsByCategory(): Record<AgentSpec["category"], AgentSpec[]> {
  const grouped: Record<AgentSpec["category"], AgentSpec[]> = {
    fiscal: [],
    laboral: [],
    facturacion: [],
    contabilidad: [],
    analisis: [],
  };
  for (const a of AGENT_CATALOG) grouped[a.category].push(a);
  return grouped;
}

export function getAgent(id: string): AgentSpec | undefined {
  return AGENT_CATALOG.find((a) => a.id === id);
}

/**
 * Sustituye {empresa_id} y {input.X} en un objeto/string.
 */
export function resolveTemplate(
  value: unknown,
  empresaId: string,
  inputs: Record<string, string | number | undefined>,
): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return value.replace(/\{empresa_id\}/g, empresaId).replace(/\{input\.([a-zA-Z0-9_]+)\}/g, (_, k) => {
      const v = inputs[k];
      return v == null ? "" : String(v);
    });
  }
  if (Array.isArray(value)) return value.map((v) => resolveTemplate(v, empresaId, inputs));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = resolveTemplate(v, empresaId, inputs);
    return out;
  }
  return value;
}

/**
 * Tras resolver placeholders, convierte strings de números/booleanos.
 */
export function coerceTypes(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "") return undefined;
    const n = Number(value);
    if (!Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(value)) return n;
    return value;
  }
  if (Array.isArray(value)) return value.map(coerceTypes);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const c = coerceTypes(v);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  return value;
}
