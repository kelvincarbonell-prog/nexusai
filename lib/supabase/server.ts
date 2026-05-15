import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicSupabaseConfig } from "@/lib/env";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  const { url, anonKey } = publicSupabaseConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot always set cookies; middleware handles refreshes.
        }
      },
    },
  });
}
