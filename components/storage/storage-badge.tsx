"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Quota = {
  used_mb: number;
  quota_mb: number;
  used_pct: number;
  plan: string;
  exceeded: boolean;
};

export function StorageBadge() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [quota, setQuota] = useState<Quota | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const tk = session.session?.access_token;
        if (!tk) return;
        const res = await fetch("/api/perfil/storage", { headers: { Authorization: `Bearer ${tk}` } });
        const json = await res.json();
        if (json.ok) setQuota(json);
      } catch {
        // silencio
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!quota) return null;

  const colorClass = quota.exceeded ? "bad" : quota.used_pct >= 80 ? "warn" : "good";
  const usedFmt = quota.used_mb >= 1024 ? `${(quota.used_mb / 1024).toFixed(2)} GB` : `${quota.used_mb.toFixed(1)} MB`;
  const quotaFmt = quota.quota_mb >= 1024 ? `${(quota.quota_mb / 1024).toFixed(0)} GB` : `${quota.quota_mb} MB`;

  return (
    <div className="storage-badge" role="status" aria-label="Almacenamiento usado">
      <div className="storage-head">
        <span className="storage-label">Almacenamiento · {quota.plan}</span>
        <span className={`storage-value ${colorClass}`}>{usedFmt} / {quotaFmt}</span>
      </div>
      <div className="storage-bar">
        <span className={colorClass} style={{ width: `${Math.min(100, quota.used_pct)}%` }} />
      </div>
      {quota.exceeded ? (
        <small style={{ color: "var(--bad)", fontFamily: "var(--mono)", fontSize: 10 }}>
          Cuota agotada. Sube de plan o elimina archivos.
        </small>
      ) : null}
    </div>
  );
}
