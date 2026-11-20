-- Cédula en el perfil: permite iniciar sesión con la cédula además del correo.
-- Ejecutar en Supabase (SQL Editor) ANTES de desplegar el backend que la usa:
-- el backend la incluye en las columnas públicas del perfil.
--
-- Solo dígitos (se guarda sin puntos ni espacios), entre 5 y 15 caracteres.
-- Es opcional (las cuentas antiguas no la tienen) pero única: dos cuentas no
-- pueden compartir cédula porque el login no sabría a cuál entrar.

alter table public.profiles add column if not exists cedula text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_cedula_formato' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_cedula_formato check (cedula ~ '^[0-9]{5,15}$');
  end if;
end $$;

create unique index if not exists idx_profiles_cedula_unica
  on public.profiles (cedula)
  where cedula is not null;

-- La persona puede ver su propia cédula (RLS limita la fila), pero no
-- cambiarla: solo el administrador la registra, desde el backend.
grant select (cedula) on table public.profiles to authenticated;
