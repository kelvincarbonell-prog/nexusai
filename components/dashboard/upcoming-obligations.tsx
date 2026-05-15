import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { buildCalendar, urgencyClass, type Obligacion } from "@/lib/aeat/calendar";

type Empresa = { id: string; nombre: string; account_type?: string | null };

export async function UpcomingObligations({ empresas }: { empresas: Empresa[] }) {
  if (empresas.length === 0) return null;

  const admin = createSupabaseAdmin();
  const empresaIds = empresas.map((e) => e.id);
  const { data: declaraciones } = await admin
    .from("aeat_declaraciones")
    .select("empresa_id,modelo,ejercicio,periodo,status")
    .in("empresa_id", empresaIds)
    .in("status", ["presentado", "revisado"]);

  const presentadasByEmpresa = new Map<string, { modelo: string; ejercicio: number; periodo: string }[]>();
  for (const d of declaraciones ?? []) {
    const prev = presentadasByEmpresa.get(d.empresa_id) ?? [];
    prev.push({ modelo: d.modelo, ejercicio: d.ejercicio, periodo: d.periodo });
    presentadasByEmpresa.set(d.empresa_id, prev);
  }

  type Row = { empresa: Empresa; obligacion: Obligacion };
  const rows: Row[] = [];
  for (const e of empresas) {
    const presentadas = presentadasByEmpresa.get(e.id) ?? [];
    const obligaciones = buildCalendar({
      empresaTipo: (e.account_type === "autonomo" ? "autonomo" : "empresa"),
      presentadas,
      horizonteDias: 45,
    });
    for (const o of obligaciones) {
      if (o.esta_presentada) continue;
      rows.push({ empresa: e, obligacion: o });
    }
  }
  rows.sort((a, b) => a.obligacion.dias_restantes - b.obligacion.dias_restantes);
  const top = rows.slice(0, 8);

  const criticas = rows.filter((r) => r.obligacion.dias_restantes <= 7).length;
  const proximas = rows.filter((r) => r.obligacion.dias_restantes > 7 && r.obligacion.dias_restantes <= 21).length;

  return (
    <article className="card span-7">
      <div className="topbar" style={{ border: 0, padding: 0, margin: 0 }}>
        <div>
          <span className="card-eyebrow">Calendario fiscal</span>
          <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>Próximas obligaciones · 45 días</div>
        </div>
        <div className="button-row">
          <span className="pill bad">{criticas} críticas</span>
          <span className="pill warn">{proximas} próximas</span>
          <Link href="/aeat" className="button ghost compact">Ir a modelos →</Link>
        </div>
      </div>

      {top.length === 0 ? (
        <p className="muted" style={{ marginTop: 12, fontSize: 13 }}>
          Sin obligaciones pendientes en los próximos 45 días. Disfruta la calma.
        </p>
      ) : (
        <table className="table" style={{ marginTop: 6 }}>
          <thead>
            <tr><th>Empresa</th><th>Modelo</th><th>Vence</th><th>Estado</th></tr>
          </thead>
          <tbody>
            {top.map((r) => {
              const u = urgencyClass(r.obligacion);
              return (
                <tr key={`${r.empresa.id}-${r.obligacion.modelo}-${r.obligacion.periodo}-${r.obligacion.ejercicio}`}>
                  <td>{r.empresa.nombre}</td>
                  <td>
                    <strong>{r.obligacion.modelo}</strong>{" "}
                    <span className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                      {r.obligacion.periodo} {r.obligacion.ejercicio}
                    </span>
                  </td>
                  <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                    {new Date(r.obligacion.fecha_limite + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                    <span style={{ color: "var(--muted)" }}>
                      {" · "}{r.obligacion.dias_restantes < 0
                        ? `vencido ${-r.obligacion.dias_restantes}d`
                        : `${r.obligacion.dias_restantes}d`}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/aeat?modelo=${r.obligacion.modelo}`}
                      className={`status ${u}`}
                      style={{ textDecoration: "none" }}
                    >
                      {r.obligacion.esta_presentada ? "presentado" : r.obligacion.dias_restantes < 0 ? "vencido" : r.obligacion.dias_restantes <= 7 ? "urgente" : "preparar"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </article>
  );
}
