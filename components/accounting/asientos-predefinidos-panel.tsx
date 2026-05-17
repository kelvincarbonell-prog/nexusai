"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Calculator,
  Receipt,
  FileText,
  Percent,
  TrendingDown,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  X,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type PlantillaInput = {
  name: string;
  label: string;
  type: "currency" | "number" | "text" | "date" | "percent";
  required?: boolean;
  placeholder?: string;
  defaultValue?: number | string;
};

type Plantilla = {
  id: string;
  category: "nominas" | "iva_irpf" | "amortizaciones" | "prestamos" | "otros";
  icon: string;
  title: string;
  description: string;
  inputs: PlantillaInput[];
};

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  Banknote,
  Calculator,
  Receipt,
  FileText,
  Percent,
  TrendingDown,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
};

const CATEGORY_LABELS: Record<Plantilla["category"], string> = {
  nominas: "Nóminas",
  iva_irpf: "IVA · IRPF",
  amortizaciones: "Amortizaciones",
  prestamos: "Préstamos",
  otros: "Cobros y pagos",
};

export function AsientosPredefinidosPanel({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [seleccion, setSeleccion] = useState<Plantilla | null>(null);
  const [values, setValues] = useState<Record<string, string | number>>({});
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ entry_number: number; descripcion: string; total: number } | null>(null);

  useEffect(() => {
    fetch("/api/accounting/asientos-predefinidos")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setPlantillas(j.plantillas as Plantilla[]);
      })
      .catch(() => {});
  }, []);

  function abrir(p: Plantilla) {
    const defaults: Record<string, string | number> = {};
    for (const inp of p.inputs) {
      defaults[inp.name] = inp.defaultValue ?? (inp.type === "currency" || inp.type === "number" ? 0 : "");
    }
    setValues(defaults);
    setSeleccion(p);
    setDone(null);
    setError(null);
  }

  function cerrar() {
    setSeleccion(null);
    setValues({});
    setDone(null);
    setError(null);
  }

  async function aplicar() {
    if (!seleccion) return;
    setError(null);
    setSubmitting(true);
    try {
      // valida required
      for (const inp of seleccion.inputs) {
        if (inp.required) {
          const v = values[inp.name];
          if (v === undefined || v === null || v === "" || (typeof v === "number" && Number.isNaN(v))) {
            throw new Error(`Falta el campo: ${inp.label}`);
          }
        }
      }
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const res = await fetch("/api/accounting/asientos-predefinidos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        body: JSON.stringify({
          empresa_id: empresaId,
          plantilla_id: seleccion.id,
          fecha,
          inputs: values,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "No se pudo crear el asiento");
      setDone({ entry_number: j.entry_number, descripcion: j.descripcion, total: j.total });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  const grouped: Record<Plantilla["category"], Plantilla[]> = {
    nominas: [],
    iva_irpf: [],
    amortizaciones: [],
    prestamos: [],
    otros: [],
  };
  for (const p of plantillas) grouped[p.category].push(p);

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Sparkles size={18} />
        <h3 style={{ margin: 0 }}>Asientos predefinidos</h3>
        <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
          {plantillas.length} plantillas
        </span>
      </header>

      <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
        Selecciona una plantilla, rellena los importes y se genera el asiento contable en el diario con un clic.
      </p>

      {(Object.keys(grouped) as Plantilla["category"][]).map((cat) =>
        grouped[cat].length === 0 ? null : (
          <div key={cat} style={{ display: "grid", gap: 8 }}>
            <h4 style={{ margin: "8px 0 0", fontSize: 13, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {CATEGORY_LABELS[cat]}
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
              {grouped[cat].map((p) => {
                const Icon = ICONS[p.icon] ?? Sparkles;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => abrir(p)}
                    style={{
                      textAlign: "left",
                      padding: 12,
                      borderRadius: 10,
                      border: "1px solid color-mix(in srgb, var(--border, #e5e7eb) 100%, transparent)",
                      background: "color-mix(in srgb, var(--card, #fff) 100%, transparent)",
                      cursor: "pointer",
                      display: "grid",
                      gap: 6,
                      transition: "transform 0.12s ease, border-color 0.12s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent, #6366f1)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "";
                      e.currentTarget.style.transform = "";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon size={16} />
                      <strong style={{ fontSize: 14 }}>{p.title}</strong>
                    </div>
                    <span style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.4 }}>{p.description}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )
      )}

      {seleccion && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 1000,
          }}
          onClick={cerrar}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(560px, 100%)",
              maxHeight: "90vh",
              overflow: "auto",
              background: "var(--card, #fff)",
              borderRadius: 14,
              border: "1px solid var(--border, #e5e7eb)",
              padding: 18,
              display: "grid",
              gap: 12,
            }}
          >
            <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <strong style={{ fontSize: 15 }}>{seleccion.title}</strong>
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar"
                style={{
                  marginLeft: "auto",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  padding: 6,
                }}
              >
                <X size={16} />
              </button>
            </header>
            <p style={{ margin: 0, fontSize: 12, opacity: 0.7 }}>{seleccion.description}</p>

            {done ? (
              <div
                style={{
                  display: "grid",
                  gap: 6,
                  padding: 14,
                  borderRadius: 10,
                  border: "1px solid #10b98155",
                  background: "#10b98112",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={18} color="#10b981" />
                  <strong>Asiento creado correctamente</strong>
                </div>
                <span style={{ fontSize: 13 }}>
                  Nº asiento <strong>{done.entry_number}</strong> · {done.descripcion}
                </span>
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  Total cuadrado: {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(done.total)}
                </span>
                <button
                  type="button"
                  onClick={cerrar}
                  style={{ marginTop: 4, justifySelf: "end", padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border, #e5e7eb)", background: "transparent", cursor: "pointer" }}
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <>
                <label style={{ display: "grid", gap: 4, fontSize: 12 }}>
                  <span style={{ opacity: 0.8 }}>Fecha del asiento</span>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    style={inputStyle}
                  />
                </label>

                {seleccion.inputs.map((inp) => (
                  <label key={inp.name} style={{ display: "grid", gap: 4, fontSize: 12 }}>
                    <span style={{ opacity: 0.8 }}>
                      {inp.label}
                      {inp.required ? <span style={{ color: "#ef4444" }}> *</span> : null}
                    </span>
                    <input
                      type={inp.type === "currency" || inp.type === "number" || inp.type === "percent" ? "number" : inp.type === "date" ? "date" : "text"}
                      step={inp.type === "currency" ? "0.01" : inp.type === "percent" ? "0.1" : "any"}
                      placeholder={inp.placeholder}
                      value={(values[inp.name] as string | number) ?? ""}
                      onChange={(e) => {
                        const v = inp.type === "currency" || inp.type === "number" || inp.type === "percent"
                          ? (e.target.value === "" ? "" : Number(e.target.value))
                          : e.target.value;
                        setValues((prev) => ({ ...prev, [inp.name]: v }));
                      }}
                      style={inputStyle}
                    />
                  </label>
                ))}

                {error && (
                  <div style={{ padding: 10, borderRadius: 8, background: "#ef444412", border: "1px solid #ef444455", color: "#ef4444", fontSize: 13 }}>
                    {error}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
                  <button
                    type="button"
                    onClick={cerrar}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border, #e5e7eb)", background: "transparent", cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={aplicar}
                    disabled={submitting}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--accent, #6366f1)",
                      color: "#fff",
                      cursor: submitting ? "wait" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      opacity: submitting ? 0.8 : 1,
                    }}
                  >
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    {submitting ? "Generando…" : "Generar asiento"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--border, #e5e7eb)",
  background: "var(--card-bg, #fff)",
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
};
