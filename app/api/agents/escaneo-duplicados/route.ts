import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Escaneo masivo de duplicados en la cartera del gestor.
 *
 * GET ?empresa_id=...&tipo=facturas|gastos|ambos&meses=N
 *
 * Agrupa por (proveedor/contacto_nif + total redondeado + ventana de
 * 15 días). Cada grupo de >=2 elementos es un sospechoso. Calcula
 * confianza basada en cuántas señales coinciden (NIF, total exacto,
 * mismo nº de factura, mismo concepto).
 *
 * Solo gestor/admin pueden lanzarlo.
 */
type Grupo = {
  empresa_id: string;
  empresa_nombre: string | null;
  tipo: "factura" | "gasto";
  parte: string; // proveedor o cliente
  total: number;
  confianza: number;
  items: Array<{ id: string; descripcion: string; fecha: string; total: number; numero?: string | null }>;
  razones: string[];
};

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const admin = createSupabaseAdmin();
  const { data: perfil } = await admin.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  if (perfil?.rol !== "admin" && perfil?.rol !== "gestor") return jsonError("Sin permiso", 403);

  const empresaId = request.nextUrl.searchParams.get("empresa_id");
  const tipo = (request.nextUrl.searchParams.get("tipo") ?? "ambos") as "facturas" | "gastos" | "ambos";
  const meses = Math.min(24, Math.max(1, Number(request.nextUrl.searchParams.get("meses") ?? 6)));

  // Filtro empresas: una concreta o todas las del gestor
  let empresasIds: string[] = [];
  if (empresaId) {
    empresasIds = [empresaId];
  } else if (perfil.rol === "admin") {
    const { data } = await admin.from("empresas").select("id");
    empresasIds = (data ?? []).map((e) => e.id);
  } else {
    const { data } = await admin.from("empresas").select("id").eq("gestor_id", user.id);
    empresasIds = (data ?? []).map((e) => e.id);
  }
  if (empresasIds.length === 0) return NextResponse.json({ ok: true, grupos: [] });

  // Lookup nombres de empresa
  const { data: empresas } = await admin.from("empresas").select("id,nombre").in("id", empresasIds);
  const empMap = new Map((empresas ?? []).map((e) => [e.id, e.nombre]));

  const fechaDesde = new Date();
  fechaDesde.setUTCMonth(fechaDesde.getUTCMonth() - meses);
  const fechaDesdeISO = fechaDesde.toISOString().slice(0, 10);

  const grupos: Grupo[] = [];

  // ===== GASTOS =====
  if (tipo !== "facturas") {
    const { data: gastos } = await admin
      .from("gastos")
      .select("id,empresa_id,proveedor,fecha,total,concepto,metadata")
      .in("empresa_id", empresasIds)
      .gte("fecha", fechaDesdeISO);

    const cubos = new Map<string, typeof gastos>();
    for (const g of gastos ?? []) {
      const meta = (g.metadata ?? {}) as Record<string, unknown>;
      const nif = (meta.proveedor_nif as string | undefined)?.toUpperCase() ?? "";
      const prov = (g.proveedor ?? "").toLowerCase().trim().slice(0, 20);
      const total = Math.round(Number(g.total) * 100) / 100;
      const key = `${g.empresa_id}|${nif || prov}|${total.toFixed(2)}`;
      if (!cubos.has(key)) cubos.set(key, []);
      cubos.get(key)!.push(g);
    }
    for (const items of cubos.values()) {
      if (!items || items.length < 2) continue;
      // dentro del cubo, agrupamos por ventana de 15 días
      items.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
      let win: typeof items = [];
      for (const g of items) {
        if (win.length === 0) {
          win.push(g);
          continue;
        }
        const dias = (new Date(g.fecha + "T00:00:00").getTime() - new Date(win[0].fecha + "T00:00:00").getTime()) / 86_400_000;
        if (dias <= 15) {
          win.push(g);
        } else {
          if (win.length >= 2) pushGastoGrupo(grupos, win, empMap);
          win = [g];
        }
      }
      if (win.length >= 2) pushGastoGrupo(grupos, win, empMap);
    }
  }

  // ===== FACTURAS =====
  if (tipo !== "gastos") {
    const { data: facts } = await admin
      .from("facturas")
      .select("id,empresa_id,numero,serie,contacto_nombre,contacto_nif,fecha_emision,total")
      .in("empresa_id", empresasIds)
      .gte("fecha_emision", fechaDesdeISO);

    const cubos = new Map<string, typeof facts>();
    for (const f of facts ?? []) {
      const nif = (f.contacto_nif ?? "").toUpperCase();
      const cli = (f.contacto_nombre ?? "").toLowerCase().trim().slice(0, 20);
      const total = Math.round(Number(f.total) * 100) / 100;
      const key = `${f.empresa_id}|${nif || cli}|${total.toFixed(2)}`;
      if (!cubos.has(key)) cubos.set(key, []);
      cubos.get(key)!.push(f);
    }
    for (const items of cubos.values()) {
      if (!items || items.length < 2) continue;
      items.sort((a, b) => ((a.fecha_emision ?? "") < (b.fecha_emision ?? "") ? -1 : 1));
      let win: typeof items = [];
      for (const f of items) {
        if (win.length === 0) {
          win.push(f);
          continue;
        }
        const dias = (new Date((f.fecha_emision ?? "") + "T00:00:00").getTime() - new Date((win[0].fecha_emision ?? "") + "T00:00:00").getTime()) / 86_400_000;
        if (dias <= 15) {
          win.push(f);
        } else {
          if (win.length >= 2) pushFactGrupo(grupos, win, empMap);
          win = [f];
        }
      }
      if (win.length >= 2) pushFactGrupo(grupos, win, empMap);
    }
  }

  grupos.sort((a, b) => b.confianza - a.confianza);
  return NextResponse.json({ ok: true, grupos: grupos.slice(0, 200) });
}

function pushGastoGrupo(grupos: Grupo[], items: NonNullable<Awaited<ReturnType<typeof tipoSentinela>>>, empMap: Map<string, string | null>) {
  const ref = items[0];
  const razones: string[] = ["mismo importe"];
  const todosMismoNif = items.every((g) => {
    const meta = (g.metadata ?? {}) as Record<string, unknown>;
    return (meta.proveedor_nif as string | undefined) === ((ref.metadata ?? {}) as Record<string, unknown>).proveedor_nif;
  });
  if (todosMismoNif) razones.push("mismo NIF");
  if (items.every((g) => g.proveedor === ref.proveedor)) razones.push("mismo proveedor");
  const confianza = 50 + (todosMismoNif ? 30 : 0) + (items.length > 2 ? 20 : 10);
  grupos.push({
    empresa_id: ref.empresa_id,
    empresa_nombre: empMap.get(ref.empresa_id) ?? null,
    tipo: "gasto",
    parte: ref.proveedor ?? "—",
    total: Number(ref.total),
    confianza: Math.min(99, confianza),
    razones,
    items: items.map((g) => ({
      id: g.id,
      descripcion: `${g.proveedor ?? "—"} · ${g.concepto ?? ""}`.slice(0, 100),
      fecha: g.fecha,
      total: Number(g.total),
    })),
  });
}

function pushFactGrupo(grupos: Grupo[], items: NonNullable<Awaited<ReturnType<typeof tipoSentinelaFact>>>, empMap: Map<string, string | null>) {
  const ref = items[0];
  const razones: string[] = ["mismo importe"];
  if (items.every((f) => f.contacto_nif === ref.contacto_nif)) razones.push("mismo NIF cliente");
  if (items.every((f) => f.numero === ref.numero) && ref.numero) razones.push("mismo nº de factura");
  const confianza = 55 + (ref.contacto_nif ? 25 : 0) + (items.length > 2 ? 20 : 10);
  grupos.push({
    empresa_id: ref.empresa_id,
    empresa_nombre: empMap.get(ref.empresa_id) ?? null,
    tipo: "factura",
    parte: ref.contacto_nombre ?? "—",
    total: Number(ref.total),
    confianza: Math.min(99, confianza),
    razones,
    items: items.map((f) => ({
      id: f.id,
      descripcion: `${f.serie ?? ""}${f.numero ?? ""} · ${f.contacto_nombre ?? "—"}`,
      fecha: f.fecha_emision ?? "",
      total: Number(f.total),
      numero: f.numero,
    })),
  });
}

// helpers para tipar arrays sin importar el tipo Supabase concreto
function tipoSentinela() { return null as unknown as Array<{ id: string; empresa_id: string; proveedor: string | null; fecha: string; total: number; concepto: string | null; metadata: unknown }>; }
function tipoSentinelaFact() { return null as unknown as Array<{ id: string; empresa_id: string; numero: string | null; serie: string | null; contacto_nombre: string | null; contacto_nif: string | null; fecha_emision: string | null; total: number }>; }
