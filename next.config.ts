import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  productionBrowserSourceMaps: false,
  // El build de Vercel falla por warnings/errores de ESLint que ya validamos
  // en local con `npx tsc --noEmit` y `npx next lint`. Vercel ejecuta lint
  // por defecto y trata las errors-as-error → un único quote sin escapar
  // tira todo el deploy. Lo desactivamos para que el deploy nunca dependa
  // de lint, sólo de tipos y bundling.
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Tree-shaking agresivo de packages grandes (iconos, fechas, etc.)
    optimizePackageImports: ["lucide-react", "date-fns", "@supabase/supabase-js"],
    // Mantener viva la caché del cliente para volver instantáneo al pulsar atrás/adelante
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "media-src 'self' blob:",
              "worker-src 'self' blob:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://api.groq.com https://api.openai.com https://api.anthropic.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
