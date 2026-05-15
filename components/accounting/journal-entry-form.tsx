"use client";

import { useState } from "react";
import { Plus, Save } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Account = {
  id: string;
  code: string;
  name: string;
};

type Line = {
  account_id: string;
  description: string;
  debit: string;
  credit: string;
};

export function JournalEntryForm({ empresaId, accounts }: { empresaId: string; accounts: Account[] }) {
  const [description, setDescription] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>([
    { account_id: accounts[0]?.id ?? "", description: "", debit: "", credit: "" },
    { account_id: accounts[1]?.id ?? accounts[0]?.id ?? "", description: "", debit: "", credit: "" },
  ]);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  const balanced = debit > 0 && debit.toFixed(2) === credit.toFixed(2);

  function patchLine(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function authHeaders() {
    const supabase = createBrowserSupabase();
    const { data } = await supabase.auth.getSession();
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session?.access_token ?? ""}`,
    };
  }

  async function submit() {
    setMessage("");
    setIsSaving(true);
    try {
      const res = await fetch("/api/accounting/journal", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          empresa_id: empresaId,
          entry_date: entryDate,
          description,
          status: "posted",
          lines: lines.map((line) => ({
            ...line,
            debit: Number(line.debit || 0),
            credit: Number(line.credit || 0),
          })),
        }),
      });
      const payload = await res.json().catch(() => null);
      setMessage(res.ok ? "Asiento guardado." : payload?.error ?? "No se pudo guardar. Revisa que cuadre debe y haber.");
    } catch {
      setMessage("No se pudo conectar con el servidor.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="card span-12">
      <div className="topbar">
        <div>
          <div className="eyebrow">Diario</div>
          <h2>Nuevo asiento contable</h2>
        </div>
        <span className={balanced ? "status" : "status warning"}>Debe {debit.toFixed(2)} / Haber {credit.toFixed(2)}</span>
      </div>
      <div className="form two-cols">
        <label>
          Fecha
          <input className="input" type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
        </label>
        <label>
          Concepto
          <input className="input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ej. Factura emitida" />
        </label>
      </div>
      <div className="journal-lines">
        {lines.map((line, index) => (
          <div className="journal-line" key={index}>
            <select className="input" value={line.account_id} onChange={(event) => patchLine(index, { account_id: event.target.value })}>
              {accounts.map((account) => (
                <option value={account.id} key={account.id}>{account.code} - {account.name}</option>
              ))}
            </select>
            <input className="input" placeholder="Detalle" value={line.description} onChange={(event) => patchLine(index, { description: event.target.value })} />
            <input className="input" placeholder="Debe" type="number" step="0.01" value={line.debit} onChange={(event) => patchLine(index, { debit: event.target.value, credit: event.target.value ? "" : line.credit })} />
            <input className="input" placeholder="Haber" type="number" step="0.01" value={line.credit} onChange={(event) => patchLine(index, { credit: event.target.value, debit: event.target.value ? "" : line.debit })} />
          </div>
        ))}
      </div>
      <div className="button-row">
        <button className="button secondary" type="button" onClick={() => setLines((current) => [...current, { account_id: accounts[0]?.id ?? "", description: "", debit: "", credit: "" }])}>
          <Plus size={16} />
          Línea
        </button>
        <button className="button" type="button" disabled={!balanced || isSaving} onClick={submit}>
          <Save size={16} />
          Guardar asiento
        </button>
      </div>
      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
