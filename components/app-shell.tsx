import Link from "next/link";
import {
  CalendarDays,
  UserSquare,
  FileText,
  Calculator,
  BookOpen,
  Users,
  Sparkles,
  Smartphone,
  ListChecks,
  LineChart,
  Target,
  UserCircle,
  ShieldCheck,
  UsersRound,
  MessageSquare,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { StorageBadge } from "@/components/storage/storage-badge";
import { CommandPalette } from "@/components/command-palette";
import { AppTopbar } from "@/components/app-topbar";
import { GestorAsistente } from "@/components/dashboard/gestor-asistente";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  count?: number | string;
  kbd?: string;
};

const gestorNav: NavItem[] = [
  { href: "/dashboard", label: "Hoy", icon: CalendarDays, kbd: "⌘1" },
  { href: "/clientes", label: "Clientes", icon: UserSquare, kbd: "⌘2" },
  { href: "/facturacion", label: "Facturación", icon: FileText, kbd: "⌘3" },
  { href: "/aeat", label: "Modelos AEAT", icon: Calculator, kbd: "⌘4" },
  { href: "/contabilidad", label: "Contabilidad", icon: BookOpen, kbd: "⌘5" },
  { href: "/laboral", label: "Laboral", icon: Users, kbd: "⌘6" },
  { href: "/agentes", label: "Agentes IA", icon: Sparkles, kbd: "⌘7" },
  { href: "/movil", label: "Móvil", icon: Smartphone, kbd: "⌘8" },
];

const accountNav: NavItem[] = [
  { href: "/solicitudes", label: "Solicitudes", icon: Inbox },
  { href: "/mensajes", label: "Mensajes", icon: MessageSquare },
  { href: "/tareas", label: "Tareas", icon: ListChecks },
  { href: "/inteligencia", label: "Inteligencia", icon: LineChart },
  { href: "/crm", label: "CRM", icon: Target },
  { href: "/equipo", label: "Equipo", icon: UsersRound },
  { href: "/perfil", label: "Mi perfil", icon: UserCircle },
];

const adminExtras: NavItem[] = [
  { href: "/super-admin", label: "Super Admin", icon: ShieldCheck },
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
      <CommandPalette />
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
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} prefetch className={isActive ? "active" : undefined} aria-current={isActive ? "page" : undefined}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <Icon
                    size={15}
                    strokeWidth={1.8}
                    aria-hidden="true"
                    style={{ flexShrink: 0, color: isActive ? "var(--accent)" : "var(--muted)" }}
                  />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
                </span>
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
        {!hideTopbar ? (topbar ?? <AppTopbar />) : null}
        {children}
      </main>

      {rightRail}

      {/* FAB asistente del gestor: presente en toda la app autenticada */}
      <GestorAsistente />
    </div>
  );
}
