/**
 * Catálogo simplificado de convenios colectivos españoles más habituales.
 *
 * Para producción real conviene importar el BOE/SMAC más reciente; este
 * catálogo cubre los convenios estatales más comunes en pymes con datos
 * orientativos 2026. Cada convenio define:
 *  - Tablas salariales por categoría (anual a 12 pagas, sin prorratear extras).
 *  - Jornada semanal en horas.
 *  - Días naturales de vacaciones (mínimo legal 30).
 *  - Complementos típicos (antigüedad, nocturnidad, plus convenio).
 *  - Pagas extra anuales (12 ó 14 según convenio).
 */

export type CategoriaSalario = {
  code: string;
  nombre: string;
  bruto_anual: number;       // bruto anual orientativo
  grupo_cotizacion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
};

export type Convenio = {
  codigo: string;            // código BOE (ej. "99000005011982")
  nombre: string;            // nombre comercial
  ambito: "estatal" | "autonomico" | "provincial" | "empresa";
  cnae?: string;             // CNAE principal aplicable
  jornada_semanal: number;
  vacaciones_dias: number;   // días naturales
  pagas_anuales: 12 | 14;
  categorias: CategoriaSalario[];
  complementos_tipicos: Array<{
    code: string;
    label: string;
    formula?: string;        // "{antiguedad}*0.05*{bruto}" estilo descriptivo
    importe_fijo?: number;
  }>;
  notas?: string;
};

export const CONVENIOS: Convenio[] = [
  {
    codigo: "99004585011982",
    nombre: "Oficinas y Despachos (estatal)",
    ambito: "estatal",
    cnae: "82",
    jornada_semanal: 40,
    vacaciones_dias: 30,
    pagas_anuales: 14,
    categorias: [
      { code: "DIR", nombre: "Director / Dirección", bruto_anual: 36000, grupo_cotizacion: 1 },
      { code: "JEF", nombre: "Jefe administrativo", bruto_anual: 27000, grupo_cotizacion: 2 },
      { code: "OF1", nombre: "Oficial 1ª administrativo", bruto_anual: 22000, grupo_cotizacion: 5 },
      { code: "OF2", nombre: "Oficial 2ª administrativo", bruto_anual: 19500, grupo_cotizacion: 7 },
      { code: "AUX", nombre: "Auxiliar administrativo", bruto_anual: 17500, grupo_cotizacion: 8 },
    ],
    complementos_tipicos: [
      { code: "ANT", label: "Antigüedad (trienio 5%)", formula: "trienios * 0.05 * bruto_categoria" },
    ],
  },
  {
    codigo: "99001285011982",
    nombre: "Comercio (general)",
    ambito: "estatal",
    cnae: "47",
    jornada_semanal: 40,
    vacaciones_dias: 30,
    pagas_anuales: 14,
    categorias: [
      { code: "ENC", nombre: "Encargado/a", bruto_anual: 22500, grupo_cotizacion: 3 },
      { code: "DEP1", nombre: "Dependiente/a", bruto_anual: 18500, grupo_cotizacion: 5 },
      { code: "AUX", nombre: "Auxiliar de comercio", bruto_anual: 17000, grupo_cotizacion: 8 },
      { code: "REP", nombre: "Reponedor/a", bruto_anual: 16500, grupo_cotizacion: 9 },
    ],
    complementos_tipicos: [
      { code: "DOM", label: "Plus domingos/festivos", importe_fijo: 25 },
    ],
  },
  {
    codigo: "99010005011982",
    nombre: "Hostelería (general)",
    ambito: "estatal",
    cnae: "56",
    jornada_semanal: 40,
    vacaciones_dias: 30,
    pagas_anuales: 14,
    categorias: [
      { code: "JEFCOC", nombre: "Jefe/a de cocina", bruto_anual: 24000, grupo_cotizacion: 3 },
      { code: "COC", nombre: "Cocinero/a", bruto_anual: 20000, grupo_cotizacion: 5 },
      { code: "CAM", nombre: "Camarero/a", bruto_anual: 17500, grupo_cotizacion: 6 },
      { code: "AYU", nombre: "Ayudante de camarero/cocina", bruto_anual: 16500, grupo_cotizacion: 9 },
    ],
    complementos_tipicos: [
      { code: "NOC", label: "Plus nocturnidad (22h-06h)", formula: "0.25 * hora_base" },
      { code: "FEST", label: "Plus festivos", importe_fijo: 20 },
    ],
  },
  {
    codigo: "99002145011982",
    nombre: "Construcción (general)",
    ambito: "estatal",
    cnae: "41",
    jornada_semanal: 40,
    vacaciones_dias: 30,
    pagas_anuales: 14,
    categorias: [
      { code: "ENC", nombre: "Encargado de obra", bruto_anual: 28000, grupo_cotizacion: 3 },
      { code: "OF1", nombre: "Oficial 1ª", bruto_anual: 23000, grupo_cotizacion: 8 },
      { code: "OF2", nombre: "Oficial 2ª", bruto_anual: 20500, grupo_cotizacion: 8 },
      { code: "PEO", nombre: "Peón especializado", bruto_anual: 18500, grupo_cotizacion: 10 },
    ],
    complementos_tipicos: [
      { code: "DIST", label: "Plus distancia / kilometraje", importe_fijo: 0.19 },
      { code: "PRL", label: "Plus penosidad/peligrosidad", formula: "0.20 * salario_base" },
    ],
  },
  {
    codigo: "99007705011982",
    nombre: "Industria del Metal (estatal)",
    ambito: "estatal",
    cnae: "25",
    jornada_semanal: 38,
    vacaciones_dias: 30,
    pagas_anuales: 14,
    categorias: [
      { code: "ING", nombre: "Ingeniero/a técnico", bruto_anual: 30000, grupo_cotizacion: 2 },
      { code: "TEC", nombre: "Técnico de oficina", bruto_anual: 25000, grupo_cotizacion: 5 },
      { code: "OF1", nombre: "Oficial 1ª", bruto_anual: 23500, grupo_cotizacion: 8 },
      { code: "OP", nombre: "Operario especializado", bruto_anual: 19500, grupo_cotizacion: 9 },
    ],
    complementos_tipicos: [
      { code: "TUR", label: "Plus turnicidad", formula: "0.10 * salario_base" },
    ],
  },
  {
    codigo: "99012005011982",
    nombre: "Limpieza de Edificios y Locales",
    ambito: "estatal",
    cnae: "81",
    jornada_semanal: 39,
    vacaciones_dias: 30,
    pagas_anuales: 14,
    categorias: [
      { code: "ENC", nombre: "Encargado de servicio", bruto_anual: 19500, grupo_cotizacion: 5 },
      { code: "LIM", nombre: "Limpiador/a", bruto_anual: 16500, grupo_cotizacion: 10 },
    ],
    complementos_tipicos: [
      { code: "DOM", label: "Plus festivos", importe_fijo: 18 },
    ],
  },
  {
    codigo: "99013105011982",
    nombre: "Transporte de Mercancías por Carretera",
    ambito: "estatal",
    cnae: "49",
    jornada_semanal: 40,
    vacaciones_dias: 30,
    pagas_anuales: 14,
    categorias: [
      { code: "JEFTRA", nombre: "Jefe de tráfico", bruto_anual: 26000, grupo_cotizacion: 3 },
      { code: "COND", nombre: "Conductor/a", bruto_anual: 22000, grupo_cotizacion: 8 },
      { code: "MOZ", nombre: "Mozo de almacén", bruto_anual: 17500, grupo_cotizacion: 10 },
    ],
    complementos_tipicos: [
      { code: "DIETA", label: "Dietas y kilometraje", importe_fijo: 0.26 },
    ],
  },
  {
    codigo: "99005955011982",
    nombre: "Sanidad Privada (estatal)",
    ambito: "estatal",
    cnae: "86",
    jornada_semanal: 35,
    vacaciones_dias: 31,
    pagas_anuales: 14,
    categorias: [
      { code: "MED", nombre: "Médico/a", bruto_anual: 36000, grupo_cotizacion: 1 },
      { code: "ENF", nombre: "Enfermero/a", bruto_anual: 25000, grupo_cotizacion: 2 },
      { code: "AUX", nombre: "Auxiliar de enfermería", bruto_anual: 19500, grupo_cotizacion: 5 },
    ],
    complementos_tipicos: [
      { code: "GUARD", label: "Plus guardias", importe_fijo: 80 },
      { code: "NOC", label: "Plus nocturnidad", formula: "0.25 * hora_base" },
    ],
  },
  {
    codigo: "99014205011982",
    nombre: "Enseñanza Privada (no concertada)",
    ambito: "estatal",
    cnae: "85",
    jornada_semanal: 25,
    vacaciones_dias: 60,
    pagas_anuales: 14,
    categorias: [
      { code: "PROF", nombre: "Profesor/a titular", bruto_anual: 27000, grupo_cotizacion: 1 },
      { code: "AUX", nombre: "Auxiliar docente", bruto_anual: 18500, grupo_cotizacion: 5 },
    ],
    complementos_tipicos: [],
    notas: "Vacaciones suelen coincidir con cierre del centro (junio-agosto).",
  },
  {
    codigo: "99020005011982",
    nombre: "TIC / Consultoría y Estudios de Mercado",
    ambito: "estatal",
    cnae: "62",
    jornada_semanal: 37.5,
    vacaciones_dias: 23,
    pagas_anuales: 12,
    categorias: [
      { code: "DIR", nombre: "Director/a de proyecto", bruto_anual: 50000, grupo_cotizacion: 1 },
      { code: "SEN", nombre: "Analista senior", bruto_anual: 38000, grupo_cotizacion: 2 },
      { code: "MID", nombre: "Analista programador/a", bruto_anual: 28000, grupo_cotizacion: 3 },
      { code: "JR", nombre: "Programador/a junior", bruto_anual: 22000, grupo_cotizacion: 5 },
    ],
    complementos_tipicos: [
      { code: "TEL", label: "Plus teletrabajo", importe_fijo: 30 },
    ],
  },
  {
    codigo: "99030005011982",
    nombre: "Peluquería, Estética y Belleza",
    ambito: "estatal",
    cnae: "96",
    jornada_semanal: 40,
    vacaciones_dias: 30,
    pagas_anuales: 14,
    categorias: [
      { code: "OF1", nombre: "Oficial 1ª", bruto_anual: 18500, grupo_cotizacion: 8 },
      { code: "OF2", nombre: "Oficial 2ª", bruto_anual: 16500, grupo_cotizacion: 9 },
      { code: "AYU", nombre: "Ayudante", bruto_anual: 15800, grupo_cotizacion: 10 },
    ],
    complementos_tipicos: [],
  },
  {
    codigo: "99040005011982",
    nombre: "Agencias de Viajes",
    ambito: "estatal",
    cnae: "79",
    jornada_semanal: 38.5,
    vacaciones_dias: 30,
    pagas_anuales: 14,
    categorias: [
      { code: "JEF", nombre: "Jefe de oficina", bruto_anual: 25000, grupo_cotizacion: 3 },
      { code: "TEC", nombre: "Técnico de ventas", bruto_anual: 20000, grupo_cotizacion: 5 },
      { code: "AUX", nombre: "Auxiliar", bruto_anual: 17000, grupo_cotizacion: 8 },
    ],
    complementos_tipicos: [],
  },
];

export function getConvenio(codigo: string): Convenio | undefined {
  return CONVENIOS.find((c) => c.codigo === codigo);
}

export function buscarConvenios(query: string): Convenio[] {
  const q = query.trim().toLowerCase();
  if (!q) return CONVENIOS;
  return CONVENIOS.filter(
    (c) =>
      c.nombre.toLowerCase().includes(q) ||
      c.codigo.toLowerCase().includes(q) ||
      (c.cnae ?? "").includes(q),
  );
}
