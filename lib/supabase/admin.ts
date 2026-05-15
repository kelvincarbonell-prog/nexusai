import { createClient } from "@supabase/supabase-js";
import { publicSupabaseConfig, requireEnv } from "@/lib/env";

export function createSupabaseAdmin() {
  const { url } = publicSupabaseConfig();
  return createClient(url, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
