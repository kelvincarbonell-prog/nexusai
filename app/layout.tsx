import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PWARegister } from "@/components/mobile/pwa-register";

const themeScript = `(() => {
  try {
    var key = 'm26-theme';
    var legacy = 'nexus-theme';
    var stored = window.localStorage.getItem(key) || window.localStorage.getItem(legacy);
    var theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    if (stored && !window.localStorage.getItem(key)) window.localStorage.setItem(key, theme);
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();`;

export const metadata: Metadata = {
  title: "Modelo 26 · Tecnología fiscal y laboral del futuro",
  description:
    "M26 es la plataforma con IA real para autónomos, pymes y gestorías. Cierra IVA, nóminas y bancos en minutos. AEAT directa, VeriFactu opcional, firma integrada.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "M26",
  },
  icons: {
    icon: "/icons/m26-192.svg",
    apple: "/icons/m26-192.svg",
  },
  openGraph: {
    title: "Modelo 26 · Tecnología fiscal y laboral del futuro",
    description:
      "Plataforma con IA real para autónomos, pymes y gestorías. Cierra el trimestre en 12 segundos con auditoría AEAT nativa.",
    type: "website",
    locale: "es_ES",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#06040d" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
