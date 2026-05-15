import { SetupRequired } from "@/components/setup-required";

export const metadata = {
  title: "Configuración pendiente · Modelo 26",
};

export default function SetupRequiredPage() {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  return <SetupRequired missing={missing.length > 0 ? missing : ["(comprueba en Vercel Settings → Environment Variables)"]} />;
}
