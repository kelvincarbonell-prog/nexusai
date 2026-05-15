import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Páginas que necesitan Supabase para funcionar (server-side).
// Si faltan env vars, redirige a /setup-required en lugar de crashear.
const PROTECTED_PATHS = ["/dashboard", "/portal", "/contabilidad", "/laboral", "/aeat", "/agentes", "/super-admin", "/clientes", "/movil"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    const pathname = request.nextUrl.pathname;
    const needsSupabase = PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (needsSupabase && pathname !== "/setup-required") {
      const redirectUrl = new URL("/setup-required", request.url);
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
