# NexusAI

NexusAI is being migrated from a static HTML/PHP MVP into a Vercel + Next.js frontend backed by Supabase Auth, Postgres, Storage, and Edge/API functions.

## Local Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill the Supabase values.
3. Run `npm run dev`.

## Deployment

Deploy this repository to Vercel and set the same environment variables in the Vercel project settings.

The previous MVP has been preserved under `legacy/` while modules are migrated incrementally.

## Required Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` or `GROQ_API_KEY`
- `NEXT_PUBLIC_APP_URL`

## Supabase Setup

Run the SQL in `supabase/migrations/20260515180000_initial_nexusai.sql` from the Supabase SQL editor. It creates the main tables, RLS policies, helper functions, and private storage buckets.

Run additional SQL files in chronological order. Each new database change is kept in a separate file so it can be copied manually into Supabase SQL Editor.

- `supabase/migrations/20260515180500_core_helpers_compatibility.sql`: compatibility patch for existing Supabase projects where helper functions such as `set_updated_at()` or `is_admin()` are missing.
- `supabase/migrations/20260515192500_empresas_schema_compatibility.sql`: compatibility patch for existing Supabase projects where `empresas` already existed without `gestor_id`, `owner_user_id`, account type, onboarding source, plan, notes, or numeric slug columns. Run this before retrying failed migrations if Supabase reports missing `empresas` columns.
- `supabase/migrations/20260515193000_super_admin_agents_self_serve.sql`: Super Admin, configurable agents, audit settings, and independent autónomo/empresa onboarding.
- `supabase/migrations/20260515194500_numeric_public_slugs.sql`: numeric public slugs for clients and gestorías, without exposing names in public identifiers.
- `supabase/migrations/20260515201000_accounting_pgc.sql`: accounting base for PGC accounts, journal, ledger data, trial balance, periods, bank reconciliation, fixed assets, amortization and VAT ledger.
- `supabase/migrations/20260515210000_labor_agents_inbox.sql`: labor module (contratos, ausencias, registro horario), forwarding inbox alias per empresa, invoice extractions, expense categorization history and agent runs.
- `supabase/migrations/20260520140000_aeat_nominas_calendar.sql`: tabla `aeat_declaraciones` para modelos 303/111/115/130/390/200, índice único de upsert en `nominas` por empresa+trabajador+periodo, y buckets de storage `aeat-files` y `payroll-receipts`. Auto-suficiente: crea los helpers `can_access_empresa`, `is_admin`, `set_updated_at` si faltan en tu Supabase.

## Labor Module

- `/laboral`: alta y baja de trabajadores, contratos, ausencias (vacaciones, IT, permisos, maternidad/paternidad), fichaje obligatorio RD 8/2019 y nóminas.
- `/api/laboral/trabajadores`, `/api/laboral/contratos`, `/api/laboral/ausencias`, `/api/laboral/horario`, `/api/laboral/nominas`, `/api/laboral/solicitudes`.

## Autonomous Agents

Agentes ejecutables con multi-proveedor IA (OpenAI GPT-4o → Anthropic Claude → Gemini → Groq).

- `/agentes`: consola para gestor/asesor.
- `/api/agents/extract-invoice`: extracción de proveedor, NIF, base, IVA, total, fecha y concepto desde imagen o texto.
- `/api/agents/categorize-expense`: sugerencia de cuenta PGC con histórico de la empresa + reglas + LLM.
- `/api/agents/runs`: trazabilidad de ejecuciones.
- `/api/inbound/email`: webhook para forwarding de email (Postmark/Mailgun/SendGrid). Cada empresa recibe un alias `facturas-xxx@inbox.nexusai.app` (`empresas.inbox_alias`).
- `/api/voice/query`: clasificador de intención + respuesta sobre IVA, gastos, vacaciones, fichajes…

## Mobile-First + PWA + voz

- `/movil`: home táctil con foto-factura, fichaje rápido y asistente de voz.
- `public/manifest.webmanifest` + `public/sw.js`: instalable como PWA con shortcuts (fichar, factura, voz).
- Web Speech API en español para reconocimiento y síntesis de voz.

## Accounting Module

- `/contabilidad`: operational accounting workspace for PGC accounts, journal entries, trial balance, VAT books, bank reconciliation and fixed assets.
- `/api/accounting/journal`: creates balanced journal entries, blocks locked/closed periods and assigns entry numbers per company.
- `/api/accounting/accounts`: lists global + company-specific PGC accounts and creates custom company accounts.
- `/api/accounting/periods`: creates and updates fiscal periods with open, locked and closed states.
- `/api/accounting/reports`: returns trial balance, profit and loss, balance sheet, VAT totals, fixed asset totals and accounting periods.

## Specialist Agents

The operating model for NexusAI lives in `config/agents/`. It defines specialist review agents for Supabase/RLS architecture, security, fiscal, labor, product UX, QA/E2E, performance, SEO/marketing, and Vercel DevOps.

Use these agents as gates before production releases, especially for modules that touch client data, fiscal calculations, labor data, documents, signatures, storage, or API routes.
