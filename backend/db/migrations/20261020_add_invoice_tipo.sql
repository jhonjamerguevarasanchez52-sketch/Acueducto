-- Las facturas extraordinarias guardan su clase en invoices.tipo.
-- Ejecutar en el SQL Editor del proyecto Supabase conectado al backend.
alter table public.invoices
  add column if not exists tipo text not null default 'servicio';

notify pgrst, 'reload schema';
