import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://modelo26.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/autonomos-empresas/"],
        disallow: [
          "/api/",
          "/dashboard/",
          "/clientes/",
          "/aeat/",
          "/facturacion/",
          "/laboral/",
          "/contabilidad/",
          "/mensajes/",
          "/tareas/",
          "/crm/",
          "/inteligencia/",
          "/agentes/",
          "/perfil/",
          "/equipo/",
          "/portal/",
          "/super-admin/",
          "/bienvenida/",
          "/movil/",
          "/setup-required",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: ["/", "/login", "/autonomos-empresas/"],
        disallow: ["/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
