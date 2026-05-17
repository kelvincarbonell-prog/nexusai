import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { publicSupabaseConfig } from "@/lib/env";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Devuelve el usuario autenticado, deduplicado por request (React cache()).
 * Si dos componentes lo piden en la misma petición → solo una llamada a Supabase.
 */
export const getServerUser = cache(async () => {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

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
