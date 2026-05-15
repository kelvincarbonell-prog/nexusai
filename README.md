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

- `supabase/migrations/20260515193000_super_admin_agents_self_serve.sql`: Super Admin, configurable agents, audit settings, and independent autónomo/empresa onboarding.
- `supabase/migrations/20260515194500_numeric_public_slugs.sql`: numeric public slugs for clients and gestorías, without exposing names in public identifiers.

## Specialist Agents

The operating model for NexusAI lives in `config/agents/`. It defines specialist review agents for Supabase/RLS architecture, security, fiscal, labor, product UX, QA/E2E, performance, SEO/marketing, and Vercel DevOps.

Use these agents as gates before production releases, especially for modules that touch client data, fiscal calculations, labor data, documents, signatures, storage, or API routes.
