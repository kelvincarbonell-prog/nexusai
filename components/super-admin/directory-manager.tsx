"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type ProfileRow = {
  id: string;
  email: string;
  nombre: string | null;
  apellidos: string | null;
  rol: string;
  nombre_gestoria: string | null;
  gestoria_slug: string | null;
};

type CompanyRow = {
  id: string;
  razon_social: string;
  nif: string | null;
  estado: string;
  account_type: string | null;
  onboarding_source: string | null;
  plan: string | null;
  cliente_slug: string | null;
};

async function headers() {
  const supabase = createBrowserSupabase();
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.session?.access_token ?? ""}`,
  };
}

export function DirectoryManager({
  profiles,
  companies,
}: {
  profiles: ProfileRow[];
  companies: CompanyRow[];
}) {
  const [profileRows, setProfileRows] = useState(profiles);
  const [companyRows, setCompanyRows] = useState(companies);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function save(payload: Record<string, unknown>) {
    setMessage("");
    setIsSaving(true);
    try {
      const res = await fetch("/api/super-admin/directory", {
        method: "PATCH",
        headers: await headers(),
        body: JSON.stringify(payload),
      });
      setMessage(res.ok ? "Cambios guardados." : "No se pudieron guardar los cambios.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <article className="card span-6">
        <div className="topbar">
          <div>
            <div className="eyebrow">Usuarios</div>
            <h2>Gestores y perfiles</h2>
          </div>
        </div>
        <table className="table">
          <caption className="sr-only">Gestores y perfiles de la plataforma</caption>
          <thead>
            <tr>
              <th>Código</th>
              <th>Rol</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {profileRows.length === 0 ? (
              <tr>
                <td colSpan={3}>No hay perfiles para mostrar.</td>
              </tr>
            ) : profileRows.map((profile) => (
              <tr key={profile.id}>
                <td>
                  <strong>{profile.gestoria_slug || profile.id.slice(0, 8)}</strong>
                  <div className="muted">Código gestoría</div>
                </td>
                <td>
                  <select
                    className="input compact"
                    value={profile.rol}
                    onChange={(event) =>
                      setProfileRows((rows) => rows.map((row) => (row.id === profile.id ? { ...row, rol: event.target.value } : row)))
                    }
                  >
                    <option value="admin">Admin</option>
                    <option value="gestor">Gestor</option>
                    <option value="asesor">Asesor</option>
                    <option value="portal_cliente">Cliente</option>
                  </select>
                </td>
                <td>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={isSaving}
                    aria-label={`Guardar cambios del perfil ${profile.gestoria_slug || profile.id.slice(0, 8)}`}
                    onClick={() => save({ type: "profile", id: profile.id, rol: profile.rol, nombre_gestoria: profile.nombre_gestoria })}
                  >
                    <Save size={14} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="card span-6">
        <div className="topbar">
          <div>
            <div className="eyebrow">Clientes</div>
            <h2>Autónomos y empresas</h2>
          </div>
        </div>
        <table className="table">
          <caption className="sr-only">Autónomos y empresas de la plataforma</caption>
          <thead>
            <tr>
              <th>Código</th>
              <th>Tipo</th>
              <th>Origen</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {companyRows.length === 0 ? (
              <tr>
                <td colSpan={4}>No hay clientes para mostrar.</td>
              </tr>
            ) : companyRows.map((company) => (
              <tr key={company.id}>
                <td>
                  <strong>{company.cliente_slug || company.id.slice(0, 8)}</strong>
                  <div className="muted">Código cliente</div>
                </td>
                <td>
                  <select
                    className="input compact"
                    value={company.account_type ?? "empresa"}
                    onChange={(event) =>
                      setCompanyRows((rows) => rows.map((row) => (row.id === company.id ? { ...row, account_type: event.target.value } : row)))
                    }
                  >
                    <option value="autonomo">Autónomo</option>
                    <option value="empresa">Empresa</option>
                  </select>
                </td>
                <td>
                  <select
                    className="input compact"
                    value={company.onboarding_source ?? "gestoria"}
                    onChange={(event) =>
                      setCompanyRows((rows) => rows.map((row) => (row.id === company.id ? { ...row, onboarding_source: event.target.value } : row)))
                    }
                  >
                    <option value="gestoria">Gestoría</option>
                    <option value="self_serve">Independiente</option>
                  </select>
                </td>
                <td>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={isSaving}
                    aria-label={`Guardar cambios del cliente ${company.cliente_slug || company.id.slice(0, 8)}`}
                    onClick={() =>
                      save({
                        type: "company",
                        id: company.id,
                        estado: company.estado || "activo",
                        account_type: company.account_type || "empresa",
                        onboarding_source: company.onboarding_source || "gestoria",
                        plan: company.plan || "starter",
                      })
                    }
                  >
                    <Save size={14} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {message ? <p className="muted" role="status">{message}</p> : null}
      </article>
    </>
  );
}
