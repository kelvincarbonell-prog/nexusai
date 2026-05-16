import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Mic } from "lucide-react";
import { StorageBadge } from "@/components/storage/storage-badge";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { UserAvatarButton } from "@/components/user/user-avatar-button";

type NavItem = {
  href: string;
  label: string;
  count?: number | string;
  kbd?: string;
};

const gestorNav: NavItem[] = [
  { href: "/dashboard", label: "Hoy", kbd: "⌘1" },
  { href: "/clientes", label: "Clientes", kbd: "⌘2" },
  { href: "/facturacion", label: "Facturación", kbd: "⌘3" },
  { href: "/aeat", label: "Modelos AEAT", kbd: "⌘4" },
  { href: "/contabilidad", label: "Contabilidad", kbd: "⌘5" },
  { href: "/laboral", label: "Laboral", kbd: "⌘6" },
  { href: "/agentes", label: "Agentes IA", kbd: "⌘7" },
  { href: "/movil", label: "Móvil", kbd: "⌘8" },
];

const accountNav: NavItem[] = [
  { href: "/tareas", label: "Tareas" },
  { href: "/inteligencia", label: "Inteligencia" },
  { href: "/crm", label: "CRM" },
  { href: "/perfil", label: "Mi perfil" },
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
  const allNav = [...gestorNav, ...accountNav, ...(showSuperAdmin ? adminExtras : [])];
  return (
    <div className={rightRail ? "shell with-copilot" : "shell"}>
      <aside className="sidebar" aria-label="Navegación principal">
        <Link href="/dashboard" className="sb-brand" aria-label="Inicio">
          <span className="sb-brand-mark m26-mark">M26</span>
          <span>Modelo 26</span>
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

        <StorageBadge />
      </aside>

      <main className="main">
        {!hideTopbar ? (
          topbar ?? (
            <div className="topbar">
              <label className="topbar-search" aria-label="Buscador">
                <span className="kbd">⌘K</span>
                <input placeholder="Pide a M26 algo… ej. «presenta el IVA 2T de Innova»" />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--muted)" }}>
                  <span className="pulse-dot" aria-hidden="true" />
                  <Mic size={13} aria-hidden="true" /> voz
                </span>
              </label>
              <div className="topbar-meta">
                <time suppressHydrationWarning>
                  {new Date().toLocaleString("es-ES", { weekday: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </time>
                <NotificationsBell />
                <ThemeToggle compact />
                <UserAvatarButton />
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
