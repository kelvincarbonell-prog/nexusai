import { AppShell } from "@/components/app-shell";
import { AgentPanel } from "@/components/agents/agent-panel";
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
          <span className="eyebrow">Agentes IA del asesor</span>
          <h1 className="title">Ejecuta acciones reales con un clic</h1>
          <p className="subtitle">
            Catálogo de agentes fiscales, laborales, de facturación y análisis. Cada uno ejecuta una acción
            concreta sobre la plataforma (calcular un modelo, alta de trabajador, calcular nómina o finiquito,
            emitir factura, cerrar ejercicio…) y queda registrado en el historial.
          </p>
        </div>
      </header>

      {empresas.length === 0 ? (
        <div className="card span-12"><p>No tienes empresas todavía. Crea la primera desde Clientes.</p></div>
      ) : (
        <div style={{ display: "grid", gap: 24 }}>
          <AgentPanel empresas={empresas} />

          <details>
            <summary className="card-eyebrow" style={{ cursor: "pointer" }}>Asistente de voz y consola libre</summary>
            <div className="grid" style={{ marginTop: 12 }}>
              <AgentConsole empresas={empresas} />
              <div className="span-12">
                <VoiceAssistant empresaId={empresas[0].id} />
              </div>
            </div>
          </details>
        </div>
      )}
    </AppShell>
  );
}
