/**
 * Cuota de storage por usuario.
 *
 * Plans (en bytes):
 *  - free / autonomo: 500 MB
 *  - negocio: 5 GB
 *  - pyme / empresa: 20 GB
 *  - enterprise: 100 GB
 *
 * Se cuenta el tamaño de los archivos en los buckets propios del usuario.
 * Cada archivo en storage tiene name = '<user_id>/...' por convención.
 */

import { createSupabaseAdmin } from "@/lib/supabase/admin";

const PLAN_LIMITS_BYTES: Record<string, number> = {
  free: 500 * 1024 * 1024,
  autonomo: 500 * 1024 * 1024,
  negocio: 5 * 1024 * 1024 * 1024,
  "negocio_plus": 10 * 1024 * 1024 * 1024,
  pyme: 20 * 1024 * 1024 * 1024,
  enterprise: 100 * 1024 * 1024 * 1024,
};

const BUCKETS_USER = [
  "documents",
  "signed-documents",
  "ocr-uploads",
  "invoice-uploads",
  "labor-docs",
  "presupuestos",
  "aeat-files",
  "payroll-receipts",
  "avatars",
];

export type QuotaInfo = {
  used_bytes: number;
  quota_bytes: number;
  used_mb: number;
  quota_mb: number;
  used_pct: number;
  remaining_bytes: number;
  exceeded: boolean;
  plan: string;
};

export async function getQuotaForUser(userId: string): Promise<QuotaInfo> {
  const admin = createSupabaseAdmin();

  // Determinar plan: el primer empresa.plan del usuario, o de perfiles.metadata, o 'free'.
  const [{ data: perfil }, { data: empresa }] = await Promise.all([
    admin.from("perfiles").select("rol,metadata").eq("id", userId).maybeSingle(),
    admin.from("empresas").select("plan").eq("gestor_id", userId).limit(1).maybeSingle(),
  ]);
  const planFromPerfil = (perfil?.metadata as Record<string, unknown> | null)?.plan as string | undefined;
  const planFromEmpresa = empresa?.plan as string | undefined;
  const plan = (planFromPerfil ?? planFromEmpresa ?? (perfil?.rol === "admin" ? "enterprise" : "free")).toLowerCase();
  const quotaBytes = PLAN_LIMITS_BYTES[plan] ?? PLAN_LIMITS_BYTES.free;

  // Sumar bytes en cada bucket bajo path '<userId>/...'
  let usedBytes = 0;
  for (const bucket of BUCKETS_USER) {
    try {
      const { data: files } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
      for (const f of files ?? []) {
        const size = (f.metadata as { size?: number } | null)?.size ?? 0;
        usedBytes += Number(size);
      }
    } catch {
      // bucket puede no existir aún, ignorar
    }
  }

  const usedMb = Math.round((usedBytes / (1024 * 1024)) * 100) / 100;
  const quotaMb = Math.round((quotaBytes / (1024 * 1024)) * 100) / 100;
  const usedPct = quotaBytes > 0 ? Math.min(100, (usedBytes / quotaBytes) * 100) : 0;

  return {
    used_bytes: usedBytes,
    quota_bytes: quotaBytes,
    used_mb: usedMb,
    quota_mb: quotaMb,
    used_pct: Math.round(usedPct * 10) / 10,
    remaining_bytes: Math.max(0, quotaBytes - usedBytes),
    exceeded: usedBytes >= quotaBytes,
    plan,
  };
}

export async function checkQuotaOrThrow(userId: string, newFileBytes: number): Promise<QuotaInfo> {
  const q = await getQuotaForUser(userId);
  if (q.used_bytes + newFileBytes > q.quota_bytes) {
    throw new Error(
      `Cuota de almacenamiento excedida. Tienes ${q.used_mb} MB de ${q.quota_mb} MB (${q.used_pct} %). Sube de plan o borra archivos antiguos.`,
    );
  }
  return q;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
