import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { isGestorOrAdmin } from "@/lib/laboral/access";

/**
 * Boletines TC1 (resumen empresa) y TC2 (detalle por trabajador) en un solo
 * PDF, listos para archivar / presentar al ayuntamiento.
 *
 * NOTA: La presentación oficial se hace por SLD/SILTRA con el fichero FAN.
 * Este PDF es el "justificante interno" que A3NOM y todos los softwares
 * generan para que el gestor lo archive en el dossier del cliente.
 */
const Q = z.object({
  empresa_id: z.string().uuid(),
  periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Q.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  if (!(await isGestorOrAdmin(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin permiso", 403);

  const [{ data: empresa }, { data: nominas }] = await Promise.all([
    admin.from("empresas").select("nombre,nif,ccc").eq("id", parsed.data.empresa_id).maybeSingle(),
    admin
      .from("nominas")
      .select("id,trabajador_id,total,metadata")
      .eq("empresa_id", parsed.data.empresa_id)
      .eq("periodo", parsed.data.periodo),
  ]);
  if (!empresa) return jsonError("Empresa no encontrada", 404);
  if (!nominas || nominas.length === 0) return jsonError(`Sin nóminas para ${parsed.data.periodo}`);

  const trabIds = nominas.map((n) => n.trabajador_id).filter(Boolean) as string[];
  const { data: trabajadores } = await admin
    .from("trabajadores")
    .select("id,nombre,apellidos,dni,nss,grupo_cotizacion")
    .in("id", trabIds);
  const trabMap = new Map((trabajadores ?? []).map((t) => [t.id, t]));

  // Construir PDF
  const pdf = await PDFDocument.create();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.08, 0.06, 0.10);
  const muted = rgb(0.5, 0.5, 0.55);
  const line = rgb(0.86, 0.86, 0.88);
  const accent = rgb(0.39, 0.40, 0.95);

  // ========== TC2 — detalle trabajador ==========
  let page = pdf.addPage([595, 842]);
  page.drawText("BOLETÍN DE COTIZACIÓN · TC2 DETALLE", { x: 42, y: 805, size: 14, font: bold, color: ink });
  page.drawText(`${empresa.nombre ?? "—"} · NIF ${empresa.nif ?? "—"} · CCC ${empresa.ccc ?? "—"} · Periodo ${parsed.data.periodo}`, { x: 42, y: 788, size: 9, font: helv, color: muted });
  page.drawLine({ start: { x: 42, y: 776 }, end: { x: 553, y: 776 }, thickness: 0.5, color: line });

  let y = 758;
  const headers = ["NAF", "Trabajador", "Grupo", "Base CC", "SS empresa", "SS trab", "Líquido"];
  const xs = [42, 110, 250, 290, 360, 430, 500];
  for (let i = 0; i < headers.length; i++) {
    page.drawText(headers[i], { x: xs[i], y, size: 8, font: bold, color: muted });
  }
  y -= 6;
  page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, thickness: 0.4, color: line });
  y -= 10;

  let totBaseCC = 0;
  let totSsEmpresa = 0;
  let totSsTrab = 0;
  let totLiquido = 0;
  let totIrpf = 0;

  for (const n of nominas) {
    if (y < 70) {
      page = pdf.addPage([595, 842]);
      y = 790;
    }
    const t = n.trabajador_id ? trabMap.get(n.trabajador_id) : null;
    const meta = (n.metadata ?? {}) as Record<string, number | undefined>;
    const baseCC = Number(meta.base_cotizacion_cc ?? 0);
    const ssEmp = Number(meta.ss_empresa_neta ?? meta.ss_empresa ?? 0);
    const ssTrab = Number(meta.ss_trabajador ?? 0);
    const liquido = Number(meta.liquido ?? n.total ?? 0);
    const irpf = Number(meta.irpf_retenido ?? 0);

    page.drawText((t?.nss ?? "—").slice(0, 12), { x: xs[0], y, size: 9, font: helv, color: ink });
    page.drawText(((t?.apellidos ? `${t.apellidos}, ${t.nombre}` : t?.nombre ?? "—")).slice(0, 22), { x: xs[1], y, size: 9, font: helv, color: ink });
    page.drawText(String(t?.grupo_cotizacion ?? "—"), { x: xs[2], y, size: 9, font: helv, color: ink });
    page.drawText(EUR(baseCC), { x: xs[3], y, size: 9, font: helv, color: ink });
    page.drawText(EUR(ssEmp), { x: xs[4], y, size: 9, font: helv, color: ink });
    page.drawText(EUR(ssTrab), { x: xs[5], y, size: 9, font: helv, color: ink });
    page.drawText(EUR(liquido), { x: xs[6], y, size: 9, font: bold, color: ink });

    totBaseCC += baseCC;
    totSsEmpresa += ssEmp;
    totSsTrab += ssTrab;
    totLiquido += liquido;
    totIrpf += irpf;
    y -= 13;
  }

  // ========== TC1 — resumen empresa ==========
  page = pdf.addPage([595, 842]);
  page.drawText("BOLETÍN DE COTIZACIÓN · TC1 RESUMEN", { x: 42, y: 805, size: 14, font: bold, color: ink });
  page.drawText(`${empresa.nombre ?? "—"} · NIF ${empresa.nif ?? "—"} · CCC ${empresa.ccc ?? "—"} · Periodo ${parsed.data.periodo}`, { x: 42, y: 788, size: 9, font: helv, color: muted });
  page.drawLine({ start: { x: 42, y: 776 }, end: { x: 553, y: 776 }, thickness: 0.5, color: line });

  const rows = [
    { label: "Trabajadores cotizando", valor: String(nominas.length) },
    { label: "Total base cotización CC", valor: EUR(totBaseCC) },
    { label: "SS a cargo empresa", valor: EUR(totSsEmpresa) },
    { label: "SS a cargo trabajador", valor: EUR(totSsTrab) },
    { label: "TOTAL a ingresar TGSS", valor: EUR(totSsEmpresa + totSsTrab), highlight: true },
    { label: "IRPF retenido (modelo 111)", valor: EUR(totIrpf) },
    { label: "Total líquido pagado", valor: EUR(totLiquido) },
    { label: "COSTE TOTAL EMPRESA", valor: EUR(totBaseCC + totSsEmpresa - totLiquido + totLiquido), highlight: true },
  ];

  y = 740;
  for (const r of rows) {
    if (r.highlight) {
      page.drawRectangle({ x: 42, y: y - 4, width: 511, height: 1.2, color: accent });
      y -= 10;
    }
    page.drawText(r.label, { x: 50, y, size: 11, font: r.highlight ? bold : helv, color: ink });
    page.drawText(r.valor, { x: 470, y, size: 11, font: r.highlight ? bold : helv, color: r.highlight ? accent : ink });
    y -= 18;
  }

  page.drawText(`Generado el ${new Date().toLocaleString("es-ES")} · Documento de justificación interna.`, { x: 42, y: 40, size: 8, font: helv, color: muted });
  page.drawText("La liquidación oficial se presenta vía SILTRA con el fichero FAN.", { x: 42, y: 28, size: 8, font: helv, color: muted });

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="TC1-TC2-${parsed.data.periodo}-${empresa.nif}.pdf"`,
    },
  });
}
