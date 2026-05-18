"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";

/**
 * Celda con edición en línea.
 *
 *  - Click sobre el valor → se convierte en input.
 *  - Enter → guarda (llama a onSave).
 *  - Escape → cancela.
 *  - Pierde foco → guarda automáticamente.
 *
 * Soporta tipos: text, number, currency, date, select.
 * El indicador de estado (✓ / Loader / X) aparece a la derecha.
 *
 * Drop-in en tablas:
 *   <InlineEdit value={g.concepto} onSave={(v) => patch(g.id, { concepto: v })} />
 */

type Props = {
  value: string | number | null | undefined;
  onSave: (newValue: string) => Promise<unknown> | void;
  type?: "text" | "number" | "currency" | "date" | "select";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  format?: (v: string | number | null | undefined) => string;
  parse?: (raw: string) => string;
  disabled?: boolean;
  className?: string;
  /** Indica si el valor ha cambiado realmente para evitar saves vacíos. */
  validate?: (raw: string) => string | null;
};

export function InlineEdit({
  value,
  onSave,
  type = "text",
  options,
  placeholder,
  format,
  parse,
  disabled,
  className,
  validate,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value == null ? "" : String(value));
  const [status, setStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  useEffect(() => {
    setDraft(value == null ? "" : String(value));
  }, [value]);

  useEffect(() => {
    if (editing) {
      setTimeout(() => inputRef.current?.focus(), 10);
      if (inputRef.current && "select" in inputRef.current) {
        try { (inputRef.current as HTMLInputElement).select?.(); } catch { /* */ }
      }
    }
  }, [editing]);

  async function commit() {
    const raw = parse ? parse(draft) : draft;
    // Si no cambia, no guarda
    if (raw === (value == null ? "" : String(value))) {
      setEditing(false);
      return;
    }
    if (validate) {
      const err = validate(raw);
      if (err) {
        setStatus("error");
        setError(err);
        return;
      }
    }
    setStatus("saving");
    setError(null);
    try {
      await onSave(raw);
      setStatus("ok");
      setEditing(false);
      setTimeout(() => setStatus("idle"), 1200);
    } catch (e: unknown) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  function cancel() {
    setDraft(value == null ? "" : String(value));
    setStatus("idle");
    setEditing(false);
    setError(null);
  }

  if (disabled || !editing) {
    return (
      <span
        onClick={() => !disabled && setEditing(true)}
        className={className}
        style={{
          cursor: disabled ? "default" : "text",
          padding: "2px 6px",
          borderRadius: 4,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          minWidth: 60,
          background: status === "ok" ? "color-mix(in srgb, #10b981 12%, transparent)" : "transparent",
          transition: "background 0.25s",
        }}
        title={disabled ? "" : "Click para editar"}
      >
        {format ? format(value) : value == null || value === "" ? <em style={{ opacity: 0.4, fontStyle: "normal" }}>{placeholder ?? "—"}</em> : String(value)}
        {status === "ok" && <Check size={11} color="#10b981" />}
      </span>
    );
  }

  // Modo edición
  const stop = (e: React.MouseEvent | React.KeyboardEvent) => e.stopPropagation();

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, position: "relative" }} onClick={stop}>
      {type === "select" ? (
        <select
          ref={(el) => { inputRef.current = el; }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") cancel();
          }}
          onBlur={commit}
          style={inputStyle}
        >
          {(options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input
          ref={(el) => { inputRef.current = el; }}
          type={type === "currency" || type === "number" ? "number" : type === "date" ? "date" : "text"}
          step={type === "currency" ? "0.01" : type === "number" ? "any" : undefined}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") cancel();
          }}
          onBlur={commit}
          style={inputStyle}
        />
      )}
      {status === "saving" && <Loader2 size={12} className="animate-spin" color="var(--muted)" />}
      {status === "error" && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: "#ef4444", fontSize: 11 }} title={error ?? ""}>
          <X size={11} />
        </span>
      )}
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "2px 6px",
  borderRadius: 4,
  border: "1px solid var(--accent, #6366f1)",
  background: "color-mix(in srgb, var(--accent, #6366f1) 5%, transparent)",
  color: "inherit",
  fontSize: 13,
  width: "auto",
  minWidth: 80,
  fontFamily: "inherit",
};
