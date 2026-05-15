"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SetupRequired } from "@/components/setup-required";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  const isMissingSupabaseEnv = /Missing environment variable:\s+(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY)/i.test(
    error.message ?? "",
  );

  if (isMissingSupabaseEnv) {
    const m = /Missing environment variable:\s+(\S+)/i.exec(error.message ?? "");
    return <SetupRequired missing={m ? [m[1]] : ["NEXT_PUBLIC_SUPABASE_URL"]} />;
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 32 }}>
      <div className="card" style={{ maxWidth: 560, width: "100%", display: "grid", gap: 14 }}>
        <span className="card-eyebrow bad">Error inesperado</span>
        <h1 className="title" style={{ fontSize: 24 }}>Algo ha fallado.</h1>
        <p className="muted" style={{ fontSize: 14 }}>{error.message}</p>
        {error.digest ? <code style={{ fontSize: 12 }}>digest: {error.digest}</code> : null}
        <div className="button-row">
          <button className="button" onClick={reset}>Reintentar</button>
          <Link className="button secondary" href="/">Inicio</Link>
        </div>
      </div>
    </main>
  );
}
