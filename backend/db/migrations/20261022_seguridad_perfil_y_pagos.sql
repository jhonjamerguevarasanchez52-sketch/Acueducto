-- Endurece los permisos del perfil y evita pagos pendientes duplicados por
-- solicitudes concurrentes a la misma factura.
-- Ejecutar en Supabase después de las migraciones previas.

-- La política RLS limita filas, pero por sí sola no impide leer códigos de
-- recuperación ni modificar columnas sensibles del perfil. El backend usa el
-- cliente de servicio en las rutas ya autenticadas para las escrituras internas.
revoke select on table public.profiles from public, anon, authenticated;
grant select (
  id,
  nombre,
  apellido,
  correo,
  rol,
  activo,
  is_verified,
  debe_cambiar_password,
  telefono,
  numero_lote,
  direccion,
  ocupacion,
  zona,
  created_at,
  updated_at
) on table public.profiles to authenticated;

revoke update on table public.profiles from public, anon, authenticated;
grant update (
  nombre,
  apellido,
  telefono,
  numero_lote,
  direccion,
  ocupacion,
  zona
) on table public.profiles to authenticated;

-- Pagos y averías se crean por endpoints autenticados que validan factura,
-- pertenencia y contenido. No permitir que el cliente REST inserte filas
-- saltándose esas validaciones.
revoke insert on table public.payments from public, anon, authenticated;
drop policy if exists "pagos: registrar los propios (sin confirmar)" on public.payments;
revoke insert on table public.breakdowns from public, anon, authenticated;
drop policy if exists "averias: reportar las propias" on public.breakdowns;

-- El usuario solo puede marcar el estado de lectura; no editar el contenido
-- ni cambiar el dueño de una notificación.
revoke update on table public.notifications from public, anon, authenticated;
grant update (estado) on table public.notifications to authenticated;

-- El usuario no puede elegir la fecha para eludir el límite de edición del
-- perfil. El backend la lee y el trigger la actualiza al guardar datos.
create or replace function public.sellar_edicion_perfil_propio()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.role() = 'authenticated' and (
    new.nombre is distinct from old.nombre or
    new.apellido is distinct from old.apellido or
    new.telefono is distinct from old.telefono or
    new.numero_lote is distinct from old.numero_lote or
    new.direccion is distinct from old.direccion or
    new.ocupacion is distinct from old.ocupacion or
    new.zona is distinct from old.zona
  ) then
    if coalesce(trim(new.telefono), '') <> ''
      and coalesce(trim(new.numero_lote), '') <> ''
      and coalesce(trim(new.direccion), '') <> ''
      and coalesce(trim(new.zona), '') <> '' then
      new.updated_at := now();
    else
      new.updated_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_sellar_edicion_propia on public.profiles;
create trigger trg_profiles_sellar_edicion_propia
before update on public.profiles
for each row execute function public.sellar_edicion_perfil_propio();

-- Una factura solo puede tener un pago pendiente activo a la vez. Los
-- rechazos terminales (DECLINED, VOIDED, ERROR) no bloquean un nuevo intento.
-- Si esta migración falla por duplicados existentes, revisar con:
-- select factura_id, count(*) from public.payments
-- where confirmado = false and (estado_wompi is null or estado_wompi in
--   ('PENDING', 'APPROVED_NO_APLICADO', 'MONTO_INVALIDO'))
-- group by factura_id having count(*) > 1;
create unique index if not exists idx_payments_un_pendiente_por_factura
  on public.payments (factura_id)
  where confirmado = false
    and (estado_wompi is null or estado_wompi in (
      'PENDING',
      'APPROVED_NO_APLICADO',
      'MONTO_INVALIDO'
    ));
