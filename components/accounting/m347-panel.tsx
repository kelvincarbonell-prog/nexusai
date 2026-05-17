"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Download, AlertTriangle, Users, Building2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Operador = {
  contacto_nombre: string;
  contacto_nif?: string;
  tipo: "cliente" | "proveedor";
  importe_anual: number;
  t1: number;
  t2: number;
  t3: number;
  t4: number;
  num_operaciones: number;
};

type Casillas = { c01: number; c02: number; c03: number; c04: number; c05: number };

type Resp = {
  ok: boolean;
  ejercicio: number;
  empresa: { nombre: string | null; nif: string | null };
  casillas: Casillas;
  operadores: Operador[];
  warnings: string[];
};

const EUR = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const EUR2 = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);

export function M347Panel({ empresaId }: { empresaId: string }) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [ejercicio, setEjercicio] = useState<number>(new Date().getUTCFullYear() - 1);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "clientes" | "proveedores">("todos");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const url = `/api/aeat/m347?empresa_id=${empresaId}&ejercicio=${ejercicio}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error ?? "Error");
      setData(j as Resp);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId, ejercicio]);

  async function descargarTxt() {
    const { data: sess } = await supabase.auth.getSession();
    const tk = sess.session?.access_token ?? "";
    const url = `/api/aeat/m347?empresa_id=${empresaId}&ejercicio=${ejercicio}&formato=txt`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${tk}` } });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "No se pudo generar TXT");
      return;
    }
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = `m347-${ejercicio}.txt`;
    a.click();
    URL.revokeObjectURL(objUrl);
  }

  const operadoresFiltrados = (data?.operadores ?? []).filter((o) =>
    filtro === "todos" ? true : filtro === "clientes" ? o.tipo === "cliente" : o.tipo === "proveedor"
  );

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <FileSpreadsheet size={18} />
        <h3 style={{ margin: 0 }}>Modelo 347 · Operaciones con terceros</h3>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <select
            value={ejercicio}
            onChange={(e) => setEjercicio(Number(e.target.value))}
            style={selectStyle}
          >
            {Array.from({ length: 5 }).map((_, i) => {
              const y = new Date().getUTCFullYear() - i;
              return (
                <option key={y} value={y}>
                  Ejercicio {y}
                </option>
              );
            })}
          </select>
          <button
            type="button"
            onClick={descargarTxt}
            disabled={!data || data.operadores.length === 0}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid var(--border, #e5e7eb)",
              background: "transparent",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
            }}
          >
            <Download size={14} />
            Descargar TXT AEAT
          </button>
        </div>
      </header>

      <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>
        Solo se incluyen terceros que superan los 3.005,06 € en el año (IVA incluido). Las operaciones
        intracomunitarias se excluyen automáticamente (van al modelo 349).
      </p>

      {loading && <span style={{ fontSize: 13, opacity: 0.7 }}>Calculando…</span>}
      {error && (
        <div style={{ padding: 10, borderRadius: 8, background: "#ef444412", border: "1px solid #ef444455", color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          {data.warnings.length > 0 && (
            <div style={{ display: "grid", gap: 6 }}>
              {data.warnings.map((w, i) => (
                <div key={i} style={{ padding: 10, borderRadius: 8, background: "#f59e0b12", border: "1px solid #f59e0b55", display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                  <AlertTriangle size={14} color="#f59e0b" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            <Mini titulo="Total operadores" valor={String(data.casillas.c05)} />
            <Mini titulo="Clientes (B)" valor={String(data.casillas.c01)} sub={EUR(data.casillas.c03)} />
            <Mini titulo="Proveedores (A)" valor={String(data.casillas.c02)} sub={EUR(data.casillas.c04)} />
            <Mini titulo="Total declarado" valor={EUR(data.casillas.c03 + data.casillas.c04)} />
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button type="button" onClick={() => setFiltro("todos")} style={chip(filtro === "todos")}>
              Todos · {data.operadores.length}
            </button>
            <button type="button" onClick={() => setFiltro("clientes")} style={chip(filtro === "clientes")}>
              <Users size={12} style={{ marginRight: 4 }} />
              Clientes · {data.casillas.c01}
            </button>
            <button type="button" onClick={() => setFiltro("proveedores")} style={chip(filtro === "proveedores")}>
              <Building2 size={12} style={{ marginRight: 4 }} />
              Proveedores · {data.casillas.c02}
            </button>
          </div>

          <div style={{ overflow: "auto", border: "1px solid var(--border, #e5e7eb)", borderRadius: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--card-bg, #f9fafb)", textAlign: "left" }}>
                  <th style={th}>Tercero</th>
                  <th style={th}>NIF</th>
                  <th style={th}>Tipo</th>
                  <th style={thNum}>T1</th>
                  <th style={thNum}>T2</th>
                  <th style={thNum}>T3</th>
                  <th style={thNum}>T4</th>
                  <th style={thNum}>Total anual</th>
                </tr>
              </thead>
              <tbody>
                {operadoresFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 14, textAlign: "center", opacity: 0.6 }}>
                      Sin terceros declarables en este ejercicio.
                    </td>
                  </tr>
                ) : (
                  operadoresFiltrados.map((o, i) => (
                    <tr key={`${o.contacto_nif ?? o.contacto_nombre}-${i}`} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                      <td style={td}>{o.contacto_nombre}</td>
                      <td style={td}>{o.contacto_nif ?? <span style={{ color: "#ef4444" }}>—</span>}</td>
                      <td style={td}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: o.tipo === "cliente" ? "#3b82f612" : "#f59e0b12",
                            color: o.tipo === "cliente" ? "#3b82f6" : "#f59e0b",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {o.tipo === "cliente" ? "B · cliente" : "A · proveedor"}
                        </span>
                      </td>
                      <td style={tdNum}>{EUR2(o.t1)}</td>
                      <td style={tdNum}>{EUR2(o.t2)}</td>
                      <td style={tdNum}>{EUR2(o.t3)}</td>
                      <td style={tdNum}>{EUR2(o.t4)}</td>
                      <td style={{ ...tdNum, fontWeight: 600 }}>{EUR2(o.importe_anual)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Mini({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border, #e5e7eb)", background: "var(--card, #fff)", display: "grid", gap: 2 }}>
      <span style={{ fontSize: 11, opacity: 0.7, textTransform: "uppercase", letterSpacing: 0.4 }}>{titulo}</span>
      <strong style={{ fontSize: 18 }}>{valor}</strong>
      {sub && <span style={{ fontSize: 11, opacity: 0.7 }}>{sub}</span>}
    </div>
  );
}

const chip = (active: boolean): React.CSSProperties => ({
  padding: "4px 10px",
  borderRadius: 999,
  border: `1px solid ${active ? "var(--accent, #6366f1)" : "var(--border, #e5e7eb)"}`,
  background: active ? "color-mix(in srgb, var(--accent, #6366f1) 12%, transparent)" : "transparent",
  color: active ? "var(--accent, #6366f1)" : "inherit",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
});

const selectStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid var(--border, #e5e7eb)",
  background: "var(--card, #fff)",
  fontSize: 13,
};
const th: React.CSSProperties = { padding: "10px 12px", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4, opacity: 0.7 };
const thNum: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "10px 12px" };
const tdNum: React.CSSProperties = { ...td, textAlign: "right", fontFamily: "var(--mono, monospace)" };
