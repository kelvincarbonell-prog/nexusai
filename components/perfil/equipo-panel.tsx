"use client";

import { useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { UserPlus, Trash2, Check, ShieldCheck, Mail } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Asesor = { id: string; nombre: string | null; email: string; rol: string };

export function EquipoPanel() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const { confirm } = useConfirm();
  const [items, setItems] = useState<Asesor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [draft, setDraft] = useState({ email: "", nombre: "", rol: "asesor" as "gestor" | "asesor" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function load() {
    try {
      const tk = await token();
      const res = await fetch("/api/asesores", { headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (json.ok) setItems(json.asesores ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function invitar() {
    if (!draft.email.trim() || !draft.nombre.trim()) {
      setError("Email y nombre son obligatorios.");
      return;
    }
    setBusy("invite");
    setError(null);
    setSuccess(null);
    try {
      const tk = await token();
      const res = await fetch("/api/asesores", {
        method: "POST",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setSuccess(`Invitación enviada a ${draft.email}.`);
      setShowInvite(false);
      setDraft({ email: "", nombre: "", rol: "asesor" });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function cambiarRol(id: string, rol: "admin" | "gestor" | "asesor") {
    setBusy(id);
    try {
      const tk = await token();
      const res = await fetch("/api/asesores", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id, rol }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function quitar(id: string, email: string) {
    if (!(await confirm({ title: `¿Quitar a ${email} del equipo?`, message: "Mantendrá su cuenta pero ya no verá los clientes.", tone: "warn", confirmLabel: "Quitar" }))) return;
    setBusy(id);
    try {
      const tk = await token();
      const res = await fetch(`/api/asesores?id=${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${tk}` } });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="grid">
      <article className="card span-12" style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <span className="card-eyebrow">Equipo de la gestoría</span>
            <h2 style={{ fontSize: 18, margin: "4px 0 0" }}>
              {items.length} miembro{items.length !== 1 ? "s" : ""}
            </h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Invita a otros asesores para que puedan acceder a los clientes asignados a tu gestoría.
            </p>
          </div>
          <button className="button" onClick={() => setShowInvite((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <UserPlus size={15} strokeWidth={1.8} /> {showInvite ? "Cancelar" : "Invitar asesor"}
          </button>
        </div>

        {showInvite ? (
          <div className="form three-cols" style={{ padding: 14, borderRadius: 10, background: "color-mix(in srgb, var(--accent) 6%, transparent)" }}>
            <label className="label">
              Nombre <span style={{ color: "var(--bad)" }}>*</span>
              <input className="input" value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} placeholder="Laura Sánchez" />
            </label>
            <label className="label">
              Email <span style={{ color: "var(--bad)" }}>*</span>
              <input type="email" className="input" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="laura@gestoria.com" />
            </label>
            <label className="label">
              Rol
              <select className="input" value={draft.rol} onChange={(e) => setDraft({ ...draft, rol: e.target.value as "gestor" | "asesor" })}>
                <option value="asesor">Asesor</option>
                <option value="gestor">Gestor (puede invitar a otros)</option>
              </select>
            </label>
            <div className="span-form" style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="button" onClick={invitar} disabled={busy === "invite"} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {busy === "invite" ? (
                  <>Enviando…</>
                ) : (
                  <><Mail size={14} /> Enviar invitación por email</>
                )}
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
        {success ? (
          <p role="status" style={{ color: "var(--good)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Check size={14} /> {success}
          </p>
        ) : null}

        {loading ? <p className="muted">Cargando equipo…</p> : null}

        {!loading && items.length > 0 ? (
          <table className="table">
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th></th></tr></thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 30, height: 30, borderRadius: "50%",
                          background: "linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 50%, var(--good)) 100%)",
                          color: "white", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 12,
                        }}
                      >
                        {(a.nombre ?? a.email).slice(0, 1).toUpperCase()}
                      </span>
                      <strong>{a.nombre ?? "—"}</strong>
                    </div>
                  </td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{a.email}</td>
                  <td>
                    <select
                      className="input compact"
                      value={a.rol}
                      onChange={(e) => cambiarRol(a.id, e.target.value as "admin" | "gestor" | "asesor")}
                      disabled={busy === a.id}
                      style={{ fontSize: 12, padding: "4px 8px" }}
                    >
                      <option value="asesor">Asesor</option>
                      <option value="gestor">Gestor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td>
                    {a.rol === "admin" ? (
                      <span className="pill plain" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <ShieldCheck size={12} /> protegido
                      </span>
                    ) : (
                      <button
                        className="button ghost compact"
                        onClick={() => quitar(a.id, a.email)}
                        disabled={busy === a.id}
                        title="Quitar del equipo"
                        style={{ color: "var(--bad)", padding: "4px 8px" }}
                      >
                        <Trash2 size={13} strokeWidth={1.8} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </article>
    </section>
  );
}
