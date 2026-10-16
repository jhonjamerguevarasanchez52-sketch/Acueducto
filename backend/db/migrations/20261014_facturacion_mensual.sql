-- Ejecutar una vez en Supabase antes de habilitar la tarea mensual.
-- Si existen facturas de servicio duplicadas para un usuario y periodo,
-- resolverlas antes de crear este índice.
alter table public.invoices
  add column if not exists generada_automaticamente boolean not null default false;

alter table public.invoices
  add column if not exists correo_factura_enviado_at timestamptz;

create unique index if not exists idx_invoices_servicio_perfil_periodo
  on public.invoices (perfil_id, periodo)
  where tipo = 'servicio';
