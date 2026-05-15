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

## Agent Gates

- Supabase/RLS and Security review every auth, storage, document, API, and data-model change.
- Fiscal reviews IVA, IRPF, IS, VeriFactu, SEPA, deadlines, invoice states, and AEAT-facing exports.
- Laboral reviews workers, payroll, contracts, sick leave, vacations, time tracking, and labor documents.
- QA/E2E reviews every critical flow before production release.
- DevOps/Vercel reviews environment variables, deploy logs, domains, and rollback readiness.

## SQL Rule

Every future SQL change must be created as a new file under `supabase/migrations/` so it can be copied manually into Supabase SQL Editor. Never append new production SQL to an old migration once the user has already applied it.
