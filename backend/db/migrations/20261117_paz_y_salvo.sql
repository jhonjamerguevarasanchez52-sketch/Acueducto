-- Constancias emitidas a perfiles al día. La copia no depende del perfil
-- activo para conservar evidencia de lo certificado.
create table if not exists public.clearance_certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_number text not null unique,
  profile_id uuid not null,
  profile_snapshot jsonb not null,
  invoice_snapshot jsonb not null default '[]'::jsonb,
  confirmed_payments_snapshot jsonb not null default '[]'::jsonb,
  outstanding_balance numeric(12,2) not null default 0 check (outstanding_balance = 0),
  generated_by_id uuid,
  generated_by_snapshot jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  email_sent_to text,
  email_status text not null default 'not_requested'
    check (email_status in ('not_requested', 'sent', 'failed')),
  email_error text
);

create index if not exists idx_clearance_certificates_profile
  on public.clearance_certificates (profile_id, generated_at desc);
create index if not exists idx_clearance_certificates_generated_at
  on public.clearance_certificates (generated_at desc);

alter table public.clearance_certificates enable row level security;
revoke all on table public.clearance_certificates from public, anon, authenticated;
grant all on table public.clearance_certificates to service_role;

notify pgrst, 'reload schema';
