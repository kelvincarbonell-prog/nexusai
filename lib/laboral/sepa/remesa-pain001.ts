/**
 * Generador de remesa SEPA pain.001.001.03 — pago masivo de nóminas
 * (transferencias ordinarias desde la cuenta de la empresa hacia los
 * trabajadores y otros beneficiarios).
 *
 * Esquema oficial:
 *   ISO 20022 pain.001.001.03 con extensiones AEB (Asoc. Bancaria Española).
 *
 * El fichero se sube al portal del banco (BBVA, Santander, Sabadell, etc.)
 * que ejecuta las transferencias en bloque.
 */

import crypto from "crypto";

export type Ordenante = {
  nombre: string;
  nif: string;
  iban: string;
  bic?: string;
};

export type Beneficiario = {
  nombre: string;
  nif?: string;
  iban: string;
  bic?: string;
  importe: number;
  concepto?: string;   // p. ej. "Nómina mayo 2026"
  /** ID interno único por línea (p. ej. nomina.id). */
  ref: string;
};

export type RemesaInput = {
  ordenante: Ordenante;
  fecha_ejecucion: string;   // YYYY-MM-DD (día en que el banco la ejecutará)
  beneficiarios: Beneficiario[];
  /** Texto que aparecerá agrupado en el extracto. */
  motivo?: string;
};

function esc(s: string | undefined | null): string {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
function n2(v: number): string { return (Math.round(v * 100) / 100).toFixed(2); }
function cleanIban(s: string): string { return (s ?? "").replace(/\s+/g, "").toUpperCase(); }
function cleanNif(s: string | undefined): string { return (s ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase(); }

export type RemesaResult = {
  xml: string;
  message_id: string;
  payment_info_id: string;
  total_importe: number;
  total_lineas: number;
};

/**
 * Construye el XML pain.001.001.03 de la remesa.
 * Validaciones mínimas: IBAN no vacío, importe > 0, sin duplicados de ref.
 */
export function buildRemesaPain001(input: RemesaInput): RemesaResult {
  if (input.beneficiarios.length === 0) throw new Error("Remesa vacía: añade al menos 1 beneficiario.");
  const refs = new Set<string>();
  for (const b of input.beneficiarios) {
    if (refs.has(b.ref)) throw new Error(`Referencia duplicada: ${b.ref}`);
    if (!cleanIban(b.iban)) throw new Error(`Beneficiario ${b.nombre} sin IBAN.`);
    if (b.importe <= 0) throw new Error(`Beneficiario ${b.nombre} importe inválido.`);
    refs.add(b.ref);
  }
  if (!cleanIban(input.ordenante.iban)) throw new Error("Ordenante sin IBAN.");

  const total = input.beneficiarios.reduce((s, b) => s + b.importe, 0);
  const ts = new Date();
  const creationDateTime = ts.toISOString().replace(/\.\d+Z$/, "");
  const messageId = `M26-${ts.getTime()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const paymentInfoId = `PI-${ts.getTime()}`;

  const cdtTrfTxs = input.beneficiarios.map((b, i) => {
    const refLimpia = b.ref.replace(/[^A-Z0-9-]/gi, "").slice(0, 35) || `B${i + 1}`;
    const conceptoLimpio = (b.concepto ?? input.motivo ?? "Nomina")
      .replace(/[^A-Za-z0-9 .,-]/g, "")
      .slice(0, 140);
    return `      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${esc(refLimpia)}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="EUR">${n2(b.importe)}</InstdAmt>
        </Amt>
        ${b.bic ? `<CdtrAgt><FinInstnId><BIC>${esc(b.bic)}</BIC></FinInstnId></CdtrAgt>` : ""}
        <Cdtr>
          <Nm>${esc(b.nombre.slice(0, 70))}</Nm>
          ${b.nif ? `<Id><PrvtId><Othr><Id>${esc(cleanNif(b.nif))}</Id></Othr></PrvtId></Id>` : ""}
        </Cdtr>
        <CdtrAcct>
          <Id><IBAN>${esc(cleanIban(b.iban))}</IBAN></Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>${esc(conceptoLimpio)}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${esc(messageId)}</MsgId>
      <CreDtTm>${creationDateTime}</CreDtTm>
      <NbOfTxs>${input.beneficiarios.length}</NbOfTxs>
      <CtrlSum>${n2(total)}</CtrlSum>
      <InitgPty>
        <Nm>${esc(input.ordenante.nombre.slice(0, 70))}</Nm>
        <Id><OrgId><Othr><Id>${esc(cleanNif(input.ordenante.nif))}</Id></Othr></OrgId></Id>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${esc(paymentInfoId)}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <BtchBookg>true</BtchBookg>
      <NbOfTxs>${input.beneficiarios.length}</NbOfTxs>
      <CtrlSum>${n2(total)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
      </PmtTpInf>
      <ReqdExctnDt>${input.fecha_ejecucion}</ReqdExctnDt>
      <Dbtr>
        <Nm>${esc(input.ordenante.nombre.slice(0, 70))}</Nm>
        <Id><OrgId><Othr><Id>${esc(cleanNif(input.ordenante.nif))}</Id></Othr></OrgId></Id>
      </Dbtr>
      <DbtrAcct>
        <Id><IBAN>${esc(cleanIban(input.ordenante.iban))}</IBAN></Id>
      </DbtrAcct>
      ${input.ordenante.bic ? `<DbtrAgt><FinInstnId><BIC>${esc(input.ordenante.bic)}</BIC></FinInstnId></DbtrAgt>` : ""}
      <ChrgBr>SLEV</ChrgBr>
${cdtTrfTxs}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

  return {
    xml,
    message_id: messageId,
    payment_info_id: paymentInfoId,
    total_importe: Math.round(total * 100) / 100,
    total_lineas: input.beneficiarios.length,
  };
}
