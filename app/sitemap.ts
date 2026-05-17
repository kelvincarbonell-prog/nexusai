import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://modelo26.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages: { path: string; priority: number; changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never" }[] = [
    { path: "", priority: 1.0, changeFrequency: "weekly" },
    { path: "/login", priority: 0.6, changeFrequency: "monthly" },
    { path: "/autonomos-empresas/registro", priority: 0.9, changeFrequency: "weekly" },
    { path: "/autonomos-empresas/login", priority: 0.6, changeFrequency: "monthly" },
  ];
  return staticPages.map((p) => ({
    url: `${SITE_URL}${p.path}`,
    lastModified: now,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
