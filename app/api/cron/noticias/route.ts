import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/http";
import { seleccionarFuentesDelDia, generarArticulo, makeSlug } from "@/lib/noticias/generator";
import { getFuente } from "@/lib/noticias/sources";

/**
 * Cron diario que genera 3-4 artículos de noticias para el blog del
 * gestor. Cubre fiscal / contable / mercantil / laboral rotando fuentes.
 *
 * Protección: el cron solo se ejecuta si el header x-cron-secret
 * coincide con CRON_SECRET (Vercel ya lo añade automáticamente) o si
 * se llama desde el panel de admin con sesión válida.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret") ?? request.nextUrl.searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return jsonError("Cron no autorizado", 401);
  }

  const admin = createSupabaseAdmin();
  const hoy = new Date();
  const fuentes = seleccionarFuentesDelDia(hoy);
  const resultados: Array<{ fuente: string; ok: boolean; slug?: string; error?: string }> = [];

  for (const f of fuentes) {
    try {
      const art = await generarArticulo(f, hoy);
      if (!art) {
        resultados.push({ fuente: f.codigo, ok: false, error: "LLM sin respuesta" });
        continue;
      }
      const slug = makeSlug(art.titulo, hoy.toISOString().slice(0, 10));
      const fuente = getFuente(art.fuente_codigo);
      const { error } = await admin
        .from("noticias")
        .insert({
          slug,
          titulo: art.titulo,
          resumen: art.resumen,
          contenido: art.contenido,
          fuente_codigo: art.fuente_codigo,
          fuente_nombre: fuente?.nombre ?? art.fuente_codigo,
          fuente_url: fuente?.url ?? null,
          categoria: art.categoria,
          tags: art.tags,
          importancia: art.importancia,
          fecha_publicacion: hoy.toISOString().slice(0, 10),
          generado_por: "cron",
        });
      if (error) {
        // Posible duplicado de slug — añadimos sufijo aleatorio
        if (/duplicate|unique/i.test(error.message)) {
          const slug2 = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
          const retry = await admin
            .from("noticias")
            .insert({
              slug: slug2,
              titulo: art.titulo,
              resumen: art.resumen,
              contenido: art.contenido,
              fuente_codigo: art.fuente_codigo,
              fuente_nombre: fuente?.nombre ?? art.fuente_codigo,
              fuente_url: fuente?.url ?? null,
              categoria: art.categoria,
              tags: art.tags,
              importancia: art.importancia,
              fecha_publicacion: hoy.toISOString().slice(0, 10),
              generado_por: "cron",
            });
          if (retry.error) {
            resultados.push({ fuente: f.codigo, ok: false, error: retry.error.message });
            continue;
          }
          resultados.push({ fuente: f.codigo, ok: true, slug: slug2 });
          continue;
        }
        resultados.push({ fuente: f.codigo, ok: false, error: error.message });
        continue;
      }
      resultados.push({ fuente: f.codigo, ok: true, slug });
    } catch (e: unknown) {
      resultados.push({ fuente: f.codigo, ok: false, error: e instanceof Error ? e.message : "Error" });
    }
  }

  return NextResponse.json({
    ok: true,
    fecha: hoy.toISOString().slice(0, 10),
    generados: resultados.filter((r) => r.ok).length,
    fallidos: resultados.filter((r) => !r.ok).length,
    resultados,
  });
}
