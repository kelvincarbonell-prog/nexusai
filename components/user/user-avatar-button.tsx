"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export function UserAvatarButton() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [foto, setFoto] = useState<string | null>(null);
  const [nombre, setNombre] = useState("M");

  useEffect(() => {
    (async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const tk = session.session?.access_token;
        if (!tk) return;
        const res = await fetch("/api/perfil", { headers: { Authorization: `Bearer ${tk}` } });
        const json = await res.json();
        if (json.ok && json.perfil) {
          setFoto(json.perfil.foto_url ?? null);
          const n = (json.perfil.nombre ?? json.perfil.email ?? "U").trim();
          const ini = n.split(/\s+/).slice(0, 2).map((s: string) => s[0]?.toUpperCase() ?? "").join("");
          setNombre(ini || n[0].toUpperCase());
        }
      } catch {
        // silencio
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Link
      href="/perfil"
      aria-label="Mi perfil"
      title="Mi perfil · configurar"
      style={
        foto
          ? {
              width: 30,
              height: 30,
              borderRadius: "50%",
              backgroundImage: `url("${foto}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              border: "1px solid var(--line)",
              display: "block",
            }
          : undefined
      }
      className={foto ? undefined : "avatar"}
    >
      {foto ? null : <span aria-hidden="true">{nombre}</span>}
    </Link>
  );
}
