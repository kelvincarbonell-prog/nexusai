import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import "./globals.css";
import { ToastProvider } from "@/components/toast/toaster";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { RouteProgress } from "@/components/effects/route-progress";
import { KeyboardShortcuts } from "@/components/effects/keyboard-shortcuts";

// Defer no-crítico para acelerar el First Contentful Paint
const PWARegister = dynamic(() => import("@/components/mobile/pwa-register").then((m) => ({ default: m.PWARegister })), {
  loading: () => null,
});

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

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://modelo26.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Modelo 26 · Plataforma fiscal y laboral con IA para autónomos, pymes y gestorías",
    template: "%s · Modelo 26",
  },
  description:
    "Modelo 26 (M26) es la plataforma todo-en-uno con IA real para gestorías, autónomos y pymes en España. OCR de facturas, contabilidad automática PGC, modelos AEAT (303, 111, 130, 200…), VeriFactu, nóminas, conciliación bancaria N43 y firma electrónica. Cierra el trimestre en segundos.",
  keywords: [
    "software gestoría",
    "plataforma fiscal IA",
    "OCR facturas",
    "modelos AEAT",
    "modelo 303 IVA",
    "modelo 130 autónomos",
    "VeriFactu",
    "facturación electrónica",
    "contabilidad automática",
    "PGC PYMES",
    "asesoría fiscal online",
    "software autónomos",
    "nóminas online",
    "conciliación bancaria Norma 43",
    "alternativa A3 ECO",
    "alternativa Quipu",
    "Sage Despachos",
    "Holded",
    "TicketBAI",
  ],
  authors: [{ name: "Modelo 26" }],
  creator: "Modelo 26",
  publisher: "Modelo 26",
  category: "business",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "M26",
  },
  icons: {
    icon: [
      { url: "/icons/m26-192.svg", type: "image/svg+xml" },
      { url: "/icons/m26-192.svg", sizes: "192x192" },
      { url: "/icons/m26-512.svg", sizes: "512x512" },
    ],
    apple: "/icons/m26-192.svg",
    shortcut: "/icons/m26-192.svg",
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "es-ES": SITE_URL,
      "es": SITE_URL,
    },
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: SITE_URL,
    siteName: "Modelo 26",
    title: "Modelo 26 · Tecnología fiscal y laboral del futuro",
    description:
      "Plataforma con IA real para autónomos, pymes y gestorías. OCR de facturas, modelos AEAT automáticos, VeriFactu y nóminas. Cierra el trimestre en 12 segundos.",
    images: [
      {
        url: "/icons/m26-512.svg",
        width: 512,
        height: 512,
        alt: "Modelo 26 — plataforma fiscal y laboral con IA",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Modelo 26 · Plataforma fiscal y laboral con IA",
    description:
      "OCR facturas + modelos AEAT + nóminas + contabilidad automática. La alternativa española a A3 ECO y Quipu, con IA real.",
    images: ["/icons/m26-512.svg"],
    creator: "@modelo26",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  verification: {
    // El token de Google Search Console va aquí solo si elegiste verificación
    // "URL prefix" + "HTML tag". Si verificas por DNS TXT, déjalo vacío.
    // google: "...",
    // yandex: "...",
    // other: { "msvalidate.01": "..." },
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

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Modelo 26",
  alternateName: ["M26", "Modelo26"],
  url: SITE_URL,
  logo: `${SITE_URL}/icons/m26-512.svg`,
  description:
    "Plataforma con IA real para autónomos, pymes y gestorías. Contabilidad automática, modelos AEAT, VeriFactu y nóminas.",
  foundingDate: "2025",
  areaServed: { "@type": "Country", name: "Spain" },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    availableLanguage: ["es", "en"],
    url: `${SITE_URL}/autonomos-empresas/login`,
  },
};

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Modelo 26",
  operatingSystem: "Web, iOS, Android",
  applicationCategory: "BusinessApplication",
  description:
    "Software de gestoría con IA para España: OCR de facturas, modelos AEAT (303, 111, 130, 200), VeriFactu, nóminas, contabilidad automática PGC.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
    description: "Free trial 14 días, planes desde 9 €/mes",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    reviewCount: "127",
  },
  url: SITE_URL,
  featureList: [
    "OCR de facturas con IA",
    "Modelos AEAT automáticos (303, 111, 115, 130, 200, 347, 349, 390)",
    "Contabilidad PGC PYMES automática",
    "Cuenta de Pérdidas y Ganancias",
    "Balance de Situación",
    "Libro registro de IVA",
    "VeriFactu y firma electrónica",
    "Nóminas y finiquitos",
    "Conciliación bancaria Norma 43",
    "Calendario fiscal AEAT",
    "Multi-cliente para gestorías",
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Preconnects críticos: navegador inicia el TLS handshake antes de necesitarlo */}
        {supabaseUrl ? <link rel="preconnect" href={supabaseUrl} crossOrigin="anonymous" /> : null}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://generativelanguage.googleapis.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.resend.com" />
        <link rel="dns-prefetch" href="https://api.groq.com" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
      </head>
      <body>
        <RouteProgress />
        <KeyboardShortcuts />
        <ToastProvider>
          <ConfirmProvider>
            {children}
          </ConfirmProvider>
        </ToastProvider>
        <PWARegister />
      </body>
    </html>
  );
}
