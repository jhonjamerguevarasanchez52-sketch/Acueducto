-- Alinea columnas de pagos/cortes y la tabla de auditoría con los modelos.

alter table public.payments
  add column if not exists registrado_por uuid
    references public.profiles (id) on delete set null;

alter table public.service_outages
  add column if not exists cortado_por uuid
    references public.profiles (id) on delete set null,
  add column if not exists reconectado_por uuid
    references public.profiles (id) on delete set null,
  add column if not exists origen text not null default 'manual';

create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references public.profiles (id) on delete set null,
  accion      text not null,
  tabla       text not null,
  registro_id uuid,
  detalle     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_created_at
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from public, anon, authenticated;
grant insert on table public.admin_audit_log to service_role;
