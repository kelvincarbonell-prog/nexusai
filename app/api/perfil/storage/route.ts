import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { getUserFromRequest } from "@/lib/supabase/auth";
import { getQuotaForUser } from "@/lib/storage/quota";

export async function GET(request: NextRequest) {
  const { user } = await getUserFromRequest(request);
  if (!user) return jsonError("No autorizado", 401);
  const quota = await getQuotaForUser(user.id);
  return NextResponse.json({ ok: true, ...quota });
}
