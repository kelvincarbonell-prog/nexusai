import Link from "next/link";
import { BarChart3, Building2, FileSignature, Files, Inbox, LayoutDashboard, Users } from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/dashboard?view=clientes", label: "Clientes", icon: Building2 },
  { href: "/dashboard?view=facturas", label: "Facturas", icon: Files },
  { href: "/dashboard?view=firma", label: "Firmas", icon: FileSignature },
  { href: "/dashboard?view=equipo", label: "Equipo", icon: Users },
  { href: "/portal", label: "Portal cliente", icon: Inbox },
];

export function AppShell({ children, active = "/dashboard" }: { children: React.ReactNode; active?: string }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">NX</span>
          <span>NexusAI</span>
        </div>
        <nav className="nav">
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={item.href === active ? "active" : undefined}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ marginTop: "auto" }} className="muted">
          <BarChart3 size={18} />
          <p>Next.js + Supabase migration</p>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
