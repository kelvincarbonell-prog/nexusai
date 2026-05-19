/**
 * Generador diario de noticias. Cada día el cron pide a la LLM que
 * redacte 3-5 artículos de blog sobre actualidad fiscal / contable /
 * mercantil / laboral, basándose en las fuentes oficiales del catálogo.
 *
 * La LLM redacta artículos profesionales (no solo titulares), pensados
 * para que el gestor los lea por la mañana con su café.
 */

import { bestAvailableJSON } from "@/lib/agents/llm";
import { FUENTES_OFICIALES, type FuenteCategoria, type FuenteOficial } from "@/lib/noticias/sources";

export type ArticuloGenerado = {
  titulo: string;
  resumen: string;
  contenido: string;          // markdown
  fuente_codigo: string;
  categoria: FuenteCategoria;
  tags: string[];
  importancia: "alta" | "normal" | "baja";
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function makeSlug(titulo: string, fecha: string): string {
  return `${fecha}-${slugify(titulo)}`;
}

/**
 * Selecciona qué fuentes cubrir cada día. Rota por bloques para que en
 * una semana se haya cubierto todo. Prioriza fiscal/contable/mercantil/laboral.
 */
export function seleccionarFuentesDelDia(fecha = new Date()): FuenteOficial[] {
  // 2 fuentes prioritarias (fiscal/contable/laboral/mercantil) + 1 secundaria
  const prioritarias = FUENTES_OFICIALES.filter((f) =>
    ["fiscal", "contable", "laboral", "mercantil"].includes(f.categoria)
  );
  const secundarias = FUENTES_OFICIALES.filter((f) =>
    !["fiscal", "contable", "laboral", "mercantil"].includes(f.categoria)
  );

  const dayIdx = Math.floor(fecha.getTime() / 86_400_000);
  const out: FuenteOficial[] = [];
  for (let i = 0; i < 3; i++) {
    out.push(prioritarias[(dayIdx * 3 + i) % prioritarias.length]);
  }
  out.push(secundarias[dayIdx % secundarias.length]);
  return out;
}

/**
 * Llama a la LLM para generar un artículo de blog para una fuente.
 * Si la LLM falla, devuelve null (el cron lo registra como aviso).
 */
export async function generarArticulo(
  fuente: FuenteOficial,
  fecha: Date = new Date()
): Promise<ArticuloGenerado | null> {
  const fechaISO = fecha.toISOString().slice(0, 10);
  const mes = fecha.toLocaleString("es-ES", { month: "long", year: "numeric" });

  const prompt = `Eres editor de un blog interno de una gestoría española. Hoy es ${fechaISO} (${mes}). Te encargas de redactar UN artículo de blog profesional sobre actualidad ${fuente.categoria} española, centrado en la fuente oficial:

FUENTE: ${fuente.nombre}
URL: ${fuente.url}
TEMAS TÍPICOS QUE COBRE: ${fuente.temas.join(", ")}

INSTRUCCIONES:
1. Elige UN tema realista y actual del ${mes} que un gestor fiscal/contable/laboral/mercantil necesite conocer.
2. Redacta un artículo profesional en ESPAÑOL, tono experto pero claro.
3. Estructura del cuerpo:
   - Párrafo de contexto (qué ha cambiado o qué fecha clave llega).
   - Implicaciones prácticas para el cliente del gestor.
   - Plazos / fechas clave si aplica.
   - Lista (markdown -) con 3-5 acciones concretas que debe tomar el gestor.
4. NO inventes cifras concretas (porcentajes, importes) si no estás seguro: usa frases como "según la última nota de [fuente]" o "consulta el detalle en…".
5. Longitud: 250-450 palabras.
6. El JSON de salida debe ser EXACTAMENTE:
{
  "titulo": "Título atractivo y específico, 8-14 palabras",
  "resumen": "1-2 frases para preview en el listado, 30-60 palabras",
  "contenido": "Cuerpo completo del artículo en markdown",
  "tags": ["tag1","tag2","tag3"],
  "importancia": "alta" | "normal" | "baja"
}

Devuelve SOLO el JSON, sin código alrededor, sin explicaciones.`;

  try {
    const llm = await bestAvailableJSON(prompt);
    if (!llm.ok || !llm.text) return null;
    // Limpiar posibles fences markdown
    const limpio = llm.text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const json = JSON.parse(limpio);
    if (!json.titulo || !json.contenido) return null;
    return {
      titulo: String(json.titulo).slice(0, 200),
      resumen: String(json.resumen ?? json.titulo).slice(0, 400),
      contenido: String(json.contenido),
      fuente_codigo: fuente.codigo,
      categoria: fuente.categoria,
      tags: Array.isArray(json.tags) ? json.tags.slice(0, 8).map((t: unknown) => String(t).slice(0, 30)) : [],
      importancia: ["alta", "normal", "baja"].includes(json.importancia) ? json.importancia : "normal",
    };
  } catch {
    return null;
  }
}
