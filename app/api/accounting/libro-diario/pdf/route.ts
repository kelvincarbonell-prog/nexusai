import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

const Q = z.object({
  empresa_id: z.string().uuid(),
  ejercicio: z.coerce.number().int().min(2020).max(2099),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const EUR = (n: number) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/**
 * Libro Diario oficial (Código de Comercio art. 25).
 * Lista cronológica de asientos contables del ejercicio.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const parsed = Q.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const desde = parsed.data.desde ?? `${parsed.data.ejercicio}-01-01`;
  const hasta = parsed.data.hasta ?? `${parsed.data.ejercicio}-12-31`;

  const [{ data: empresa }, { data: entries }] = await Promise.all([
    admin.from("empresas").select("nombre,nif").eq("id", parsed.data.empresa_id).maybeSingle(),
    admin
      .from("journal_entries")
      .select("id,entry_number,entry_date,description,status")
      .eq("empresa_id", parsed.data.empresa_id)
      .gte("entry_date", desde)
      .lte("entry_date", hasta)
      .neq("status", "draft")
      .order("entry_date", { ascending: true })
      .order("entry_number", { ascending: true })
      .limit(5000),
  ]);
  if (!empresa) return jsonError("Empresa no encontrada", 404);

  const ids = (entries ?? []).map((e) => e.id);
  const { data: lines } = await admin
    .from("journal_lines")
    .select("entry_id,account_id,description,debit,credit,line_number")
    .in("entry_id", ids)
    .order("line_number", { ascending: true });
  const accountIds = Array.from(new Set((lines ?? []).map((l) => l.account_id)));
  const { data: accounts } = await admin.from("pgc_accounts").select("id,code,name").in("id", accountIds);
  const accMap = new Map((accounts ?? []).map((a) => [a.id, a]));

  const linesByEntry = new Map<string, typeof lines>();
  for (const l of lines ?? []) {
    const arr = linesByEntry.get(l.entry_id) ?? [];
    arr.push(l);
    linesByEntry.set(l.entry_id, arr);
  }

  // PDF
  const pdf = await PDFDocument.create();
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.07, 0.05, 0.09);
  const muted = rgb(0.5, 0.5, 0.55);
  const line = rgb(0.86, 0.86, 0.88);

  function nuevaPagina(numPag: number) {
    const page = pdf.addPage([595, 842]);
    page.drawText("LIBRO DIARIO", { x: 42, y: 805, size: 14, font: bold, color: ink });
    page.drawText(`${empresa?.nombre ?? ""} · ${empresa?.nif ?? ""} · ${desde} → ${hasta}`, { x: 42, y: 788, size: 9, font: helv, color: muted });
    page.drawText(`Pág. ${numPag}`, { x: 510, y: 805, size: 9, font: bold, color: muted });
    page.drawLine({ start: { x: 42, y: 776 }, end: { x: 553, y: 776 }, thickness: 0.5, color: line });
    // cabecera columnas
    const yh = 760;
    page.drawText("Asiento", { x: 42, y: yh, size: 8, font: bold, color: muted });
    page.drawText("Fecha", { x: 100, y: yh, size: 8, font: bold, color: muted });
    page.drawText("Cuenta", { x: 160, y: yh, size: 8, font: bold, color: muted });
    page.drawText("Concepto", { x: 240, y: yh, size: 8, font: bold, color: muted });
    page.drawText("Debe", { x: 450, y: yh, size: 8, font: bold, color: muted });
    page.drawText("Haber", { x: 510, y: yh, size: 8, font: bold, color: muted });
    return { page, yStart: 746 };
  }

  let numPag = 1;
  let { page, yStart } = nuevaPagina(numPag);
  let y = yStart;
  let totalDebe = 0;
  let totalHaber = 0;

  for (const e of entries ?? []) {
    const ls = linesByEntry.get(e.id) ?? [];
    const altura = 14 * (ls.length + 1) + 4;
    if (y - altura < 60) {
      numPag++;
      ({ page, yStart } = nuevaPagina(numPag));
      y = yStart;
    }
    // cabecera asiento
    page.drawText(String(e.entry_number ?? ""), { x: 42, y, size: 8, font: bold, color: ink });
    page.drawText(e.entry_date ?? "", { x: 100, y, size: 8, font: helv, color: ink });
    page.drawText((e.description ?? "").slice(0, 50), { x: 240, y, size: 8, font: bold, color: ink });
    y -= 12;
    for (const l of ls) {
      const acc = accMap.get(l.account_id);
      page.drawText("", { x: 42, y, size: 8, font: helv });
      page.drawText("", { x: 100, y, size: 8, font: helv });
      page.drawText(acc?.code ?? "", { x: 160, y, size: 8, font: helv, color: ink });
      page.drawText((l.description ?? acc?.name ?? "").slice(0, 50), { x: 240, y, size: 8, font: helv, color: ink });
      if (Number(l.debit ?? 0) > 0) page.drawText(EUR(Number(l.debit)), { x: 450, y, size: 8, font: helv, color: ink });
      if (Number(l.credit ?? 0) > 0) page.drawText(EUR(Number(l.credit)), { x: 510, y, size: 8, font: helv, color: ink });
      totalDebe += Number(l.debit ?? 0);
      totalHaber += Number(l.credit ?? 0);
      y -= 12;
    }
    page.drawLine({ start: { x: 42, y: y + 4 }, end: { x: 553, y: y + 4 }, thickness: 0.2, color: line });
    y -= 4;
  }

  if (y < 80) { numPag++; ({ page } = nuevaPagina(numPag)); y = 740; }
  page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, thickness: 0.8, color: ink });
  y -= 14;
  page.drawText(`TOTALES (${entries?.length ?? 0} asientos)`, { x: 42, y, size: 9, font: bold, color: ink });
  page.drawText(EUR(totalDebe), { x: 450, y, size: 9, font: bold, color: ink });
  page.drawText(EUR(totalHaber), { x: 510, y, size: 9, font: bold, color: ink });

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="libro-diario-${parsed.data.ejercicio}.pdf"`,
    },
  });
}
