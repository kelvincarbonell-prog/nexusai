/**
 * Generador del XML de Contrat@ (SEPE) para comunicar contratos.
 *
 * Estructura simplificada según esquema SEPE. Requiere completar manualmente
 * algunos campos opcionales en el portal SEPE tras subir el XML, pero cubre
 * el grueso obligatorio (empresa, trabajador, tipo de contrato, jornada,
 * salario, fechas, claves de bonificación).
 *
 * Tipos de contrato SEPE más comunes:
 *   100 indefinido tiempo completo
 *   189 indefinido tiempo parcial
 *   200 temporal por circunstancias de la producción
 *   401 formativo en alternancia
 *   501 práctica profesional
 */

export type ContrataInput = {
  empresa: {
    nif: string;
    razon_social: string;
    ccc: string;
    cnae?: string;
    domicilio?: { via: string; numero?: string; cp: string; municipio: string; provincia: string };
  };
  trabajador: {
    dni: string;                  // 9 caracteres
    naf: string;                  // Nº afiliación SS
    nombre: string;
    apellidos: string;
    fecha_nacimiento: string;     // YYYY-MM-DD
    sexo: "1" | "6";              // 1 hombre, 6 mujer (códigos TGSS)
    nacionalidad?: string;        // ISO-3166 alpha-3, default ESP
    nivel_estudios?: string;      // código BOE (ej. "44" graduado)
    domicilio?: { via: string; numero?: string; cp: string; municipio: string; provincia: string };
  };
  contrato: {
    tipo: string;                 // código SEPE 3 dígitos
    fecha_inicio: string;         // YYYY-MM-DD
    fecha_fin?: string;
    jornada_horas_semanales: number;
    jornada_tipo: "completa" | "parcial";
    salario_bruto_anual: number;
    convenio_codigo?: string;
    ocupacion?: string;           // código CNO-11 (ej. "4111")
    motivo?: string;              // texto libre
    clausulas_especificas?: string[];
    bonificaciones?: Array<{ codigo: string; descripcion?: string }>;
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

export function generarContrataXML(input: ContrataInput): string {
  const t = input.trabajador;
  const e = input.empresa;
  const c = input.contrato;
  const bonis = (c.bonificaciones ?? [])
    .map((b) => `      <Bonificacion codigo="${esc(b.codigo)}">${esc(b.descripcion ?? "")}</Bonificacion>`)
    .join("\n");
  const clausulas = (c.clausulas_especificas ?? [])
    .map((cl) => `      <Clausula>${esc(cl)}</Clausula>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ComunicacionContrato xmlns="http://www.sepe.es/contrata">
  <Cabecera>
    <Version>2.4</Version>
    <FechaGeneracion>${new Date().toISOString().slice(0, 10)}</FechaGeneracion>
    <TipoComunicacion>AC</TipoComunicacion>
  </Cabecera>
  <Empresa>
    <NIF>${esc(e.nif)}</NIF>
    <RazonSocial>${esc(e.razon_social)}</RazonSocial>
    <CCC>${esc(e.ccc)}</CCC>
    ${e.cnae ? `<CNAE>${esc(e.cnae)}</CNAE>` : ""}
    ${e.domicilio ? `<Domicilio>
      <Via>${esc(e.domicilio.via)}</Via>
      ${e.domicilio.numero ? `<Numero>${esc(e.domicilio.numero)}</Numero>` : ""}
      <CodigoPostal>${esc(e.domicilio.cp)}</CodigoPostal>
      <Municipio>${esc(e.domicilio.municipio)}</Municipio>
      <Provincia>${esc(e.domicilio.provincia)}</Provincia>
    </Domicilio>` : ""}
  </Empresa>
  <Trabajador>
    <DNI>${esc(t.dni)}</DNI>
    <NAF>${esc(t.naf)}</NAF>
    <Nombre>${esc(t.nombre)}</Nombre>
    <Apellidos>${esc(t.apellidos)}</Apellidos>
    <FechaNacimiento>${esc(t.fecha_nacimiento)}</FechaNacimiento>
    <Sexo>${esc(t.sexo)}</Sexo>
    <Nacionalidad>${esc(t.nacionalidad ?? "ESP")}</Nacionalidad>
    ${t.nivel_estudios ? `<NivelEstudios>${esc(t.nivel_estudios)}</NivelEstudios>` : ""}
  </Trabajador>
  <Contrato>
    <Tipo>${esc(c.tipo)}</Tipo>
    <FechaInicio>${esc(c.fecha_inicio)}</FechaInicio>
    ${c.fecha_fin ? `<FechaFin>${esc(c.fecha_fin)}</FechaFin>` : ""}
    <Jornada tipo="${c.jornada_tipo === "completa" ? "C" : "P"}">${c.jornada_horas_semanales}</Jornada>
    <SalarioBrutoAnual>${c.salario_bruto_anual.toFixed(2)}</SalarioBrutoAnual>
    ${c.convenio_codigo ? `<Convenio>${esc(c.convenio_codigo)}</Convenio>` : ""}
    ${c.ocupacion ? `<Ocupacion>${esc(c.ocupacion)}</Ocupacion>` : ""}
    ${c.motivo ? `<Motivo>${esc(c.motivo)}</Motivo>` : ""}
    ${clausulas ? `<Clausulas>\n${clausulas}\n    </Clausulas>` : ""}
    ${bonis ? `<Bonificaciones>\n${bonis}\n    </Bonificaciones>` : ""}
  </Contrato>
</ComunicacionContrato>`;
}

export function validarContrata(input: ContrataInput): string[] {
  const errs: string[] = [];
  if (!input.empresa.ccc) errs.push("Empresa sin CCC (Código Cuenta Cotización).");
  if (!input.empresa.nif) errs.push("Empresa sin NIF.");
  if (!input.trabajador.dni || input.trabajador.dni.length !== 9) errs.push("DNI del trabajador inválido (debe tener 9 caracteres).");
  if (!input.trabajador.naf) errs.push("Trabajador sin NAF (Nº Afiliación SS).");
  if (!input.trabajador.fecha_nacimiento) errs.push("Fecha de nacimiento del trabajador requerida.");
  if (!input.contrato.tipo) errs.push("Tipo de contrato SEPE requerido (código 3 dígitos).");
  if (!input.contrato.fecha_inicio) errs.push("Fecha de inicio del contrato requerida.");
  if (input.contrato.jornada_horas_semanales <= 0) errs.push("Jornada semanal en horas requerida.");
  if (input.contrato.salario_bruto_anual <= 0) errs.push("Salario bruto anual requerido.");
  return errs;
}
