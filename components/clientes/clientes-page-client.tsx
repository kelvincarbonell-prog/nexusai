"use client";

import { useMemo, useState } from "react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useRouter } from "next/navigation";
import { ClientesList } from "@/components/clientes/clientes-list";
import { NuevoClienteForm } from "@/components/clientes/nuevo-cliente-form";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Empresa = {
  id: string;
  nombre: string;
  nif: string | null;
  account_type: "autonomo" | "empresa" | null;
  plan: string | null;
  gestor_id: string | null;
  inbox_alias: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export function ClientesPageClient({ initialEmpresas, isAdmin, userId }: { initialEmpresas: Empresa[]; isAdmin: boolean; userId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const { confirm } = useConfirm();
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const hasDemo = initialEmpresas.some((e) => (e.metadata as Record<string, unknown> | null)?.demo === true);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function crearDemo() {
    setBusy("seed");
    try {
      const tk = await token();
      await fetch("/api/clientes/seed-demo", { method: "POST", headers: { Authorization: `Bearer ${tk}` } });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function borrarDemo() {
    if (!(await confirm({ title: "¿Borrar las 3 empresas de prueba? Esta acción es irreversible.", tone: "danger", confirmLabel: "Confirmar" }))) return;
    setBusy("seed");
    try {
      const tk = await token();
      await fetch("/api/clientes/seed-demo", { method: "DELETE", headers: { Authorization: `Bearer ${tk}` } });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="topbar" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <span className="eyebrow">Cartera</span>
          <h1 className="title">
            <span className="brand-text">Clientes</span> y empresas.
          </h1>
          <p className="subtitle">
            Listado completo, edición inline, asignación de asesor y acceso directo al panel de cada cliente con su contabilidad, modelos y nóminas.
          </p>
        </div>
        <div className="button-row" style={{ marginTop: 6 }}>
          {hasDemo ? (
            <button className="button ghost compact" onClick={borrarDemo} disabled={busy === "seed"} title="Eliminar empresas de prueba">
              🗑 Borrar demo
            </button>
          ) : initialEmpresas.length === 0 ? (
            <button className="button secondary" onClick={crearDemo} disabled={busy === "seed"} title="Crea 3 empresas ficticias para probar la plataforma">
              {busy === "seed" ? "Creando…" : "✨ Crear 3 empresas demo"}
            </button>
          ) : null}
          <button className="button" onClick={() => setShowNew((v) => !v)}>
            {showNew ? "Cancelar" : "+ Nuevo cliente"}
          </button>
        </div>
      </div>

      {showNew ? (
        <div className="grid">
          <NuevoClienteForm onClose={() => setShowNew(false)} onCreated={() => setShowNew(false)} />
        </div>
      ) : null}

      <ClientesList initialEmpresas={initialEmpresas} isAdmin={isAdmin} userId={userId} />
    </>
  );
}
