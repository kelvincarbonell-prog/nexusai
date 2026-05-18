"use client";

import { useMemo, useState } from "react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Empresa = {
  id: string;
  nombre: string;
  metadata: Record<string, unknown>;
};

type Cuenta = {
  alias: string;
  banco: string;
  iban: string;
  divisa?: string;
};

export function ClienteBancos({ empresa }: { empresa: Empresa }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const { confirm } = useConfirm();
  const initialCuentas = ((empresa.metadata?.cuentas_bancarias as Cuenta[] | undefined) ?? []);
  const initialIban = (empresa.metadata?.iban as string | undefined) ?? "";

  const [cuentas, setCuentas] = useState<Cuenta[]>(
    initialCuentas.length > 0
      ? initialCuentas
      : initialIban
      ? [{ alias: "Principal", banco: "", iban: initialIban, divisa: "EUR" }]
      : [],
  );
  const [draft, setDraft] = useState<Cuenta>({ alias: "", banco: "", iban: "", divisa: "EUR" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function persistir(nuevas: Cuenta[]) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch(`/api/empresas/${empresa.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
        body: JSON.stringify({ metadata_patch: { cuentas_bancarias: nuevas } }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Error");
      setCuentas(nuevas);
      setSuccess("Cuentas actualizadas.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  function añadir() {
    if (!draft.iban.trim() || !draft.alias.trim()) {
      setError("Alias e IBAN obligatorios.");
      return;
    }
    persistir([...cuentas, { ...draft, iban: draft.iban.toUpperCase().replace(/\s/g, "") }]);
    setDraft({ alias: "", banco: "", iban: "", divisa: "EUR" });
  }

  async function borrar(idx: number) {
    if (!(await confirm({ title: "¿Eliminar esta cuenta?", tone: "danger", confirmLabel: "Eliminar" }))) return;
    persistir(cuentas.filter((_, i) => i !== idx));
  }

  return (
    <section className="grid">
      <article className="card span-12">
        <span className="card-eyebrow">Cuentas bancarias</span>
        <h2 style={{ fontSize: 18, margin: "4px 0 0" }}>{cuentas.length} cuenta{cuentas.length !== 1 ? "s" : ""}</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          IBANs usados para emisión de facturas, recibos SEPA y conciliación bancaria.
        </p>

        {error ? <p role="alert" style={{ color: "var(--bad)" }}>{error}</p> : null}
        {success ? <p role="status" style={{ color: "var(--good)" }}>{success}</p> : null}

        {cuentas.length === 0 ? (
          <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>Aún no has añadido cuentas.</p>
        ) : (
          <table className="table" style={{ marginTop: 12 }}>
            <thead><tr><th>Alias</th><th>Banco</th><th>IBAN</th><th>Divisa</th><th></th></tr></thead>
            <tbody>
              {cuentas.map((c, i) => (
                <tr key={i}>
                  <td><strong>{c.alias}</strong></td>
                  <td>{c.banco || "—"}</td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                    {c.iban.match(/.{1,4}/g)?.join(" ") ?? c.iban}
                  </td>
                  <td><span className="pill plain">{c.divisa ?? "EUR"}</span></td>
                  <td>
                    <button className="button danger compact" onClick={() => borrar(i)} disabled={busy}>Borrar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>

      <article className="card span-12">
        <span className="card-eyebrow">Añadir cuenta</span>
        <div className="form two-cols" style={{ marginTop: 12 }}>
          <label className="label">
            Alias
            <input className="input" value={draft.alias} onChange={(e) => setDraft({ ...draft, alias: e.target.value })} placeholder="Principal" />
          </label>
          <label className="label">
            Banco
            <input className="input" value={draft.banco} onChange={(e) => setDraft({ ...draft, banco: e.target.value })} placeholder="Santander" />
          </label>
          <label className="label">
            IBAN
            <input
              className="input"
              value={draft.iban}
              onChange={(e) => setDraft({ ...draft, iban: e.target.value.toUpperCase() })}
              placeholder="ES00 0000 0000 0000 0000 0000"
              style={{ fontFamily: "var(--mono)" }}
            />
          </label>
          <label className="label">
            Divisa
            <select className="input" value={draft.divisa ?? "EUR"} onChange={(e) => setDraft({ ...draft, divisa: e.target.value })}>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
            </select>
          </label>
        </div>
        <div className="button-row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
          <button className="button" onClick={añadir} disabled={busy}>
            {busy ? "Guardando…" : "+ Añadir cuenta"}
          </button>
        </div>
      </article>
    </section>
  );
}
