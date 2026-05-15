import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PWARegister } from "@/components/mobile/pwa-register";

const themeScript = `(() => {
  try {
    const stored = window.localStorage.getItem('nexus-theme');
    const theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (_) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();`;

export const metadata: Metadata = {
  title: "Nexus · El copiloto fiscal y laboral en directo",
  description:
    "Sistema operativo fiscal, contable y laboral para autónomos, pymes y gestorías. Agentes IA que cierran IVA, nóminas y bancos en minutos. AEAT directa, VeriFactu opcional, firma integrada.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Nexus",
  },
  icons: {
    icon: "/icons/nexusai-192.svg",
    apple: "/icons/nexusai-192.svg",
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
