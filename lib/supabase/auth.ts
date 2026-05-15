import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { publicSupabaseConfig } from "@/lib/env";

export async function getUserFromRequest(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return { user: null, token: "" };

  const { url, anonKey } = publicSupabaseConfig();
  const supabase = createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { user: null, token: "" };

  return { user: data.user, token };
}
