-- Una sola cuenta puede tener el rol que habilita la lista global de averías.
-- Aplicar en Supabase después de verificar que no existan fontaneros duplicados.
create unique index if not exists idx_profiles_un_solo_fontanero
  on public.profiles (rol)
  where rol = 'fontanero';
