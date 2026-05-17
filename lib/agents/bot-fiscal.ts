/**
 * Bot fiscal proactivo: escanea el estado de una empresa y emite alertas
 * priorizadas con acción sugerida. Está pensado para ejecutarse desde
 * dashboard (cliente o gestor) y desde el cron de notificaciones.
 */

import type { createSupabaseAdmin } from "@/lib/supabase/admin";
import { buildCalendar, type Obligacion } from "@/lib/aeat/calendar";

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;

export type AlertaNivel = "info" | "warning" | "danger";
export type AlertaCategoria =
  | "modelos_aeat"
  | "ingresos"
  | "gastos"
  | "tesoreria"
  | "contabilidad"
  | "laboral"
  | "ocr"
  | "conciliacion"
  | "calidad_datos";

export type Alerta = {
  id: string;
  categoria: AlertaCategoria;
  nivel: AlertaNivel;
  titulo: string;
  descripcion: string;
  cta?: { label: string; href: string };
  ts: string;
};

const HOY_ISO = () => new Date().toISOString();
const fmtEur = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export async function scanEmpresa(
  admin: SupabaseAdmin,
  empresaId: string,
): Promise<{ empresa_id: string; resumen: { total: number; danger: number; warning: number; info: number }; alertas: Alerta[] }> {
  const alertas: Alerta[] = [];
  const now = new Date();
  const yyyymm = now.toISOString().slice(0, 7);
  const yyyymmPrev = (() => {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return d.toISOString().slice(0, 7);
  })();

  const { data: empresa } = await admin
    .from("empresas")
    .select("id,nombre,nif,iban,tipo,gestor_id")
    .eq("id", empresaId)
    .maybeSingle();
  if (!empresa) {
    return { empresa_id: empresaId, resumen: { total: 0, danger: 0, warning: 0, info: 0 }, alertas: [] };
  }
  const empresaTipo: "autonomo" | "empresa" = empresa.tipo === "empresa" ? "empresa" : "autonomo";

  // ----- 1. Modelos AEAT con plazo cercano y no presentados -----
  const { data: presentados } = await admin
    .from("aeat_presentaciones")
    .select("modelo,ejercicio,periodo")
    .eq("empresa_id", empresaId)
    .limit(200);

  const calendar: Obligacion[] = buildCalendar({
    empresaTipo,
    presentadas: (presentados ?? []).map((p) => ({
      modelo: String(p.modelo),
      ejercicio: Number(p.ejercicio),
      periodo: String(p.periodo),
    })),
    horizonteDias: 30,
    now,
  });

  for (const o of calendar) {
    if (o.esta_presentada) continue;
    if (o.dias_restantes < 0) {
      alertas.push({
        id: `aeat-${o.modelo}-${o.ejercicio}-${o.periodo}-vencido`,
        categoria: "modelos_aeat",
        nivel: "danger",
        titulo: `${o.modelo} (${o.periodo} · ${o.ejercicio}) vencido`,
        descripcion: `Plazo expiró hace ${Math.abs(o.dias_restantes)} días. Presenta cuanto antes con recargo por presentación fuera de plazo.`,
        cta: { label: "Ir a modelos AEAT", href: `/aeat?empresa=${empresaId}` },
        ts: HOY_ISO(),
      });
    } else if (o.dias_restantes <= 7) {
      alertas.push({
        id: `aeat-${o.modelo}-${o.ejercicio}-${o.periodo}-7d`,
        categoria: "modelos_aeat",
        nivel: "danger",
        titulo: `${o.modelo} (${o.periodo} · ${o.ejercicio}) vence en ${o.dias_restantes} días`,
        descripcion: `Modelo pendiente de presentar. Plazo: ${o.fecha_limite}.`,
        cta: { label: "Preparar modelo", href: `/aeat?empresa=${empresaId}&modelo=${o.modelo}` },
        ts: HOY_ISO(),
      });
    } else if (o.dias_restantes <= 14) {
      alertas.push({
        id: `aeat-${o.modelo}-${o.ejercicio}-${o.periodo}-14d`,
        categoria: "modelos_aeat",
        nivel: "warning",
        titulo: `${o.modelo} (${o.periodo} · ${o.ejercicio}) en ${o.dias_restantes} días`,
        descripcion: `Plazo el ${o.fecha_limite}. Revisa libros y prepáralo con margen.`,
        cta: { label: "Revisar libros", href: `/contabilidad?empresa=${empresaId}` },
        ts: HOY_ISO(),
      });
    }
  }

  // ----- 2. Facturas emitidas vencidas no cobradas -----
  const hoyStr = now.toISOString().slice(0, 10);
  const { data: vencidas } = await admin
    .from("facturas")
    .select("id,numero,contacto_nombre,total,fecha_vencimiento")
    .eq("empresa_id", empresaId)
    .in("tipo", ["emitida", "simplificada"])
    .neq("estado", "cobrada")
    .lt("fecha_vencimiento", hoyStr)
    .limit(100);

  const totalVencido = (vencidas ?? []).reduce((s, f) => s + Number(f.total ?? 0), 0);
  if (vencidas && vencidas.length > 0) {
    alertas.push({
      id: `cobros-vencidos`,
      categoria: "tesoreria",
      nivel: totalVencido > 5000 ? "danger" : "warning",
      titulo: `${vencidas.length} factura${vencidas.length === 1 ? "" : "s"} vencida${vencidas.length === 1 ? "" : "s"} sin cobrar`,
      descripcion: `Importe pendiente: ${fmtEur(totalVencido)}. Envía recordatorios o activa Stripe Link.`,
      cta: { label: "Ver facturas vencidas", href: `/facturacion?empresa=${empresaId}&filtro=vencidas` },
      ts: HOY_ISO(),
    });
  }

  // ----- 3. Gastos OCR pendientes de revisión (baja confianza) -----
  const { data: bajos } = await admin
    .from("facturas_recibidas_extracciones")
    .select("id,filename,confidence,status")
    .eq("empresa_id", empresaId)
    .in("status", ["pending", "extracted"])
    .lt("confidence", 70)
    .limit(50);
  if (bajos && bajos.length > 0) {
    alertas.push({
      id: `ocr-revision`,
      categoria: "ocr",
      nivel: "warning",
      titulo: `${bajos.length} factura${bajos.length === 1 ? "" : "s"} pendiente de revisar`,
      descripcion: `El OCR identificó datos con baja confianza. Confírmalos manualmente para que entren en libros.`,
      cta: { label: "Revisar OCR", href: `/clientes?empresa=${empresaId}&tab=lector-gastos` },
      ts: HOY_ISO(),
    });
  }

  // ----- 4. Movimientos N43 sin conciliar -----
  const { data: pendientes } = await admin
    .from("bank_movements")
    .select("id,fecha_operacion,importe,concepto_comun")
    .eq("empresa_id", empresaId)
    .eq("reconciled", false)
    .limit(50);
  if (pendientes && pendientes.length > 5) {
    alertas.push({
      id: `n43-pendientes`,
      categoria: "conciliacion",
      nivel: "info",
      titulo: `${pendientes.length} movimientos bancarios sin conciliar`,
      descripcion: `Tienes movimientos N43 sin enlazar con facturas o gastos. Conciliarlos mejora la tesorería.`,
      cta: { label: "Ir a conciliación", href: `/contabilidad?empresa=${empresaId}&tab=conciliacion` },
      ts: HOY_ISO(),
    });
  }

  // ----- 5. Tendencia: facturado actual vs mismo mes año anterior -----
  const startActual = `${yyyymm}-01`;
  const endActual = `${yyyymm}-31`;
  const prevYear = `${now.getUTCFullYear() - 1}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const startYoY = `${prevYear}-01`;
  const endYoY = `${prevYear}-31`;
  const [actualRes, yoyRes] = await Promise.all([
    admin
      .from("facturas")
      .select("base")
      .eq("empresa_id", empresaId)
      .in("tipo", ["emitida", "simplificada"])
      .gte("fecha_emision", startActual)
      .lte("fecha_emision", endActual),
    admin
      .from("facturas")
      .select("base")
      .eq("empresa_id", empresaId)
      .in("tipo", ["emitida", "simplificada"])
      .gte("fecha_emision", startYoY)
      .lte("fecha_emision", endYoY),
  ]);
  const totalActual = (actualRes.data ?? []).reduce((s, f) => s + Number(f.base ?? 0), 0);
  const totalYoy = (yoyRes.data ?? []).reduce((s, f) => s + Number(f.base ?? 0), 0);
  if (totalYoy > 0 && totalActual < totalYoy * 0.7) {
    const caidaPct = Math.round(((totalActual - totalYoy) / totalYoy) * 100);
    alertas.push({
      id: `tendencia-ingresos`,
      categoria: "ingresos",
      nivel: "warning",
      titulo: `Facturación del mes ${caidaPct}% por debajo del año anterior`,
      descripcion: `Actual: ${fmtEur(totalActual)} · Mismo mes ${prevYear.slice(0, 4)}: ${fmtEur(totalYoy)}. Considera revisar pipeline comercial.`,
      cta: { label: "Ver comparativa", href: `/contabilidad?empresa=${empresaId}` },
      ts: HOY_ISO(),
    });
  }

  // ----- 6. Trabajadores sin nómina en el mes anterior -----
  const { data: trabajadores } = await admin
    .from("trabajadores")
    .select("id,nombre,activo")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .limit(200);
  if (trabajadores && trabajadores.length > 0) {
    const trabIds = trabajadores.map((t) => t.id);
    const { data: nominas } = await admin
      .from("nominas")
      .select("trabajador_id,periodo")
      .in("trabajador_id", trabIds)
      .eq("periodo", yyyymmPrev);
    const conNomina = new Set((nominas ?? []).map((n) => n.trabajador_id));
    const sinNomina = trabajadores.filter((t) => !conNomina.has(t.id));
    if (sinNomina.length > 0) {
      alertas.push({
        id: `nominas-pendientes-${yyyymmPrev}`,
        categoria: "laboral",
        nivel: "warning",
        titulo: `${sinNomina.length} trabajador${sinNomina.length === 1 ? "" : "es"} sin nómina de ${yyyymmPrev}`,
        descripcion: `Genera las nóminas pendientes para evitar incidencias con SS y modelo 111.`,
        cta: { label: "Ir a laboral", href: `/laboral?empresa=${empresaId}` },
        ts: HOY_ISO(),
      });
    }
  }

  // ----- 7. Gastos sin contabilizar (sin asiento) en el mes anterior -----
  const { data: gastosSinAsiento } = await admin
    .from("gastos")
    .select("id,fecha,total")
    .eq("empresa_id", empresaId)
    .gte("fecha", `${yyyymmPrev}-01`)
    .lte("fecha", `${yyyymmPrev}-31`)
    .limit(500);
  if (gastosSinAsiento && gastosSinAsiento.length > 0) {
    const ids = gastosSinAsiento.map((g) => g.id);
    const { data: asientos } = await admin
      .from("journal_entries")
      .select("source_id")
      .eq("source_type", "gasto")
      .in("source_id", ids);
    const contabilizados = new Set((asientos ?? []).map((a) => a.source_id));
    const pendientes = gastosSinAsiento.filter((g) => !contabilizados.has(g.id));
    if (pendientes.length > 0) {
      const total = pendientes.reduce((s, g) => s + Number(g.total ?? 0), 0);
      alertas.push({
        id: `gastos-sin-asiento-${yyyymmPrev}`,
        categoria: "contabilidad",
        nivel: "info",
        titulo: `${pendientes.length} gasto${pendientes.length === 1 ? "" : "s"} sin asiento contable`,
        descripcion: `Total ${fmtEur(total)} sin contabilizar del mes ${yyyymmPrev}. Ejecuta auto-asientos.`,
        cta: { label: "Generar asientos", href: `/contabilidad?empresa=${empresaId}` },
        ts: HOY_ISO(),
      });
    }
  }

  // ----- 8. Calidad de datos: empresa sin IBAN/NIF/correo -----
  if (!empresa.iban) {
    alertas.push({
      id: `iban-faltante`,
      categoria: "calidad_datos",
      nivel: "info",
      titulo: "Falta IBAN de la empresa",
      descripcion: "Sin IBAN no se pueden conciliar movimientos bancarios ni emitir SEPA. Configúralo en datos fiscales.",
      cta: { label: "Configurar empresa", href: `/clientes?empresa=${empresaId}&tab=configuracion` },
      ts: HOY_ISO(),
    });
  }
  if (!empresa.nif) {
    alertas.push({
      id: `nif-faltante`,
      categoria: "calidad_datos",
      nivel: "warning",
      titulo: "Falta NIF/CIF de la empresa",
      descripcion: "Imprescindible para facturación válida y modelos AEAT.",
      cta: { label: "Configurar empresa", href: `/clientes?empresa=${empresaId}&tab=configuracion` },
      ts: HOY_ISO(),
    });
  }

  // Ordena por severidad (danger → warning → info) y luego por título
  const orden: Record<AlertaNivel, number> = { danger: 0, warning: 1, info: 2 };
  alertas.sort((a, b) => orden[a.nivel] - orden[b.nivel] || a.titulo.localeCompare(b.titulo));

  const resumen = {
    total: alertas.length,
    danger: alertas.filter((a) => a.nivel === "danger").length,
    warning: alertas.filter((a) => a.nivel === "warning").length,
    info: alertas.filter((a) => a.nivel === "info").length,
  };

  return { empresa_id: empresaId, resumen, alertas };
}
