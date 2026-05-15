import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { z } from "zod";
import { jsonError, refId } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";

const DocumentRequest = z.object({
  docTipo: z.string().min(1).max(120).default("Documento"),
  empresaId: z.string().uuid().optional(),
  empresa: z.string().max(180).default("Sin nombre"),
  nif: z.string().max(30).default("-"),
  gestoria: z.string().max(180).default("Mi gestoría"),
  gestor: z.string().max(180).default("-"),
  descripcion: z.string().max(3000).default("Documento generado por NexusAI para firma electrónica."),
});

export async function POST(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = DocumentRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Body inválido");

  const ref = refId();
  const data = parsed.data;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 42, y: 760, width: 511, height: 48, color: rgb(0.08, 0.36, 0.29) });
  page.drawText(data.docTipo, { x: 58, y: 786, size: 15, font: bold, color: rgb(1, 1, 1) });
  page.drawText(ref, { x: 430, y: 786, size: 8, font: regular, color: rgb(0.86, 0.93, 0.88) });

  const rows = [
    ["Cliente / Empresa", data.empresa],
    ["NIF / CIF", data.nif],
    ["Asesor responsable", data.gestor],
    ["Gestoría", data.gestoria],
    ["Generado por", user.email ?? user.id],
  ];

  let y = 720;
  for (const [label, value] of rows) {
    page.drawText(`${label}:`, { x: 58, y, size: 10, font: bold, color: rgb(0.28, 0.32, 0.3) });
    page.drawText(value, { x: 190, y, size: 10, font: regular, color: rgb(0.08, 0.13, 0.11) });
    y -= 22;
  }

  y -= 18;
  page.drawText("OBJETO DEL DOCUMENTO", { x: 58, y, size: 10, font: bold, color: rgb(0.08, 0.36, 0.29) });
  y -= 22;
  for (const line of wrap(data.descripcion, 92)) {
    page.drawText(line, { x: 58, y, size: 10, font: regular, color: rgb(0.08, 0.13, 0.11) });
    y -= 16;
  }

  page.drawRectangle({ x: 58, y: 120, width: 210, height: 70, borderColor: rgb(0.75, 0.78, 0.74), borderWidth: 1 });
  page.drawRectangle({ x: 327, y: 120, width: 210, height: 70, borderColor: rgb(0.75, 0.78, 0.74), borderWidth: 1 });
  page.drawText("Firma del cliente / firmante", { x: 68, y: 170, size: 8, font: regular, color: rgb(0.38, 0.44, 0.4) });
  page.drawText("Sello / firma de la gestoria", { x: 337, y: 170, size: 8, font: regular, color: rgb(0.38, 0.44, 0.4) });

  const bytes = await pdf.save();
  const b64 = Buffer.from(bytes).toString("base64");

  return NextResponse.json({
    ok: true,
    ref,
    b64,
    hash: await sha256(bytes),
    filename: `${ref}.pdf`,
    size: bytes.length,
  });
}

function wrap(text: string, max: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (`${line} ${word}`.trim().length > max) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function sha256(bytes: Uint8Array) {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
