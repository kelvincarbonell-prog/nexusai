import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NexusAI",
  description: "Business OS para gestorías, clientes y operaciones fiscales.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
