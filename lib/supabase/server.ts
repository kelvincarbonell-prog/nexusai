import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { publicSupabaseConfig } from "@/lib/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createServerSupabase() {
  const cookieStore = await cookies();
  const { url, anonKey } = publicSupabaseConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot always set cookies; middleware handles refreshes.
        }
      },
    },
  });
}
