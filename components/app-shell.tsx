import Link from "next/link";

type NavItem = {
  href: string;
  label: string;
  count?: number | string;
  kbd?: string;
};

const gestorNav: NavItem[] = [
  { href: "/dashboard", label: "Hoy", count: 5, kbd: "⌘1" },
  { href: "/dashboard?view=clientes", label: "Clientes", count: 16, kbd: "⌘2" },
  { href: "/contabilidad", label: "Modelos", count: 3, kbd: "⌘3" },
  { href: "/laboral", label: "Nóminas", kbd: "⌘4" },
  { href: "/agentes", label: "Bancos", kbd: "⌘5" },
  { href: "/dashboard?view=alertas", label: "BOE & alertas", count: 2, kbd: "⌘6" },
  { href: "/dashboard?view=honorarios", label: "Honorarios", kbd: "⌘7" },
  { href: "/dashboard?view=auditoria", label: "Auditoría", kbd: "⌘8" },
];

const adminExtras: NavItem[] = [
  { href: "/super-admin", label: "Super Admin" },
];

export type AppShellProps = {
  children: React.ReactNode;
  active?: string;
  showSuperAdmin?: boolean;
  espacio?: { nombre: string; tipo: string; personas?: number };
  rightRail?: React.ReactNode;
  hideTopbar?: boolean;
  topbar?: React.ReactNode;
};

export function AppShell({
  children,
  active = "/dashboard",
  showSuperAdmin = false,
  espacio,
  rightRail,
  hideTopbar = false,
  topbar,
}: AppShellProps) {
  const allNav = [...gestorNav, ...(showSuperAdmin ? adminExtras : [])];
  return (
    <div className={rightRail ? "shell with-copilot" : "shell"}>
      <aside className="sidebar" aria-label="Navegación principal">
        <Link href="/dashboard" className="sb-brand" aria-label="Inicio">
          <span className="sb-brand-mark">N</span>
          <span>Nexus</span>
        </Link>

        {espacio ? (
          <div className="sb-section">
            <span className="sb-eyebrow">Espacio</span>
            <div className="sb-card">
              <div className="sb-card-title">
                <span className="avatar" aria-hidden="true">{espacio.nombre.slice(0, 1).toUpperCase()}</span>
                <div style={{ display: "grid", gap: 2 }}>
                  <span>{espacio.nombre}</span>
                  <small>{espacio.tipo}{espacio.personas != null ? ` · ${espacio.personas} personas` : ""}</small>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <nav className="sb-nav">
          {allNav.map((item) => {
            const isActive = item.href === active;
            return (
              <Link key={item.href} href={item.href} className={isActive ? "active" : undefined} aria-current={isActive ? "page" : undefined}>
                <span>{item.label}</span>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {item.count != null ? <span className="count">{item.count}</span> : null}
                  {item.kbd ? <span className="kbd">{item.kbd}</span> : null}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="sb-foot">
          <span className="sb-eyebrow">Conexiones</span>
          <span>● AEAT · <strong>directa</strong></span>
          <span>● SEPA · <strong>hace 4m</strong></span>
          <span>● Holvi · <strong>revisar</strong></span>
        </div>
      </aside>

      <main className="main">
        {!hideTopbar ? (
          topbar ?? (
            <div className="topbar">
              <label className="topbar-search" aria-label="Buscador">
                <span className="kbd">⌘K</span>
                <input placeholder="Pide a Nexus algo… ej. «presenta el IVA 2T de Innova»" />
                <span className="pill plain" style={{ background: "transparent", border: 0, color: "var(--muted)" }}>● voz</span>
              </label>
              <div className="topbar-meta">
                <time suppressHydrationWarning>{new Date().toLocaleString("es-ES", { weekday: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
                <span className="avatar" aria-hidden="true">N</span>
              </div>
            </div>
          )
        ) : null}
        {children}
      </main>

      {rightRail}
    </div>
  );
}
