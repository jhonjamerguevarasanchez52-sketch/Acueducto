alter table public.invoices
  add column if not exists observacion text;

notify pgrst, 'reload schema';