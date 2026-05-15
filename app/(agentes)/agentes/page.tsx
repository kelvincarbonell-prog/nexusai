import { AppShell } from "@/components/app-shell";
import { AgentConsole } from "@/components/agents/agent-console";
import { VoiceAssistant } from "@/components/voice/voice-assistant";
import { createServerSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AgentesPage() {
  const supabase = await createServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("perfiles").select("rol").eq("id", auth.user.id).maybeSingle();
  const isAdmin = profile?.rol === "admin";

  const empresasRes = isAdmin
    ? await supabase.from("empresas").select("id,nombre,inbox_alias").order("nombre").limit(200)
    : await supabase
        .from("empresas")
        .select("id,nombre,inbox_alias")
        .or(`gestor_id.eq.${auth.user.id},owner_user_id.eq.${auth.user.id}`)
        .order("nombre");
  const empresas = empresasRes.data ?? [];

  return (
    <AppShell active="/agentes" showSuperAdmin={isAdmin}>
      <header className="topbar">
        <div>
          <span className="eyebrow">Agentes IA</span>
          <h1 className="title">Operaciones autónomas y asistente de voz</h1>
          <p className="subtitle">Extrae facturas del correo, categoriza gastos con histórico y pregunta por voz indicadores clave en segundos.</p>
        </div>
      </header>

      {empresas.length === 0 ? (
        <div className="card span-12"><p>No tienes empresas todavía.</p></div>
      ) : (
        <div className="grid">
          <AgentConsole empresas={empresas} />
          <div className="span-12">
            <VoiceAssistant empresaId={empresas[0].id} />
          </div>
        </div>
      )}
    </AppShell>
  );
}
