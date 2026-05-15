alter table public.empresas
  alter column gestor_id drop not null;

alter table public.empresas
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null,
  add column if not exists account_type text not null default 'empresa',
  add column if not exists onboarding_source text not null default 'gestoria',
  add column if not exists plan text not null default 'starter',
  add column if not exists super_admin_notes text;

create index if not exists idx_empresas_owner_user_id on public.empresas(owner_user_id);
create index if not exists idx_empresas_onboarding_source on public.empresas(onboarding_source);
create index if not exists idx_empresas_account_type on public.empresas(account_type);

create table if not exists public.agent_configs (
  id text primary key,
  name text not null,
  category text not null default 'general',
  enabled boolean not null default true,
  priority integer not null default 100,
  mission text not null,
  rules_do text[] not null default '{}',
  rules_dont text[] not null default '{}',
  order_prompt text not null,
  config jsonb not null default '{}',
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.super_admin_settings (
  key text primary key,
  value jsonb not null default '{}',
  description text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  target_table text,
  target_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_configs_priority on public.agent_configs(priority);
create index if not exists idx_platform_audit_events_actor_id on public.platform_audit_events(actor_id);
create index if not exists idx_platform_audit_events_created_at on public.platform_audit_events(created_at desc);

drop trigger if exists set_updated_at_agent_configs on public.agent_configs;
create trigger set_updated_at_agent_configs before update on public.agent_configs
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_super_admin_settings on public.super_admin_settings;
create trigger set_updated_at_super_admin_settings before update on public.super_admin_settings
for each row execute function public.set_updated_at();

create or replace function public.can_access_empresa(target_empresa uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.empresas e
    where e.id = target_empresa
      and (e.gestor_id = auth.uid() or e.owner_user_id = auth.uid())
  )
  or exists (
    select 1 from public.portal_accesos pa
    where pa.empresa_id = target_empresa
      and pa.user_id = auth.uid()
      and pa.estado = 'activo'
  )
  or public.is_admin();
$$;

alter table public.agent_configs enable row level security;
alter table public.super_admin_settings enable row level security;
alter table public.platform_audit_events enable row level security;

drop policy if exists "companies visible" on public.empresas;
create policy "companies visible" on public.empresas
for select using (
  gestor_id = auth.uid()
  or owner_user_id = auth.uid()
  or public.can_access_empresa(id)
);

drop policy if exists "companies insert" on public.empresas;
create policy "companies insert" on public.empresas
for insert with check (
  gestor_id = auth.uid()
  or owner_user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "companies update" on public.empresas;
create policy "companies update" on public.empresas
for update using (
  gestor_id = auth.uid()
  or owner_user_id = auth.uid()
  or public.is_admin()
)
with check (
  gestor_id = auth.uid()
  or owner_user_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "companies delete" on public.empresas;
create policy "companies delete" on public.empresas
for delete using (gestor_id = auth.uid() or owner_user_id = auth.uid() or public.is_admin());

drop policy if exists "agent configs admin read" on public.agent_configs;
create policy "agent configs admin read" on public.agent_configs
for select using (public.is_admin());

drop policy if exists "agent configs admin write" on public.agent_configs;
create policy "agent configs admin write" on public.agent_configs
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "super admin settings admin read" on public.super_admin_settings;
create policy "super admin settings admin read" on public.super_admin_settings
for select using (public.is_admin());

drop policy if exists "super admin settings admin write" on public.super_admin_settings;
create policy "super admin settings admin write" on public.super_admin_settings
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "audit admin read" on public.platform_audit_events;
create policy "audit admin read" on public.platform_audit_events
for select using (public.is_admin());

drop policy if exists "audit authenticated insert" on public.platform_audit_events;
create policy "audit authenticated insert" on public.platform_audit_events
for insert with check (actor_id = auth.uid() or public.is_admin());

insert into public.agent_configs
  (id, name, category, enabled, priority, mission, rules_do, rules_dont, order_prompt)
values
  ('architect-supabase-rls', 'Arquitecto Supabase/RLS', 'database', true, 1,
   'Diseñar y revisar Supabase, RLS, Storage y modelo multi-tenant.',
   array['Revisar tablas nuevas', 'Revisar RLS', 'Revisar Storage privado', 'Revisar accesos por empresa'],
   array['No aprobar cambios sin control de ownership', 'No exponer service role en cliente'],
   'Actua como Arquitecto Supabase/RLS de NexusAI. Revisa permisos, tablas, storage y multi-tenancy.'),
  ('security', 'Agente Seguridad', 'security', true, 2,
   'Proteger datos, credenciales, documentos y APIs.',
   array['Buscar claves expuestas', 'Revisar APIs', 'Revisar descargas', 'Revisar XSS y autorizacion'],
   array['No permitir secretos en navegador', 'No aprobar descargas sin ownership'],
   'Actua como Agente Seguridad de NexusAI. Identifica riesgos criticos, altos y medios.'),
  ('fiscal', 'Agente Fiscal', 'fiscal', true, 3,
   'Validar flujos fiscales españoles para gestorías.',
   array['Revisar IVA', 'Revisar IRPF', 'Revisar modelos', 'Revisar VeriFactu', 'Revisar SEPA y plazos'],
   array['No dar por valido un calculo fiscal sin trazabilidad', 'No sustituir revision profesional humana'],
   'Actua como Agente Fiscal de NexusAI. Revisa formulas, plazos, estados y riesgos fiscales.'),
  ('laboral', 'Agente Laboral', 'laboral', true, 4,
   'Validar flujos laborales: trabajadores, nóminas, contratos, bajas y registro horario.',
   array['Revisar datos laborales sensibles', 'Revisar permisos', 'Revisar contratos y nominas', 'Revisar workflows laborales'],
   array['No exponer datos de empleados', 'No aprobar documentos laborales sin campos obligatorios'],
   'Actua como Agente Laboral de NexusAI. Revisa riesgos laborales, permisos y datos requeridos.'),
  ('product-ux', 'Agente Frontend/Product UX', 'product', true, 5,
   'Optimizar la experiencia del sistema operativo 360 para gestorías.',
   array['Revisar navegación', 'Revisar workflows', 'Revisar estados vacios', 'Revisar formularios'],
   array['No usar patrones de landing dentro del dashboard operativo', 'No ocultar acciones criticas'],
   'Actua como Agente Product UX de NexusAI. Mejora flujos, pantallas y eficiencia operativa.'),
  ('qa-e2e', 'Agente QA/E2E', 'qa', true, 6,
   'Verificar flujos completos y regresiones.',
   array['Probar login', 'Probar permisos cruzados', 'Probar documentos', 'Probar flujos criticos'],
   array['No aprobar sin prueba happy path', 'No aprobar sin prueba de denegacion de permisos'],
   'Actua como Agente QA/E2E de NexusAI. Define pruebas, bloqueos y riesgos de regresion.'),
  ('performance', 'Agente Performance', 'performance', true, 7,
   'Mantener NexusAI rapido y escalable en Vercel.',
   array['Revisar bundle', 'Revisar queries', 'Revisar cache', 'Revisar tablas grandes'],
   array['No añadir dependencias pesadas sin motivo', 'No cargar listas grandes sin paginacion'],
   'Actua como Agente Performance de NexusAI. Revisa bundle, queries, cache y Core Web Vitals.'),
  ('seo-marketing', 'Agente SEO/Marketing', 'seo', true, 8,
   'Posicionar NexusAI publicamente sin exponer rutas privadas.',
   array['Revisar metadata', 'Revisar schema', 'Revisar copy publico', 'Revisar indexabilidad'],
   array['No indexar dashboard privado', 'No mostrar datos sensibles en paginas publicas'],
   'Actua como Agente SEO/Marketing de NexusAI. Revisa posicionamiento, metadata y contenidos publicos.'),
  ('devops-vercel', 'Agente DevOps/Vercel', 'devops', true, 9,
   'Asegurar despliegues automaticos y observabilidad en Vercel.',
   array['Revisar variables de entorno', 'Revisar build logs', 'Revisar dominios', 'Revisar rollback'],
   array['No desplegar sin variables necesarias', 'No commitear secretos'],
   'Actua como Agente DevOps/Vercel de NexusAI. Revisa deploy, variables, logs y rollback.')
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  enabled = excluded.enabled,
  priority = excluded.priority,
  mission = excluded.mission,
  rules_do = excluded.rules_do,
  rules_dont = excluded.rules_dont,
  order_prompt = excluded.order_prompt,
  updated_at = now();

insert into public.super_admin_settings (key, value, description)
values
  ('onboarding', '{"self_serve_enabled": true, "gestoria_invites_enabled": true}', 'Opciones de registro para gestorías, autónomos y empresas independientes'),
  ('security', '{"require_private_storage": true, "require_rls": true, "ai_keys_server_side_only": true}', 'Reglas globales de seguridad'),
  ('limits', '{"starter_clients": 3, "starter_documents_month": 50, "starter_ai_calls_month": 100}', 'Límites iniciales por plan')
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();
