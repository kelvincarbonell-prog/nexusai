"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

/**
 * Link con feedback inmediato al pulsar:
 *  - Marca el ítem como "navegando" en cuanto haces click.
 *  - Reemplaza el icono por un spinner sutil hasta que cambie el pathname.
 *  - Usa startTransition para que React mantenga UI responsive.
 *
 * Drop-in para los enlaces del sidebar.
 */
export function NavLink({
  href,
  children,
  className,
  ariaCurrent,
  prefetch,
  icon,
  rightSlot,
  active,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  ariaCurrent?: "page" | undefined;
  prefetch?: boolean;
  icon?: ReactNode;
  rightSlot?: ReactNode;
  active?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [going, setGoing] = useState(false);

  useEffect(() => {
    // Cuando cambia el pathname, ya hemos llegado → quitamos el estado
    if (going) setGoing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function onClick(e: React.MouseEvent) {
    // Permite ctrl/cmd-click para abrir en pestaña sin disparar nuestra animación
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    setGoing(true);
    startTransition(() => router.push(href));
  }

  const navigating = going || isPending;

  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={className}
      aria-current={ariaCurrent}
      onClick={onClick}
      style={{ position: "relative" }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {navigating ? (
          <Loader2 size={15} strokeWidth={2} aria-hidden="true" className="animate-spin" style={{ color: "var(--accent)" }} />
        ) : (
          icon
        )}
        {children}
      </span>
      {rightSlot}
      {navigating && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 2,
            background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
            backgroundSize: "200% 100%",
            animation: "nav-link-shimmer 1.1s linear infinite",
            borderRadius: 999,
          }}
        />
      )}
    </Link>
  );
}
