"use client";

import { useState } from "react";
import { ClientesList } from "@/components/clientes/clientes-list";
import { NuevoClienteForm } from "@/components/clientes/nuevo-cliente-form";

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
  const [showNew, setShowNew] = useState(false);

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
