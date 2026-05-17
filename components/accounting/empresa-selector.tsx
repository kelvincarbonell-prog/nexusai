"use client";

import { useState } from "react";
import { Building2, ChevronDown } from "lucide-react";

type Empresa = { id: string; nombre: string | null; nif?: string | null };

export function EmpresaSelector({
  empresas,
  initialId,
  onChange,
}: {
  empresas: Empresa[];
  initialId: string;
  onChange: (id: string) => void;
}) {
  const [id, setId] = useState(initialId);
  const empresa = empresas.find((e) => e.id === id);

  if (empresas.length === 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px solid var(--line)", borderRadius: 10, background: "color-mix(in srgb, var(--accent) 6%, transparent)" }}>
      <Building2 size={18} strokeWidth={1.8} color="var(--accent)" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <small className="muted" style={{ fontSize: 11, display: "block", fontFamily: "var(--mono)" }}>Cliente activo</small>
        <strong style={{ fontSize: 14, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{empresa?.nombre ?? "—"}</strong>
      </div>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <select
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            onChange(e.target.value);
          }}
          style={{
            appearance: "none",
            background: "transparent",
            border: "1px solid var(--line)",
            borderRadius: 8,
            padding: "8px 30px 8px 12px",
            fontSize: 13,
            color: "var(--ink)",
            cursor: "pointer",
            minWidth: 160,
          }}
        >
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>{e.nombre ?? "Sin nombre"}{e.nif ? ` · ${e.nif}` : ""}</option>
          ))}
        </select>
        <ChevronDown size={14} strokeWidth={1.8} style={{ position: "absolute", right: 8, pointerEvents: "none", color: "var(--muted)" }} />
      </div>
    </div>
  );
}
