import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { validarNIF, detectarTipoNIF } from "@/lib/validation/spanish";

/**
 * Lookup de NIF/CIF a razón social.
 *
 * Estrategia:
 *  1. Buscar en empresas previas del propio gestor (caché interna).
 *  2. Buscar en contactos previos de cualquier empresa accesible.
 *  3. Devolver el nombre encontrado + indicador del origen.
 *
 * No consultamos al censo AEAT desde aquí porque requiere certificado.
 * El gestor verifica + edita siempre el nombre.
 */
export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const nifRaw = request.nextUrl.searchParams.get("nif") ?? "";
  const nif = nifRaw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!nif || nif.length < 8) return jsonError("NIF inválido");

  const validacion = validarNIF(nif);
  const tipo = detectarTipoNIF(nif);

  const admin = createSupabaseAdmin();

  // 1) Empresas previas
  const { data: empresas } = await admin
    .from("empresas")
    .select("id,nombre,nif,tipo,account_type,cnae,direccion,cp,ciudad,provincia,iban,email")
    .eq("nif", nif)
    .maybeSingle();

  if (empresas) {
    return NextResponse.json({
      ok: true,
      fuente: "empresas_previas",
      validacion,
      tipo,
      datos: {
        nombre: empresas.nombre,
        nif: empresas.nif,
        tipo_empresa: empresas.tipo ?? empresas.account_type,
        cnae: empresas.cnae,
        direccion: empresas.direccion,
        cp: empresas.cp,
        ciudad: empresas.ciudad,
        provincia: empresas.provincia,
        iban: empresas.iban,
        email: empresas.email,
      },
    });
  }

  // 2) Contactos previos
  const { data: contactos } = await admin
    .from("contactos")
    .select("nombre,nif,tipo,direccion,cp,ciudad,provincia,iban,email,telefono")
    .ilike("nif", nif)
    .limit(1);

  if (contactos && contactos.length > 0) {
    const c = contactos[0];
    return NextResponse.json({
      ok: true,
      fuente: "contactos",
      validacion,
      tipo,
      datos: {
        nombre: c.nombre,
        nif: c.nif,
        tipo_empresa: tipo === "cif" ? "empresa" : "autonomo",
        direccion: c.direccion,
        cp: c.cp,
        ciudad: c.ciudad,
        provincia: c.provincia,
        iban: c.iban,
        email: c.email,
        telefono: c.telefono,
      },
    });
  }

  // 3) No encontrado — devolvemos solo validación + tipo detectado
  return NextResponse.json({
    ok: true,
    fuente: "no_encontrado",
    validacion,
    tipo,
    datos: {
      tipo_empresa: tipo === "cif" ? "empresa" : "autonomo",
    },
    sugerencia: validacion.ok
      ? "NIF válido. Rellena la razón social manualmente o consulta el censo AEAT."
      : "NIF con formato inválido. Revisa antes de continuar.",
  });
}
