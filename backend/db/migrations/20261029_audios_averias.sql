-- Audios que los usuarios le envían a GOTA para reportar averías.
--
-- El audio es temporal y la transcripción es permanente: el archivo vive en el
-- bucket privado `breakdown-audios` solo mientras sirve al fontanero, y la
-- tarea de limpieza (POST /api/interno/limpiar-audios) lo borra al vencer
-- `expira_en`. La fila se conserva con la transcripción y `borrado_en`.
--
-- Plazos (los fija el backend al escribir `expira_en`):
--   * Audio sin avería (conversación normal o reporte sin confirmar): 2 horas.
--   * Audio de una avería: 15 días como máximo.
--   * El fontanero lo escucha por primera vez: 72 horas desde ese momento.
--   * La avería se resuelve o se cancela: 72 horas desde ese momento.
--
-- Las llaves foráneas usan "set null" para que borrar una avería o un perfil
-- no deje archivos huérfanos en Storage: la limpieza los encuentra por
-- `expira_en` y los borra igual.
create table if not exists public.breakdown_audios (
  id            uuid primary key default gen_random_uuid(),
  perfil_id     uuid references public.profiles (id) on delete set null,
  averia_id     uuid references public.breakdowns (id) on delete set null,
  ruta_audio    text,
  content_type  text not null,
  duracion_s    integer not null check (duracion_s between 0 and 600),
  transcripcion text not null,
  creado_en     timestamptz not null default now(),
  escuchado_en  timestamptz,
  expira_en     timestamptz not null,
  borrado_en    timestamptz
);
create index if not exists idx_breakdown_audios_averia on public.breakdown_audios (averia_id);
create index if not exists idx_breakdown_audios_pendientes
  on public.breakdown_audios (expira_en) where ruta_audio is not null;

-- Cupo diario de audios por usuario. El día se cuenta en hora de Colombia.
create table if not exists public.audio_usage (
  perfil_id uuid not null references public.profiles (id) on delete cascade,
  dia       date not null,
  audios    integer not null default 0,
  segundos  integer not null default 0,
  primary key (perfil_id, dia)
);
create index if not exists idx_audio_usage_dia on public.audio_usage (dia);

-- Solo el backend (service role) lee y escribe estas tablas.
alter table public.breakdown_audios enable row level security;
alter table public.audio_usage enable row level security;
revoke all on public.breakdown_audios from public, anon, authenticated;
revoke all on public.audio_usage from public, anon, authenticated;
grant all on public.breakdown_audios to service_role;
grant all on public.audio_usage to service_role;

-- Reserva un audio del cupo de forma atómica, antes de pagar la
-- transcripción. Devuelve 'ok', 'limite_usuario' o 'limite_global'.
-- El tope global protege el plan gratuito de Groq aunque haya muchos usuarios.
create or replace function public.consumir_cupo_audio(
  p_perfil_id uuid,
  p_segundos integer,
  p_max_audios integer,
  p_max_segundos_globales integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dia date := (now() at time zone 'America/Bogota')::date;
  v_total integer;
  v_audios integer;
begin
  -- Serializa las reservas del día para que dos peticiones simultáneas no
  -- pasen ambas el tope global.
  perform pg_advisory_xact_lock(hashtext('consumir_cupo_audio'));

  select coalesce(sum(segundos), 0) into v_total
  from public.audio_usage
  where dia = v_dia;

  if v_total + p_segundos > p_max_segundos_globales then
    return 'limite_global';
  end if;

  insert into public.audio_usage as u (perfil_id, dia, audios, segundos)
  values (p_perfil_id, v_dia, 1, p_segundos)
  on conflict (perfil_id, dia) do update
    set audios = u.audios + 1,
        segundos = u.segundos + excluded.segundos
    where u.audios < p_max_audios
  returning audios into v_audios;

  if v_audios is null then
    return 'limite_usuario';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.consumir_cupo_audio(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.consumir_cupo_audio(uuid, integer, integer, integer) to service_role;

notify pgrst, 'reload schema';

-- La limpieza horaria (POST /api/interno/limpiar-audios con x-cron-secret)
-- la programa public.programar_tareas_hidroapp(url, secreto), definida en
-- 20261030_mejoras_integrales.sql. Supabase no borra archivos de Storage
-- desde SQL; por eso el cron llama al backend, que usa la API de Storage.
