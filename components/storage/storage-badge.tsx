"use client";

import { useEffect, useMemo, useState } from "react";
import { HardDrive, Gift, Copy, Check } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";

type Quota = {
  used_mb: number;
  quota_mb: number;
  used_pct: number;
  plan: string;
  exceeded: boolean;
  referral_code?: string;
  bonus_mb?: number;
};

export function StorageBadge() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const isWarn = quota.used_pct >= 70 && !quota.exceeded;
  const colorClass = quota.exceeded ? "bad" : isWarn ? "warn" : "good";
  const usedFmt = quota.used_mb >= 1024 ? `${(quota.used_mb / 1024).toFixed(2)} GB` : `${quota.used_mb.toFixed(1)} MB`;
  const quotaFmt = quota.quota_mb >= 1024 ? `${(quota.quota_mb / 1024).toFixed(0)} GB` : `${quota.quota_mb} MB`;
  const restanteMb = Math.max(0, quota.quota_mb - quota.used_mb);
  const restanteFmt = restanteMb >= 1024 ? `${(restanteMb / 1024).toFixed(2)} GB` : `${restanteMb.toFixed(0)} MB`;

  const refCode = quota.referral_code ?? "M26-INVITA";
  const refLink = typeof window !== "undefined"
    ? `${window.location.origin}/login?ref=${encodeURIComponent(refCode)}`
    : `/login?ref=${encodeURIComponent(refCode)}`;

  function copiarRef() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(refLink).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    }
  }

  return (
    <div className="storage-badge" role="status" aria-label="Almacenamiento" style={{ padding: 10 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          all: "unset",
          cursor: "pointer",
          width: "100%",
          display: "grid",
          gap: 6,
        }}
      >
        <div className="storage-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span className="storage-label" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, letterSpacing: 0.3, textTransform: "uppercase", opacity: 0.75 }}>
            <HardDrive size={12} />
            Almacenamiento
          </span>
          <span className={`storage-value ${colorClass}`} style={{ fontFamily: "var(--mono, monospace)", fontSize: 12, fontWeight: 700 }}>
            {usedFmt} / {quotaFmt}
          </span>
        </div>
        <div className="storage-bar" style={{ height: 6, borderRadius: 999, background: "color-mix(in srgb, currentColor 10%, transparent)", overflow: "hidden", position: "relative" }}>
          <span
            className={colorClass}
            style={{
              display: "block",
              width: `${Math.min(100, quota.used_pct)}%`,
              height: "100%",
              background: quota.exceeded ? "#ef4444" : isWarn ? "#f59e0b" : "var(--accent, #6366f1)",
              transition: "width 0.3s",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, opacity: 0.75 }}>
          <span>{quota.plan ?? "free"}</span>
          <span>{restanteFmt} disponibles</span>
        </div>
      </button>

      {/* Promo invita y gana */}
      <div
        style={{
          marginTop: 8,
          padding: 8,
          borderRadius: 8,
          background: "color-mix(in srgb, var(--accent, #6366f1) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--accent, #6366f1) 28%, transparent)",
          display: "grid",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700 }}>
          <Gift size={12} color="var(--accent, #6366f1)" />
          Invita y suma 500 MB
        </div>
        <p style={{ margin: 0, fontSize: 10.5, opacity: 0.8, lineHeight: 1.4 }}>
          Por cada gestor o cliente que se registre con tu enlace ambos sumáis <strong>500 MB</strong>.
          {quota.bonus_mb ? ` Ya has ganado ${quota.bonus_mb >= 1024 ? `${(quota.bonus_mb / 1024).toFixed(1)} GB` : `${quota.bonus_mb} MB`}.` : ""}
        </p>
        <button
          type="button"
          onClick={copiarRef}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 9px",
            borderRadius: 6,
            border: "1px solid color-mix(in srgb, var(--accent, #6366f1) 30%, transparent)",
            background: "color-mix(in srgb, var(--accent, #6366f1) 8%, transparent)",
            color: "inherit",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "var(--mono, monospace)",
          }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "Copiado" : "Copiar enlace"}
        </button>
      </div>

      {quota.exceeded ? (
        <small style={{ color: "var(--bad, #ef4444)", fontFamily: "var(--mono, monospace)", fontSize: 10, display: "block", marginTop: 6 }}>
          Cuota agotada. Sube de plan o invita para ganar más espacio.
        </small>
      ) : null}
    </div>
  );
}
