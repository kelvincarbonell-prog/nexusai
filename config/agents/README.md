# Modelo 26 Agent Roster

This folder defines the specialist agents we use to evolve Modelo 26 as a 360-degree operating system for gestorías.

## How To Use

For each product change, run the relevant agents in this order:

1. `architect-supabase-rls`
2. `security`
3. `fiscal`
4. `laboral`
5. `product-ux`
6. `qa-e2e`
7. `performance`
8. `seo-marketing`
9. `devops-vercel`

Not every task needs every agent. Security, QA, and Supabase/RLS should review every change that touches user data, documents, auth, storage, or API routes.

## Release Rule

No change should be considered production-ready until:

- The Supabase/RLS agent confirms data ownership and access policies.
- The Security agent confirms no secrets or private data are exposed to the browser.
- The QA/E2E agent has a happy-path test and at least one permission-denial test.
- The DevOps/Vercel agent confirms the change can deploy from `main`.
