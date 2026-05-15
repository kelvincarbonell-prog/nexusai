import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: NextRequest, { params }: { params: Promise<{ ref: string }> }) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const { ref } = await params;
  const cleanRef = ref.toUpperCase().replace(/[^A-Z0-9-]/g, "");
  const admin = createSupabaseAdmin();

  const { data: doc, error } = await admin
    .from("firma_docs")
    .select("ref,gestor_id,filename,storage_path,formato")
    .eq("ref", cleanRef)
    .single();

  if (error || !doc) return jsonError("Documento no encontrado", 404);
  if (doc.gestor_id !== user.id) return jsonError("No autorizado", 403);

  const { data, error: downloadError } = await admin.storage.from("signed-documents").download(doc.storage_path);
  if (downloadError || !data) return jsonError("No se pudo descargar el documento", 500);

  return new NextResponse(data, {
    headers: {
      "Content-Type": doc.formato === "PDF" ? "application/pdf" : "application/pkcs7-signature",
      "Content-Disposition": `attachment; filename="${doc.filename}"`,
      "X-NX-Ref": cleanRef,
    },
  });
}
