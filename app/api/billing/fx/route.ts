import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { convert, fetchBceRates } from "@/lib/billing/fx";

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);

  const params = request.nextUrl.searchParams;
  const from = params.get("from")?.toUpperCase();
  const to = params.get("to")?.toUpperCase();
  const amount = Number(params.get("amount") ?? 1);

  try {
    if (from && to) {
      const result = await convert(amount, from, to);
      return NextResponse.json({ ok: true, ...result, from, to, source: "BCE" });
    }
    const all = await fetchBceRates();
    return NextResponse.json({ ok: true, ...all, source: "BCE" });
  } catch (e: unknown) {
    return jsonError(e instanceof Error ? e.message : "Error obteniendo tipos", 502);
  }
}
