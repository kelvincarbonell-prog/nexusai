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
 * Selecciona qué fuentes cubrir cada día. Garantiza 1 artículo fiscal,
 * 1 contable y 1 mercantil cada día (los 3 pilares del gestor). Añade
 * un 4º artículo laboral en rotación.
 */
export function seleccionarFuentesDelDia(fecha = new Date()): FuenteOficial[] {
  const dayIdx = Math.floor(fecha.getTime() / 86_400_000);
  const out: FuenteOficial[] = [];
  const pick = (cat: FuenteCategoria) => {
    const grupo = FUENTES_OFICIALES.filter((f) => f.categoria === cat);
    if (grupo.length === 0) return null;
    return grupo[dayIdx % grupo.length];
  };

  // Pilares obligatorios fiscal/contable/mercantil
  const fiscal = pick("fiscal");
  const contable = pick("contable");
  const mercantil = pick("mercantil");
  if (fiscal) out.push(fiscal);
  if (contable) out.push(contable);
  if (mercantil) out.push(mercantil);

  // 4º artículo: laboral o (rotando) regulacion/datos para complementar
  const extras: FuenteCategoria[] = ["laboral", "laboral", "regulacion", "laboral", "datos", "laboral", "subvenciones"];
  const extra = pick(extras[dayIdx % extras.length]);
  if (extra) out.push(extra);

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

  const prompt = `Eres editor del blog interno de una gestoría española especializada en clientes pyme y autónomos. Hoy es ${fechaISO} (${mes}). Redacta UN artículo profesional sobre actualidad **${fuente.categoria}** (fiscal / contable / mercantil son los 3 pilares; laboral es complementario), basado en la fuente oficial:

FUENTE: ${fuente.nombre}
URL: ${fuente.url}
TEMAS TÍPICOS: ${fuente.temas.join(", ")}

INSTRUCCIONES:
1. El tema DEBE ser claramente ${fuente.categoria}. Ejemplos:
   - fiscal: plazos AEAT, modelos, reformas IRPF/IVA/IS, Veri*Factu, criterios de deducibilidad.
   - contable: cambios PGC, consultas BOICAC, depósito cuentas, criterios ICAC, auditoría.
   - mercantil: BORME (constituciones/ceses), titularidad real, concursos, Registro Mercantil, CIRCE.
   - laboral: SMI, cotización, convenios, registro horario, ERTE.
2. Elige UN tema realista y actual del ${mes} que un gestor necesite tener en el radar.
3. Tono experto pero claro, en ESPAÑOL.
4. Estructura del cuerpo:
   - Párrafo de contexto (qué cambia o qué fecha clave llega).
   - Implicaciones prácticas para el cliente del gestor.
   - Plazos / fechas clave si aplica.
   - Lista (markdown -) con 3-5 acciones concretas que el gestor debe tomar.
5. NO inventes cifras concretas (porcentajes exactos, importes) si no estás 100% seguro: usa "según la última nota de [fuente]" o "consulta el detalle oficial".
6. Longitud: 250-450 palabras.
7. JSON exacto:
{
  "titulo": "Título específico, 8-14 palabras",
  "resumen": "1-2 frases para preview, 30-60 palabras",
  "contenido": "Cuerpo en markdown",
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
