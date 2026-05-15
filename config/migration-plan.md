# NexusAI Migration Plan

## Target Architecture

- Frontend: Next.js on Vercel.
- Auth: Supabase Auth with SSR cookies.
- Database: Supabase Postgres with RLS as the source of truth.
- Files: private Supabase Storage buckets.
- Sensitive logic: Next API routes or Supabase Edge Functions.
- Legacy MVP: preserved in `legacy/` during the migration.

## Migration Order

1. Auth and user roles.
2. Companies and dashboard shell.
3. Invoices, expenses, and client portal data.
4. Documents, signed documents, and private storage.
5. AI routes and OCR.
6. Fiscal models, VeriFactu, SEPA, and advanced automations.

## Rules

- Never store private API keys in browser storage.
- Every table with client or company data must have RLS enabled.
- File downloads must check ownership before creating or returning content.
- UI modules should live in components, not in one large page file.
