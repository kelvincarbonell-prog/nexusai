/**
 * Escáner de seguridad para archivos subidos por el cliente (facturas, gastos…).
 *
 * Tres niveles:
 *  1. Validación de tamaño y MIME real (magic numbers) — instantáneo.
 *  2. Heurística de contenido: bloquea PDFs con /JS, /JavaScript, /Launch,
 *     PE/ELF embebidos, ZIPs con .exe dentro.
 *  3. VirusTotal API si VIRUSTOTAL_API_KEY está configurada (opcional).
 *
 * El objetivo: bloquear el 99% de casos sin coste y poder escalar a VT en
 * producción si el usuario activa la clave.
 */

import crypto from "crypto";

export type ScanResult = {
  ok: boolean;
  reason?: string;
  detected_type?: string;
  sha256: string;
  scanned_by: string[];          // ["magic", "heuristic", "virustotal"]
  virustotal?: {
    positives: number;
    total: number;
    permalink?: string;
  };
};

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

// Magic numbers (firma de los primeros bytes del archivo).
const MAGIC: Array<{ type: string; mimeAllowed: string[]; signature: number[] | string }> = [
  { type: "pdf", mimeAllowed: ["application/pdf"], signature: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { type: "jpg", mimeAllowed: ["image/jpeg"], signature: [0xff, 0xd8, 0xff] },
  { type: "png", mimeAllowed: ["image/png"], signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { type: "webp", mimeAllowed: ["image/webp"], signature: "RIFF????WEBP" },
  { type: "heic", mimeAllowed: ["image/heic", "image/heif"], signature: "????ftyp" },
];

// Patrones peligrosos en contenido binario / texto
const DANGEROUS_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "pdf_js", pattern: /\/JavaScript\s/i },
  { name: "pdf_js2", pattern: /\/JS\s/i },
  { name: "pdf_launch", pattern: /\/Launch\s/i },
  { name: "pdf_openaction", pattern: /\/OpenAction.*\/JS/i },
  { name: "pe_header", pattern: /^MZ[\s\S]{0,200}This program cannot be run in DOS/ },
  { name: "elf_header", pattern: /^\x7fELF/ },
  { name: "macho", pattern: /^\xcf\xfa\xed\xfe/ },
  { name: "macro_office", pattern: /vbaProject\.bin/ },
  { name: "url_protocol", pattern: /(javascript|data|vbscript):/i },
];

function checkMagic(buf: Buffer, declaredMime?: string): { type: string | null; matched: boolean } {
  for (const m of MAGIC) {
    if (typeof m.signature === "string") {
      const sigStr = m.signature.replace(/\?/g, ".");
      const head = buf.subarray(0, Math.max(8, m.signature.length)).toString("ascii");
      if (new RegExp(`^${sigStr}`).test(head)) {
        const matchesDeclared = !declaredMime || m.mimeAllowed.includes(declaredMime);
        return { type: m.type, matched: matchesDeclared };
      }
    } else {
      const sig = m.signature;
      if (buf.length < sig.length) continue;
      let ok = true;
      for (let i = 0; i < sig.length; i++) if (buf[i] !== sig[i]) { ok = false; break; }
      if (ok) {
        const matchesDeclared = !declaredMime || m.mimeAllowed.includes(declaredMime);
        return { type: m.type, matched: matchesDeclared };
      }
    }
  }
  return { type: null, matched: false };
}

function heuristicScan(buf: Buffer): { ok: boolean; reason?: string } {
  // Solo escanea los primeros 1MB en modo texto para no comer CPU
  const sample = buf.subarray(0, Math.min(buf.length, 1024 * 1024));
  const asLatin = sample.toString("latin1");
  for (const p of DANGEROUS_PATTERNS) {
    if (p.pattern.test(asLatin)) {
      return { ok: false, reason: `Contenido sospechoso detectado: ${p.name}` };
    }
  }
  return { ok: true };
}

async function virusTotalLookup(sha256: string): Promise<ScanResult["virustotal"] | null> {
  const key = process.env.VIRUSTOTAL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://www.virustotal.com/api/v3/files/${sha256}`, {
      headers: { "x-apikey": key },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const stats = j?.data?.attributes?.last_analysis_stats;
    if (!stats) return null;
    return {
      positives: Number(stats.malicious ?? 0) + Number(stats.suspicious ?? 0),
      total: Number(stats.malicious ?? 0) + Number(stats.suspicious ?? 0) + Number(stats.undetected ?? 0) + Number(stats.harmless ?? 0),
    };
  } catch {
    return null;
  }
}

/**
 * Escanea un archivo (Buffer/Uint8Array) y devuelve si es seguro.
 * Bloqueante: corta antes de procesarlo con OCR si detecta malware.
 */
export async function scanFile(
  buf: Buffer | Uint8Array,
  options: { mimeType?: string; filename?: string } = {},
): Promise<ScanResult> {
  const buffer = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const scanned: string[] = [];

  // 1. Tamaño
  if (buffer.length > MAX_BYTES) {
    return { ok: false, reason: `Archivo demasiado grande (${Math.round(buffer.length / 1024 / 1024)} MB > 12 MB).`, sha256, scanned_by: scanned };
  }

  // 2. Mime declarado vs magic
  scanned.push("magic");
  const declaredMime = options.mimeType?.toLowerCase();
  if (declaredMime && !ALLOWED_MIME.has(declaredMime)) {
    return { ok: false, reason: `Tipo no permitido: ${declaredMime}. Solo PDF e imágenes.`, sha256, scanned_by: scanned };
  }
  const { type, matched } = checkMagic(buffer, declaredMime);
  if (!type) {
    return { ok: false, reason: "El archivo no parece un PDF ni una imagen válida.", sha256, scanned_by: scanned, detected_type: type ?? undefined };
  }
  if (declaredMime && !matched) {
    return { ok: false, reason: `El archivo dice ser ${declaredMime} pero su firma es ${type}.`, sha256, scanned_by: scanned, detected_type: type };
  }

  // 3. Heurística
  scanned.push("heuristic");
  const h = heuristicScan(buffer);
  if (!h.ok) return { ok: false, reason: h.reason ?? "Contenido potencialmente peligroso.", sha256, scanned_by: scanned, detected_type: type };

  // 4. VirusTotal (opcional, no bloquea si falla la consulta)
  const vt = await virusTotalLookup(sha256);
  if (vt) {
    scanned.push("virustotal");
    if (vt.positives >= 2) {
      return { ok: false, reason: `VirusTotal: ${vt.positives}/${vt.total} motores detectan malware.`, sha256, scanned_by: scanned, detected_type: type, virustotal: vt };
    }
  }

  return { ok: true, sha256, scanned_by: scanned, detected_type: type, virustotal: vt ?? undefined };
}
