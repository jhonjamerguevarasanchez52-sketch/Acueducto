-- La columna existía en schema.sql pero ninguna migración la creaba, así que
-- las bases actualizadas solo con migraciones no la tenían. Sin ella, toda
-- confirmación de pago (Wompi o manual) falla y el pago queda como
-- APPROVED_NO_APLICADO aunque Wompi ya haya cobrado.
alter table public.payments
  add column if not exists metodo_confirmacion text;

notify pgrst, 'reload schema';
