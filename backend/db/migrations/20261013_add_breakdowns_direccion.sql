-- La API guarda la dirección del reportante en cada avería.
-- Aplicar en el SQL Editor del proyecto Supabase usado por el backend.
alter table public.breakdowns
  add column if not exists direccion text;

-- PostgREST puede conservar el esquema previo hasta que se recargue su caché.
notify pgrst, 'reload schema';
