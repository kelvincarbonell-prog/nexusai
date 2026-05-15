import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PWARegister } from "@/components/mobile/pwa-register";

export const metadata: Metadata = {
  title: "NexusAI",
  description: "Sistema operativo 360 para gestorías, autónomos y empresas. Agentes IA, módulo laboral, contabilidad PGC y asistente de voz.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NexusAI",
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
  themeColor: "#145c4a",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
