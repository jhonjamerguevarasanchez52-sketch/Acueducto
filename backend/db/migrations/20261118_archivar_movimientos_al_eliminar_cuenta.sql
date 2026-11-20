-- Permite eliminar perfiles conservando las facturas y los pagos.
-- La copia completa del perfil y de su historial queda en deleted_users;
-- las filas contables originales permanecen con perfil_id = NULL.

create table if not exists public.deleted_users (
  id uuid primary key default gen_random_uuid(),
  deleted_user_id uuid not null unique,
  role text not null check (role in ('administrador', 'usuario', 'fontanero')),
  email text not null,
  full_name text not null,
  deletion_type text not null check (deletion_type in ('usuario', 'administrador')),
  deleted_by_id uuid,
  deleted_by_snapshot jsonb not null default '{}'::jsonb,
  exit_note text,
  profile_snapshot jsonb not null,
  history_snapshot jsonb not null default '{}'::jsonb,
  pending_invoices jsonb not null default '[]'::jsonb,
  pending_total numeric(12,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'deleted', 'error')),
  email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'failed', 'not_required')),
  email_error text,
  error_message text,
  requested_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_deleted_users_deleted_at
  on public.deleted_users (deleted_at desc);
create index if not exists idx_deleted_users_email
  on public.deleted_users (email);
create index if not exists idx_deleted_users_status
  on public.deleted_users (status, email_status);

alter table public.deleted_users enable row level security;
revoke all on table public.deleted_users from public, anon, authenticated;
grant all on table public.deleted_users to service_role;

alter table public.admin_audit_log
  add column if not exists actor_snapshot jsonb,
  add column if not exists subject_user_id uuid;
create index if not exists idx_admin_audit_subject_user
  on public.admin_audit_log (subject_user_id, created_at desc);

alter table public.invoices alter column perfil_id drop not null;
alter table public.invoices
  drop constraint if exists facturas_perfil_id_fkey,
  drop constraint if exists invoices_perfil_id_fkey;
alter table public.invoices
  add constraint facturas_perfil_id_fkey
  foreign key (perfil_id) references public.profiles (id) on delete set null;

alter table public.payments alter column perfil_id drop not null;
alter table public.payments
  drop constraint if exists pagos_perfil_id_fkey,
  drop constraint if exists payments_perfil_id_fkey;
alter table public.payments
  add constraint pagos_perfil_id_fkey
  foreign key (perfil_id) references public.profiles (id) on delete set null;

notify pgrst, 'reload schema';
