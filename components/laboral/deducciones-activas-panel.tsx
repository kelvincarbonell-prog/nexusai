"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Gavel, Wallet, Trash2 } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Trabajador = { id: string; nombre: string };

type Embargo = {
  id: string;
  trabajador_id: string;
  juzgado: string;
  deuda_total: number;
  saldo_pendiente: number;
  pension_alimentos: boolean;
  porcentaje_pension: number | null;
  estado: string;
  fecha_inicio: string;
};

type Anticipo = {
  id: string;
  trabajador_id: string;
  importe: number;
  saldo_pendiente: number;
  cuotas: number;
  cuota_importe: number;
  fecha: string;
  motivo: string | null;
  estado: string;
};

const EUR = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function DeduccionesActivasPanel({
  empresaId,
  trabajadores,
}: {
  empresaId: string;
  trabajadores: Trabajador[];
}) {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [embargos, setEmbargos] = useState<Embargo[]>([]);
  const [anticipos, setAnticipos] = useState<Anticipo[]>([]);
  const [loading, setLoading] = useState(true);
  const trabajadorMap = useMemo(() => new Map(trabajadores.map((t) => [t.id, t.nombre])), [trabajadores]);

  async function load() {
    setLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const tk = sess.session?.access_token ?? "";
      const [eRes, aRes] = await Promise.all([
        fetch(`/api/laboral/embargos?empresa_id=${empresaId}`, { headers: { Authorization: `Bearer ${tk}` } }),
        fetch(`/api/laboral/anticipos?empresa_id=${empresaId}`, { headers: { Authorization: `Bearer ${tk}` } }),
      ]);
      const eJ = await eRes.json();
      const aJ = await aRes.json();
      setEmbargos(((eJ.items ?? []) as Embargo[]).filter((x) => x.estado === "activo"));
      setAnticipos(((aJ.items ?? []) as Anticipo[]).filter((x) => x.estado === "activo" && x.saldo_pendiente > 0));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (empresaId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  if (loading) {
    return (
      <section style={{ display: "grid", gap: 6 }}>
        <span style={{ fontSize: 13, opacity: 0.7, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={14} className="animate-spin" /> Cargando deducciones activas…
        </span>
      </section>
    );
  }

  const totalEmbargos = embargos.reduce((s, e) => s + Number(e.saldo_pendiente ?? 0), 0);
  const totalAnticipos = anticipos.reduce((s, a) => s + Number(a.saldo_pendiente ?? 0), 0);

  if (embargos.length === 0 && anticipos.length === 0) {
    return (
      <section
        style={{
          padding: 12, borderRadius: 10,
          background: "color-mix(in srgb, currentColor 4%, transparent)",
          border: "1px solid color-mix(in srgb, currentColor 12%, transparent)",
          fontSize: 12, opacity: 0.8,
        }}
      >
        Sin embargos ni anticipos activos. Las próximas nóminas no tendrán deducciones extra.
      </section>
    );
  }

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Embargos */}
        <Card title="Embargos activos" icon={<Gavel size={14} />} total={totalEmbargos} count={embargos.length}>
          {embargos.length === 0 ? (
            <small style={{ opacity: 0.6 }}>Ninguno activo.</small>
          ) : (
            <ul style={list}>
              {embargos.map((e) => (
                <li key={e.id} style={item}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 13 }}>{trabajadorMap.get(e.trabajador_id) ?? "—"}</strong>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>
                      {e.juzgado}
                      {e.pension_alimentos ? ` · pensión ${e.porcentaje_pension ?? 0}%` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ fontSize: 13 }}>{EUR(e.saldo_pendiente)}</strong>
                    <div style={{ fontSize: 10, opacity: 0.6 }}>de {EUR(e.deuda_total)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Anticipos */}
        <Card title="Anticipos activos" icon={<Wallet size={14} />} total={totalAnticipos} count={anticipos.length}>
          {anticipos.length === 0 ? (
            <small style={{ opacity: 0.6 }}>Ninguno activo.</small>
          ) : (
            <ul style={list}>
              {anticipos.map((a) => (
                <li key={a.id} style={item}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ fontSize: 13 }}>{trabajadorMap.get(a.trabajador_id) ?? "—"}</strong>
                    <div style={{ fontSize: 11, opacity: 0.7 }}>
                      {a.motivo ?? "Adelanto"} · {a.cuotas} cuota{a.cuotas === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ fontSize: 13 }}>{EUR(a.saldo_pendiente)}</strong>
                    <div style={{ fontSize: 10, opacity: 0.6 }}>cuota {EUR(a.cuota_importe)}/mes</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <small style={{ fontSize: 11, opacity: 0.7 }}>
        Al generar las nóminas del mes se descontarán automáticamente. El saldo se actualiza solo.
      </small>
    </section>
  );
}

function Card({
  title, icon, total, count, children,
}: { title: string; icon: React.ReactNode; total: number; count: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 12, borderRadius: 10,
        border: "1px solid color-mix(in srgb, currentColor 14%, transparent)",
        background: "color-mix(in srgb, currentColor 4%, transparent)",
        display: "grid", gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <strong style={{ fontSize: 13 }}>{title}</strong>
        <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.6 }}>
          {count > 0 ? `${count} · ${EUR(total)} pendiente` : "—"}
        </span>
      </div>
      {children}
    </div>
  );
}

const list: React.CSSProperties = { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 };
const item: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "8px 10px", borderRadius: 8,
  background: "color-mix(in srgb, currentColor 5%, transparent)",
};
