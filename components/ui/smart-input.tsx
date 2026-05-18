"use client";

import { useMemo } from "react";
import { Check, AlertCircle } from "lucide-react";
import { validarNIF, validarIBAN, validarCCC, formatearIBAN, detectarTipoNIF } from "@/lib/validation/spanish";

type Kind = "nif" | "iban" | "ccc" | "email" | "telefono" | "cp" | "iaf";

/**
 * Input "inteligente":
 *  - Valida en tiempo real según `kind` (NIF/IBAN/CCC/email/teléfono/CP).
 *  - Muestra check verde o tip rojo discreto.
 *  - Auto-formatea IBAN con espacios al perder foco.
 *  - Detecta DNI vs NIE vs CIF y lo etiqueta.
 *
 * Drop-in: <SmartInput kind="nif" value={x} onChange={setX} label="DNI/NIE" />
 */
export function SmartInput({
  kind,
  value,
  onChange,
  onBlur,
  label,
  placeholder,
  required,
  disabled,
  hint,
}: {
  kind: Kind;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const validation = useMemo(() => validar(kind, value), [kind, value]);
  const subEtiqueta = kind === "nif" && value ? detectarTipoNIF(value).toUpperCase() : null;

  return (
    <label style={{ display: "grid", gap: 4, fontSize: 12, position: "relative" }}>
      {label && (
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
          {label}
          {required ? <span style={{ color: "var(--bad, #ef4444)" }}>*</span> : null}
          {subEtiqueta && subEtiqueta !== "UNKNOWN" && (
            <span style={{ fontSize: 9, opacity: 0.6, padding: "1px 6px", borderRadius: 4, border: "1px solid color-mix(in srgb, currentColor 18%, transparent)" }}>
              {subEtiqueta}
            </span>
          )}
        </span>
      )}
      <div style={{ position: "relative" }}>
        <input
          type={kind === "email" ? "email" : kind === "telefono" ? "tel" : "text"}
          inputMode={kind === "telefono" || kind === "cp" || kind === "ccc" ? "numeric" : undefined}
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(normalize(kind, e.target.value))}
          onBlur={() => {
            if (kind === "iban" && value) onChange(formatearIBAN(value));
            onBlur?.();
          }}
          style={{
            width: "100%",
            padding: "8px 32px 8px 10px",
            borderRadius: 8,
            border: `1px solid ${value && !validation.ok ? "#ef4444" : value && validation.ok ? "#10b981" : "color-mix(in srgb, currentColor 16%, transparent)"}`,
            background: "color-mix(in srgb, currentColor 4%, transparent)",
            color: "inherit",
            fontSize: 13,
            fontFamily: kind === "iban" || kind === "nif" || kind === "ccc" ? "var(--mono, monospace)" : "inherit",
            boxSizing: "border-box",
          }}
        />
        {value && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: validation.ok ? "#10b981" : "#ef4444",
            }}
          >
            {validation.ok ? <Check size={14} /> : <AlertCircle size={14} />}
          </span>
        )}
      </div>
      {hint && !value && <small style={{ fontSize: 10, opacity: 0.6 }}>{hint}</small>}
      {value && !validation.ok && validation.razon && (
        <small style={{ fontSize: 10, color: "#ef4444" }}>{validation.razon}</small>
      )}
    </label>
  );
}

function normalize(kind: Kind, v: string): string {
  if (kind === "nif" || kind === "ccc") return v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (kind === "iban") return v.toUpperCase().replace(/[^A-Z0-9 ]/g, "");
  if (kind === "telefono") return v.replace(/[^0-9+ ]/g, "").slice(0, 16);
  if (kind === "cp") return v.replace(/[^0-9]/g, "").slice(0, 5);
  return v;
}

function validar(kind: Kind, v: string): { ok: boolean; razon?: string } {
  if (!v) return { ok: false };
  switch (kind) {
    case "nif": return validarNIF(v);
    case "iban": return validarIBAN(v);
    case "ccc": return validarCCC(v);
    case "email": {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      return { ok, razon: ok ? undefined : "Email no válido" };
    }
    case "telefono": {
      const digits = v.replace(/[^0-9]/g, "");
      const ok = digits.length >= 9 && digits.length <= 15;
      return { ok, razon: ok ? undefined : "Teléfono inválido (mín 9 dígitos)" };
    }
    case "cp": {
      const ok = /^\d{5}$/.test(v) && Number(v.slice(0, 2)) <= 52;
      return { ok, razon: ok ? undefined : "CP español inválido (5 dígitos, provincia 01-52)" };
    }
    default:
      return { ok: true };
  }
}
