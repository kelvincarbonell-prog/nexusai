"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

type Asesor = { id: string; nombre: string | null; email: string; rol: string };

type Filter = "todos" | "autonomos" | "empresas" | "sin_asesor";

export function ClientesList({ initialEmpresas, isAdmin, userId }: { initialEmpresas: Empresa[]; isAdmin: boolean; userId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [empresas, setEmpresas] = useState<Empresa[]>(initialEmpresas);
  const [asesores, setAsesores] = useState<Asesor[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Empresa>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  useEffect(() => {
    (async () => {
      try {
        const tk = await token();
        const res = await fetch("/api/asesores", { headers: { Authorization: `Bearer ${tk}` } });
        const json = await res.json();
        if (json.ok) setAsesores(json.asesores ?? []);
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return empresas.filter((e) => {
      if (q && !(e.nombre?.toLowerCase().includes(q) || e.nif?.toLowerCase().includes(q))) return false;
      if (filter === "autonomos" && e.account_type !== "autonomo") return false;
      if (filter === "empresas" && e.account_type !== "empresa") return false;
      if (filter === "sin_asesor" && e.gestor_id) return false;
      return true;
    });
  }, [empresas, search, filter]);

  function startEdit(e: Empresa) {
    setEditing(e.id);
    setDraft({
      nombre: e.nombre,
      nif: e.nif ?? "",
      account_type: e.account_type ?? "empresa",
      plan: e.plan ?? "negocio",
      gestor_id: e.gestor_id ?? null,
    });
    setError(null);
    setSuccess(null);
  }

  function cancelEdit() {
    setEditing(null);
    setDraft({});
  }

  async function saveEdit(id: string) {
    setBusy(id);
    setError(null);
    try {
      const tk = await token();
      const res = await fetch(`/api/empresas/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setEmpresas((prev) => prev.map((e) => (e.id === id ? { ...e, ...json.empresa } : e)));
      setSuccess("Cliente actualizado.");
      setEditing(null);
      setDraft({});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function asignarAsesor(id: string, gestor_id: string | null) {
    setBusy(id);
    try {
      const tk = await token();
      const res = await fetch(`/api/empresas/${id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ gestor_id }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setEmpresas((prev) => prev.map((e) => (e.id === id ? { ...e, gestor_id } : e)));
      setSuccess(gestor_id ? "Asesor asignado." : "Asesor desasignado.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  const stats = {
    total: empresas.length,
    autonomos: empresas.filter((e) => e.account_type === "autonomo").length,
    empresas: empresas.filter((e) => e.account_type === "empresa").length,
    sin_asesor: empresas.filter((e) => !e.gestor_id).length,
  };

  const asesorNombre = (gestor_id: string | null) =>
    asesores.find((a) => a.id === gestor_id)?.nombre ?? asesores.find((a) => a.id === gestor_id)?.email ?? "Sin asignar";

  return (
    <section className="grid">
      <div className="card span-12" style={{ display: "grid", gap: 12 }}>
        <div className="topbar" style={{ border: 0, padding: 0, margin: 0, alignItems: "flex-end" }}>
          <div>
            <span className="card-eyebrow">Cartera de clientes</span>
            <h2 className="title" style={{ fontSize: 24, marginTop: 4 }}>
              {stats.total} cliente{stats.total !== 1 ? "s" : ""}
              <span className="muted" style={{ fontSize: 14, marginLeft: 8 }}>· {stats.autonomos} autónomos · {stats.empresas} empresas</span>
            </h2>
          </div>
        </div>

        <div className="form" style={{ gridTemplateColumns: "minmax(220px, 1fr) auto auto auto auto", gap: 8, alignItems: "center" }}>
          <input
            className="input"
            placeholder="🔍 Buscar por nombre o NIF…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className={`button compact ${filter === "todos" ? "" : "secondary"}`} onClick={() => setFilter("todos")}>Todos · {stats.total}</button>
          <button className={`button compact ${filter === "autonomos" ? "" : "secondary"}`} onClick={() => setFilter("autonomos")}>Autónomos · {stats.autonomos}</button>
          <button className={`button compact ${filter === "empresas" ? "" : "secondary"}`} onClick={() => setFilter("empresas")}>Empresas · {stats.empresas}</button>
          <button className={`button compact ${filter === "sin_asesor" ? "warn" : "secondary"}`} onClick={() => setFilter("sin_asesor")} style={filter === "sin_asesor" ? { background: "var(--warn)", borderColor: "var(--warn)", color: "white" } : undefined}>Sin asesor · {stats.sin_asesor}</button>
        </div>

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
        {success ? <p role="status" style={{ color: "var(--good)" }}>{success}</p> : null}

        <table className="table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>NIF</th>
              <th>Tipo</th>
              <th>Plan</th>
              <th>Asesor</th>
              <th>Buzón</th>
              <th style={{ width: 220 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 32 }}>
                {search || filter !== "todos" ? "Ningún cliente coincide con el filtro." : "Aún no tienes clientes. Crea el primero."}
              </td></tr>
            ) : filtered.map((e) => {
              const isEditing = editing === e.id;
              const isMine = e.gestor_id === userId;
              return (
                <tr key={e.id}>
                  <td>
                    {isEditing ? (
                      <input className="input" value={String(draft.nombre ?? "")} onChange={(ev) => setDraft({ ...draft, nombre: ev.target.value })} />
                    ) : (
                      <Link href={`/clientes/${e.id}`} style={{ fontWeight: 600, color: "var(--ink)" }}>{e.nombre}</Link>
                    )}
                  </td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                    {isEditing ? (
                      <input className="input" style={{ fontFamily: "var(--mono)" }} value={String(draft.nif ?? "")} onChange={(ev) => setDraft({ ...draft, nif: ev.target.value.toUpperCase() })} />
                    ) : (
                      e.nif ?? "—"
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <select className="input" value={String(draft.account_type ?? "empresa")} onChange={(ev) => setDraft({ ...draft, account_type: ev.target.value as "autonomo" | "empresa" })}>
                        <option value="autonomo">Autónomo</option>
                        <option value="empresa">Empresa</option>
                      </select>
                    ) : (
                      <span className="pill plain">{e.account_type === "autonomo" ? "Autónomo" : "Empresa"}</span>
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input className="input" value={String(draft.plan ?? "")} onChange={(ev) => setDraft({ ...draft, plan: ev.target.value })} />
                    ) : (
                      <span className="pill plain">{e.plan ?? "negocio"}</span>
                    )}
                  </td>
                  <td>
                    {isAdmin || isMine ? (
                      <select
                        className="input"
                        style={{ minWidth: 160, padding: "4px 8px", fontSize: 12 }}
                        value={e.gestor_id ?? ""}
                        onChange={(ev) => asignarAsesor(e.id, ev.target.value || null)}
                        disabled={busy === e.id}
                      >
                        <option value="">Sin asignar</option>
                        {asesores.map((a) => (
                          <option key={a.id} value={a.id}>{a.nombre ?? a.email}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{asesorNombre(e.gestor_id)}</span>
                    )}
                  </td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)" }}>
                    {e.inbox_alias ? `${e.inbox_alias.slice(0, 14)}…` : "—"}
                  </td>
                  <td>
                    {isEditing ? (
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        <button className="button compact" onClick={() => saveEdit(e.id)} disabled={busy === e.id}>
                          {busy === e.id ? "…" : "Guardar"}
                        </button>
                        <button className="button secondary compact" onClick={cancelEdit}>Cancelar</button>
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        <Link href={`/clientes/${e.id}`} className="button secondary compact">Abrir</Link>
                        <button className="button compact" onClick={() => startEdit(e)} title="Editar datos básicos">Editar</button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
