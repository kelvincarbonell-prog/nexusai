import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { canAccessLaborCompany } from "@/lib/laboral/access";

const Q = z.object({
  empresa_id: z.string().uuid(),
  trabajador_id: z.string().uuid(),
  periodo: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

/**
 * GET /api/laboral/registro-horario/pdf?empresa_id=...&trabajador_id=...&periodo=YYYY-MM
 *
 * Genera el PDF mensual de registro horario obligatorio (RD 8/2019).
 * Incluye empresa, trabajador, tabla diaria con entrada/salida/horas/descansos
 * y declaración de veracidad para firma.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const parsed = Q.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return jsonError("Parámetros inválidos");

  const admin = createSupabaseAdmin();
  if (!(await canAccessLaborCompany(admin, user.id, parsed.data.empresa_id))) return jsonError("Sin acceso", 403);

  const [year, month] = parsed.data.periodo.split("-").map(Number);
  const from = `${parsed.data.periodo}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${parsed.data.periodo}-${String(lastDay).padStart(2, "0")}`;

  const [{ data: empresa }, { data: trabajador }, { data: fichajes }] = await Promise.all([
    admin.from("empresas").select("nombre,nif").eq("id", parsed.data.empresa_id).maybeSingle(),
    admin
      .from("trabajadores")
      .select("nombre,apellidos,dni,nss,puesto,jornada_horas")
      .eq("id", parsed.data.trabajador_id)
      .maybeSingle(),
    admin
      .from("registro_horario")
      .select("fecha,hora_entrada,hora_salida,descanso_min,observaciones,fuente")
      .eq("empresa_id", parsed.data.empresa_id)
      .eq("trabajador_id", parsed.data.trabajador_id)
      .gte("fecha", from)
      .lte("fecha", to)
      .order("fecha", { ascending: true })
      .order("hora_entrada", { ascending: true }),
  ]);
  if (!empresa || !trabajador) return jsonError("Empresa o trabajador no encontrado", 404);

  // Agrega por día
  type Dia = { fecha: string; entrada: string; salida: string; descanso: number; horas: number; obs: string };
  const dias: Dia[] = (fichajes ?? []).map((f) => {
    const ent = f.hora_entrada ? new Date(f.hora_entrada).toISOString().slice(11, 16) : "—";
    const sal = f.hora_salida ? new Date(f.hora_salida).toISOString().slice(11, 16) : "—";
    let horas = 0;
    if (f.hora_entrada && f.hora_salida) {
      const ms = new Date(f.hora_salida).getTime() - new Date(f.hora_entrada).getTime();
      horas = Math.max(0, ms / 3_600_000 - (Number(f.descanso_min ?? 0) / 60));
    }
    return { fecha: f.fecha, entrada: ent, salida: sal, descanso: Number(f.descanso_min ?? 0), horas: Math.round(horas * 100) / 100, obs: f.observaciones ?? "" };
  });
  const totalHoras = Math.round(dias.reduce((s, d) => s + d.horas, 0) * 100) / 100;

  // Construye PDF
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.10, 0.10, 0.12);
  const muted = rgb(0.50, 0.50, 0.55);
  const line = rgb(0.85, 0.85, 0.85);

  page.drawText("REGISTRO HORARIO MENSUAL", { x: 42, y: 805, size: 14, font: bold, color: ink });
  page.drawText(`RD 8/2019 · Periodo ${parsed.data.periodo}`, { x: 42, y: 788, size: 9, font: helv, color: muted });
  page.drawLine({ start: { x: 42, y: 776 }, end: { x: 553, y: 776 }, thickness: 0.5, color: line });

  // Datos cabecera
  let y = 752;
  page.drawText("Empresa", { x: 42, y, size: 8, font: bold, color: muted });
  page.drawText("Trabajador/a", { x: 320, y, size: 8, font: bold, color: muted });
  y -= 13;
  page.drawText(empresa.nombre ?? "—", { x: 42, y, size: 11, font: bold, color: ink });
  const nombreCompleto = trabajador.apellidos ? `${trabajador.apellidos}, ${trabajador.nombre}` : trabajador.nombre;
  page.drawText(nombreCompleto, { x: 320, y, size: 11, font: bold, color: ink });
  y -= 12;
  page.drawText(`NIF: ${empresa.nif ?? "—"}`, { x: 42, y, size: 9, font: helv, color: muted });
  page.drawText(`DNI: ${trabajador.dni ?? "—"}`, { x: 320, y, size: 9, font: helv, color: muted });
  y -= 11;
  page.drawText(`Puesto: ${trabajador.puesto ?? "—"}`, { x: 320, y, size: 9, font: helv, color: muted });
  page.drawText(`NSS: ${trabajador.nss ?? "—"}`, { x: 42, y, size: 9, font: helv, color: muted });

  // Tabla
  y -= 26;
  const xCols = [42, 130, 200, 270, 340, 410];
  const headers = ["Fecha", "Entrada", "Salida", "Descanso", "Horas", "Observaciones"];
  for (let i = 0; i < headers.length; i++) {
    page.drawText(headers[i], { x: xCols[i], y, size: 8, font: bold, color: muted });
  }
  y -= 6;
  page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, thickness: 0.5, color: line });
  y -= 10;

  for (const d of dias) {
    if (y < 80) {
      page = pdf.addPage([595, 842]);
      y = 800;
    }
    const fechaFmt = new Date(d.fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", weekday: "short" });
    page.drawText(fechaFmt, { x: xCols[0], y, size: 9, font: helv, color: ink });
    page.drawText(d.entrada, { x: xCols[1], y, size: 9, font: helv, color: ink });
    page.drawText(d.salida, { x: xCols[2], y, size: 9, font: helv, color: ink });
    page.drawText(`${d.descanso} min`, { x: xCols[3], y, size: 9, font: helv, color: ink });
    page.drawText(`${d.horas.toFixed(2)} h`, { x: xCols[4], y, size: 9, font: bold, color: ink });
    if (d.obs) page.drawText(d.obs.slice(0, 30), { x: xCols[5], y, size: 8, font: helv, color: muted });
    y -= 14;
  }

  // Total
  y -= 6;
  page.drawLine({ start: { x: 42, y }, end: { x: 553, y }, thickness: 0.5, color: line });
  y -= 14;
  page.drawText(`Total horas registradas en ${parsed.data.periodo}:`, { x: 42, y, size: 10, font: bold, color: ink });
  page.drawText(`${totalHoras.toFixed(2)} h`, { x: 480, y, size: 12, font: bold, color: ink });

  // Declaración + firmas
  y -= 36;
  page.drawText("Declaración", { x: 42, y, size: 9, font: bold, color: muted });
  y -= 13;
  page.drawText("Empresa y trabajador/a declaran que los datos arriba reflejados son ciertos y", { x: 42, y, size: 9, font: helv, color: ink });
  y -= 11;
  page.drawText("se ajustan a la jornada efectivamente realizada en el periodo indicado.", { x: 42, y, size: 9, font: helv, color: ink });

  y -= 50;
  page.drawLine({ start: { x: 90, y }, end: { x: 230, y }, thickness: 0.5, color: line });
  page.drawLine({ start: { x: 350, y }, end: { x: 510, y }, thickness: 0.5, color: line });
  y -= 12;
  page.drawText("Firma empresa", { x: 130, y, size: 8, font: helv, color: muted });
  page.drawText("Firma trabajador/a", { x: 395, y, size: 8, font: helv, color: muted });

  // Footer
  page.drawText(
    `Generado el ${new Date().toLocaleString("es-ES")} · Hash: ${Buffer.from(`${parsed.data.empresa_id}|${parsed.data.trabajador_id}|${parsed.data.periodo}|${totalHoras}`).toString("base64").slice(0, 20)}`,
    { x: 42, y: 30, size: 7, font: helv, color: muted },
  );

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="registro-horario-${(trabajador.dni ?? parsed.data.trabajador_id.slice(0, 8))}-${parsed.data.periodo}.pdf"`,
    },
  });
}
