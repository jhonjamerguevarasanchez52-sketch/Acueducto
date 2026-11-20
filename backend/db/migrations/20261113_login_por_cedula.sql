alter table public.profiles
  add column if not exists cedula text;

create unique index if not exists idx_profiles_cedula_unica
  on public.profiles (cedula)
  where cedula is not null and cedula <> '';

-- El usuario puede consultar su propio perfil (RLS); la escritura de cédula
-- se realiza solo desde el backend administrativo con la clave de servicio.
grant select (cedula) on table public.profiles to authenticated;
