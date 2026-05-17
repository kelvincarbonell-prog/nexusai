/**
 * Generador del XML Delt@ — comunicación de partes IT/AT al Ministerio.
 *
 * Cubre:
 *  - Parte de baja por incapacidad temporal (IT) — común (CC) o profesional (AT/EP)
 *  - Parte de alta (fin de IT)
 *  - Parte de confirmación
 *
 * Plazos legales: 3 días naturales desde que el médico emite el parte
 * para CC; 24 horas para AT/EP.
 */

export type ParteITInput = {
  tipo: "baja" | "alta" | "confirmacion";
  contingencia: "cc" | "ep" | "atrabajo" | "atrayecto"; // contingencia común, enfermedad profesional, accidente laboral, accidente in itinere
  empresa: {
    nif: string;
    razon_social: string;
    ccc: string;
  };
  trabajador: {
    dni: string;
    naf: string;
    nombre: string;
    apellidos: string;
    fecha_nacimiento: string;
  };
  parte: {
    fecha_emision: string;        // YYYY-MM-DD — fecha del parte
    fecha_baja: string;           // primer día de baja
    fecha_alta?: string;          // si tipo=alta
    diagnostico?: string;         // CIE-10 si se conoce
    duracion_estimada_dias?: number;
    medico_colegiado?: string;
    centro_medico?: string;
    causa_alta?: "curacion" | "incomparecencia" | "fallecimiento" | "propuesta_inc_perm" | "agotamiento";
  };
};

function esc(s: string | undefined | null): string {
  if (s === undefined || s === null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const CONTINGENCIA_CODE: Record<ParteITInput["contingencia"], string> = {
  cc: "01",
  ep: "02",
  atrabajo: "03",
  atrayecto: "04",
};

export function generarParteITXML(input: ParteITInput): string {
  const t = input.trabajador;
  const e = input.empresa;
  const p = input.parte;
  const tipoCode = input.tipo === "baja" ? "B" : input.tipo === "alta" ? "A" : "C";

  return `<?xml version="1.0" encoding="UTF-8"?>
<ParteIT xmlns="http://www.empleo.gob.es/delta">
  <Cabecera>
    <Version>1.2</Version>
    <FechaEnvio>${new Date().toISOString().slice(0, 10)}</FechaEnvio>
    <TipoParte>${tipoCode}</TipoParte>
    <Contingencia codigo="${CONTINGENCIA_CODE[input.contingencia]}">${input.contingencia}</Contingencia>
  </Cabecera>
  <Empresa>
    <NIF>${esc(e.nif)}</NIF>
    <RazonSocial>${esc(e.razon_social)}</RazonSocial>
    <CCC>${esc(e.ccc)}</CCC>
  </Empresa>
  <Trabajador>
    <DNI>${esc(t.dni)}</DNI>
    <NAF>${esc(t.naf)}</NAF>
    <Nombre>${esc(t.nombre)}</Nombre>
    <Apellidos>${esc(t.apellidos)}</Apellidos>
    <FechaNacimiento>${esc(t.fecha_nacimiento)}</FechaNacimiento>
  </Trabajador>
  <Parte>
    <FechaEmision>${esc(p.fecha_emision)}</FechaEmision>
    <FechaBaja>${esc(p.fecha_baja)}</FechaBaja>
    ${p.fecha_alta ? `<FechaAlta>${esc(p.fecha_alta)}</FechaAlta>` : ""}
    ${p.diagnostico ? `<Diagnostico>${esc(p.diagnostico)}</Diagnostico>` : ""}
    ${p.duracion_estimada_dias ? `<DuracionEstimadaDias>${p.duracion_estimada_dias}</DuracionEstimadaDias>` : ""}
    ${p.medico_colegiado ? `<MedicoColegiado>${esc(p.medico_colegiado)}</MedicoColegiado>` : ""}
    ${p.centro_medico ? `<CentroMedico>${esc(p.centro_medico)}</CentroMedico>` : ""}
    ${p.causa_alta ? `<CausaAlta>${esc(p.causa_alta)}</CausaAlta>` : ""}
  </Parte>
</ParteIT>`;
}

export function validarParteIT(input: ParteITInput): string[] {
  const errs: string[] = [];
  if (!input.empresa.ccc) errs.push("Empresa sin CCC.");
  if (!input.trabajador.dni || !input.trabajador.naf) errs.push("Trabajador sin DNI o NAF.");
  if (!input.parte.fecha_baja) errs.push("Fecha de baja requerida.");
  if (input.tipo === "alta" && !input.parte.fecha_alta) errs.push("Parte de alta requiere fecha_alta.");
  if (input.tipo === "alta" && !input.parte.causa_alta) errs.push("Parte de alta requiere causa_alta.");
  // Plazo legal: ATRA debe enviarse en 24h, resto en 3 días
  const hoy = new Date();
  const fechaBaja = new Date(input.parte.fecha_baja);
  const diff = (hoy.getTime() - fechaBaja.getTime()) / 86_400_000;
  const plazo = input.contingencia === "atrabajo" || input.contingencia === "atrayecto" ? 1 : 3;
  if (diff > plazo) {
    errs.push(`Plazo legal superado: ${input.contingencia === "atrabajo" || input.contingencia === "atrayecto" ? "AT debe comunicarse en 24h" : "IT común en 3 días"} (han pasado ${Math.floor(diff)} días).`);
  }
  return errs;
}
