-- ============================================================================
--  Mejoras integrales (auditoría del 29-oct-2026)
-- ----------------------------------------------------------------------------
--  Ejecutar completo en el SQL Editor de Supabase, DESPUÉS de las migraciones
--  anteriores (incluida 20261029_audios_averias.sql). Es idempotente: se puede
--  volver a ejecutar sin romper nada.
--
--   1. Tarifa mensual leída de `rates` (ya no 12.000 fijo en SQL).
--   2. Protección de la contabilidad: no se borran facturas ni pagos al
--      eliminar un usuario.
--   3. Una factura solo pasa a "pagada" con un pago confirmado, y una factura
--      pagada no se puede reabrir ni anular.
--   4. Facturas vencidas automáticas y recordatorio previo al vencimiento.
--   5. Bloqueo por intentos fallidos persistente (sobrevive a reinicios).
--   6. Ingreso con código enviado al correo (sin contraseña).
--   7. El usuario solo edita sus datos de contacto; la ubicación del servicio
--      la fija el administrador (o el usuario una única vez, si está vacía).
--   8. Cortes programados por zona (mantenimientos, daños generales).
--   9. Tareas automáticas con pg_cron (facturar, vencer, recordar, mantener
--      despierto el servidor).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Tarifa mensual vigente
-- ----------------------------------------------------------------------------
-- Cuota residencial vigente en una fecha. 12.000 es solo el respaldo si el
-- administrador aún no registró ninguna tarifa (igual que el backend).
create or replace function public.tarifa_mensual_vigente(p_fecha date default current_date)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce((
    select r.cuota_fija
    from public.rates r
    where r.tipo = 'residencial'
      and r.vigente_desde <= p_fecha
      and (r.vigente_hasta is null or r.vigente_hasta >= p_fecha)
      and r.cuota_fija > 0
    order by r.vigente_desde desc
    limit 1
  ), 12000);
$$;

create or replace function public.tarifa_mensual_de_periodo(p_periodo text)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
  select public.tarifa_mensual_vigente(to_date(p_periodo || '-01', 'YYYY-MM-DD'));
$$;

create or replace function public.configurar_plan_factura(
  p_factura_id uuid,
  p_perfil_id uuid,
  p_meses integer
)
returns setof public.invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_factura public.invoices%rowtype;
  v_inicio text;
  v_fin text;
  v_periodo_conflictivo text;
  v_periodos text;
  v_tarifa numeric;
begin
  if p_meses not in (1, 6, 12) then
    raise exception 'El plan debe cubrir 1, 6 o 12 meses';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_perfil_id::text)::bigint);

  select * into v_factura
  from public.invoices
  where id = p_factura_id and perfil_id = p_perfil_id
  for update;

  if not found then raise exception 'Factura no encontrada'; end if;
  if v_factura.estado not in ('pendiente', 'vencida') or v_factura.tipo not in ('servicio', 'prepago') then
    raise exception 'La factura no admite cambios de plan';
  end if;

  v_inicio := coalesce(v_factura.periodo_inicio, v_factura.periodo);
  if v_inicio !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'El periodo inicial de la factura no es válido';
  end if;
  v_tarifa := public.tarifa_mensual_de_periodo(v_inicio);

  -- Facturas con un valor distinto a la tarifa de su periodo (recargos,
  -- valores especiales) se pagan tal como se emitieron.
  if v_factura.valor_total <> v_tarifa * coalesce(v_factura.meses_cubiertos, 1) then
    raise exception 'Esta factura tiene un valor especial y no admite planes de pago';
  end if;
  if public.factura_tiene_pago_activo(p_factura_id) then
    raise exception 'La factura tiene un pago en curso o confirmado; no se puede cambiar el plan';
  end if;
  -- El checkout abandonado se reemplaza: el nuevo valor exige abrir uno nuevo.
  update public.payments
  set estado_wompi = 'SUPERSEDED'
  where factura_id = p_factura_id and not confirmado and metodo = 'wompi'
    and estado_wompi = 'PENDING' and transaccion_id is null;

  v_fin := to_char(
    to_date(v_inicio || '-01', 'YYYY-MM-DD') + make_interval(months => p_meses - 1),
    'YYYY-MM'
  );

  select cubierto.periodo into v_periodo_conflictivo
  from public.invoice_service_periods cubierto
  where cubierto.perfil_id = p_perfil_id
    and cubierto.periodo between v_inicio and v_fin
    and cubierto.invoice_id <> p_factura_id
  limit 1;
  if v_periodo_conflictivo is not null then
    raise exception 'El periodo % ya está asociado a otra factura', v_periodo_conflictivo;
  end if;

  select string_agg(to_char(mes, 'YYYY-MM'), ', ' order by mes)
    into v_periodos
  from generate_series(
    to_date(v_inicio || '-01', 'YYYY-MM-DD'),
    to_date(v_fin || '-01', 'YYYY-MM-DD'),
    interval '1 month'
  ) as periodos(mes);

  update public.invoices
  set tipo = case when p_meses = 1 then 'servicio' else 'prepago' end,
      periodo = v_inicio,
      periodo_inicio = v_inicio,
      periodo_fin = v_fin,
      meses_cubiertos = p_meses,
      valor_total = v_tarifa * p_meses,
      detalle_prepago = case
        when p_meses = 1 then null
        else format('Servicio prepago de %s meses. Periodos incluidos: %s. Próxima mensualidad: %s.',
          p_meses, v_periodos,
          to_char(to_date(v_fin || '-01', 'YYYY-MM-DD') + interval '1 month', 'YYYY-MM'))
      end
  where id = p_factura_id
  returning * into v_factura;

  return next v_factura;
end;
$$;

create or replace function public.crear_factura_mensual_si_no_cubierta(
  p_perfil_id uuid,
  p_periodo text,
  p_valor_total integer,
  p_fecha_emision timestamptz,
  p_fecha_vencimiento date
)
returns setof public.invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_factura public.invoices%rowtype;
  v_cubridora public.invoices%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext(p_perfil_id::text)::bigint);

  select i.* into v_cubridora
  from public.invoice_service_periods cubierto
  join public.invoices i on i.id = cubierto.invoice_id
  where cubierto.perfil_id = p_perfil_id and cubierto.periodo = p_periodo;

  if found then
    -- Un semestre/año elegido pero nunca pagado no debe congelar la
    -- facturación ni inflar la deuda: al llegar el mes siguiente la factura
    -- vuelve a ser de una sola mensualidad y el cron sigue normalmente.
    if v_cubridora.estado in ('pendiente', 'vencida')
       and coalesce(v_cubridora.meses_cubiertos, 1) > 1
       and coalesce(v_cubridora.periodo_inicio, v_cubridora.periodo) < p_periodo
       and not public.factura_tiene_pago_activo(v_cubridora.id) then
      perform public.configurar_plan_factura(v_cubridora.id, p_perfil_id, 1);
      insert into public.notifications (perfil_id, mensaje, tipo, estado)
      values (
        p_perfil_id,
        format('Tu factura %s no se pagó como plan de %s meses; volvió a ser mensual por $%s.',
          v_cubridora.numero_factura, v_cubridora.meses_cubiertos,
          replace(to_char(public.tarifa_mensual_de_periodo(
            coalesce(v_cubridora.periodo_inicio, v_cubridora.periodo)), 'FM999G999G999'), ',', '.')),
        'factura',
        'no_leido'
      );
    else
      return;
    end if;
  end if;

  insert into public.invoices (
    perfil_id, periodo, periodo_inicio, periodo_fin, meses_cubiertos,
    tipo, valor_total, estado, fecha_emision, fecha_vencimiento,
    generada_automaticamente
  ) values (
    p_perfil_id, p_periodo, p_periodo, p_periodo, 1,
    'servicio', p_valor_total, 'pendiente', p_fecha_emision,
    p_fecha_vencimiento, true
  )
  returning * into v_factura;

  return next v_factura;
end;
$$;

revoke all on function public.tarifa_mensual_vigente(date) from public, anon;
revoke all on function public.tarifa_mensual_de_periodo(text) from public, anon;
grant execute on function public.tarifa_mensual_vigente(date) to authenticated, service_role;
grant execute on function public.tarifa_mensual_de_periodo(text) to authenticated, service_role;
revoke all on function public.configurar_plan_factura(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.configurar_plan_factura(uuid, uuid, integer) to service_role;
revoke all on function public.crear_factura_mensual_si_no_cubierta(uuid, text, integer, timestamptz, date) from public, anon, authenticated;
grant execute on function public.crear_factura_mensual_si_no_cubierta(uuid, text, integer, timestamptz, date) to service_role;


-- ----------------------------------------------------------------------------
-- 2. Proteger la contabilidad: facturas y pagos no se borran en cascada
-- ----------------------------------------------------------------------------
-- Antes, eliminar un usuario borraba sus facturas y pagos confirmados. Ahora
-- la base de datos lo impide: un usuario con historial se DESACTIVA.
do $$
declare
  r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tabla, a.attname as columna,
           c.confrelid::regclass as referida
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.contype = 'f'
      and c.confdeltype = 'c' -- on delete cascade
      and (
        (c.conrelid = 'public.invoices'::regclass and a.attname = 'perfil_id') or
        (c.conrelid = 'public.payments'::regclass and a.attname in ('perfil_id', 'factura_id'))
      )
  loop
    execute format('alter table %s drop constraint %I', r.tabla, r.conname);
    execute format(
      'alter table %s add constraint %I foreign key (%I) references %s (id) on delete restrict',
      r.tabla, r.conname, r.columna, r.referida
    );
  end loop;
end $$;


-- ----------------------------------------------------------------------------
-- 3. Reglas de estado de las facturas
-- ----------------------------------------------------------------------------
create or replace function public.validar_estado_factura()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.estado = 'pagada' then
      raise exception 'Una factura no puede crearse como pagada: registra el pago';
    end if;
    return new;
  end if;

  -- Solo un pago confirmado (trigger procesar_pago_confirmado) marca pagada.
  if new.estado = 'pagada' and old.estado <> 'pagada' and not exists (
    select 1 from public.payments p where p.factura_id = new.id and p.confirmado
  ) then
    raise exception 'Una factura solo queda pagada al registrar o confirmar su pago';
  end if;

  -- Una factura pagada es un registro contable cerrado.
  if old.estado = 'pagada' and (
    new.estado <> 'pagada' or new.valor_total <> old.valor_total or new.perfil_id <> old.perfil_id
  ) then
    raise exception 'Una factura pagada no se puede reabrir, anular ni cambiar de valor';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validar_estado_factura on public.invoices;
create trigger trg_validar_estado_factura
before insert or update on public.invoices
for each row execute function public.validar_estado_factura();


-- ----------------------------------------------------------------------------
-- 4. Facturas vencidas y recordatorios
-- ----------------------------------------------------------------------------
alter table public.invoices add column if not exists recordatorio_enviado_at timestamptz;
alter table public.invoices add column if not exists aviso_vencida_enviado_at timestamptz;

-- Marca como vencidas las facturas pendientes cuya fecha límite ya pasó
-- (en hora de Colombia) y deja un aviso dentro de la app. Devuelve cuántas.
create or replace function public.marcar_facturas_vencidas()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_total integer;
begin
  with vencidas as (
    update public.invoices
    set estado = 'vencida', aviso_vencida_enviado_at = now()
    where estado = 'pendiente'
      and fecha_vencimiento is not null
      and fecha_vencimiento < v_hoy
    returning id, perfil_id, numero_factura, periodo
  ), avisos as (
    insert into public.notifications (perfil_id, mensaje, tipo, estado)
    select perfil_id,
           format('Tu factura %s del periodo %s está vencida. Págala desde la app para evitar la suspensión del servicio.',
             numero_factura, periodo),
           'factura', 'no_leido'
    from vencidas
    returning 1
  )
  select count(*) into v_total from vencidas;
  return v_total;
end;
$$;

revoke all on function public.marcar_facturas_vencidas() from public, anon, authenticated;
grant execute on function public.marcar_facturas_vencidas() to service_role;

create index if not exists idx_invoices_vencimiento_pendiente
  on public.invoices (fecha_vencimiento)
  where estado = 'pendiente';


-- ----------------------------------------------------------------------------
-- 5. Intentos fallidos persistentes (login, códigos)
-- ----------------------------------------------------------------------------
create table if not exists public.auth_intentos (
  clave           text primary key,  -- '<accion>:<correo>'
  intentos        integer not null default 0,
  bloqueado_hasta timestamptz,
  actualizado_en  timestamptz not null default now()
);
alter table public.auth_intentos enable row level security;
revoke all on public.auth_intentos from public, anon, authenticated;
grant all on public.auth_intentos to service_role;

-- Suma un fallo y bloquea al llegar al máximo, de forma atómica.
create or replace function public.registrar_intento_fallido(
  p_clave text,
  p_max integer,
  p_bloqueo_segundos integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.auth_intentos as a (clave, intentos, actualizado_en)
  values (p_clave, 1, now())
  on conflict (clave) do update
    set intentos = case
          when a.bloqueado_hasta is not null and a.bloqueado_hasta <= now() then 1
          else a.intentos + 1
        end,
        bloqueado_hasta = case
          when a.bloqueado_hasta is not null and a.bloqueado_hasta <= now() then null
          else a.bloqueado_hasta
        end,
        actualizado_en = now();

  update public.auth_intentos
  set bloqueado_hasta = now() + make_interval(secs => p_bloqueo_segundos),
      intentos = 0
  where clave = p_clave and intentos >= p_max;
end;
$$;
revoke all on function public.registrar_intento_fallido(text, integer, integer) from public, anon, authenticated;
grant execute on function public.registrar_intento_fallido(text, integer, integer) to service_role;


-- ----------------------------------------------------------------------------
-- 6. Ingreso con código enviado al correo
-- ----------------------------------------------------------------------------
alter table public.profiles add column if not exists codigo_acceso text;
alter table public.profiles add column if not exists codigo_acceso_expiracion timestamptz;
-- No se agregan al grant de lectura: igual que los demás códigos, nunca salen
-- del backend.


-- ----------------------------------------------------------------------------
-- 7. Permisos de edición del perfil propio
-- ----------------------------------------------------------------------------
-- Dirección, zona y lote identifican el servicio (facturas, averías). El
-- usuario ya no puede cambiarlos directamente; el backend permite llenarlos
-- una sola vez si están vacíos y, después, solo el administrador.
revoke update on table public.profiles from public, anon, authenticated;
grant update (nombre, apellido, telefono, ocupacion) on table public.profiles to authenticated;


-- ----------------------------------------------------------------------------
-- 8. Cortes programados por zona
-- ----------------------------------------------------------------------------
create table if not exists public.cortes_programados (
  id          uuid primary key default gen_random_uuid(),
  zona        text,               -- null = todo el acueducto
  motivo      text not null check (char_length(motivo) between 5 and 300),
  inicio      timestamptz not null,
  fin         timestamptz not null,
  cancelado   boolean not null default false,
  creado_por  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (fin > inicio)
);
create index if not exists idx_cortes_programados_fin on public.cortes_programados (fin);

alter table public.cortes_programados enable row level security;
revoke all on public.cortes_programados from public, anon, authenticated;
grant select on public.cortes_programados to authenticated;
grant all on public.cortes_programados to service_role;
drop policy if exists "cortes programados: lectura para autenticados" on public.cortes_programados;
create policy "cortes programados: lectura para autenticados"
  on public.cortes_programados for select
  to authenticated
  using (not cancelado);


-- ----------------------------------------------------------------------------
-- 9. Tareas automáticas (pg_cron + pg_net)
-- ----------------------------------------------------------------------------
-- En Supabase: Database > Extensions > habilita pg_cron y pg_net (o deja que
-- este bloque lo intente). Si no están disponibles, el resto de la migración
-- igual queda aplicada y las tareas se pueden correr desde el panel o con
-- `npm run tareas-diarias` en el backend.
do $$
begin
  create extension if not exists pg_cron;
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_cron/pg_net no disponibles (%). Programa las tareas manualmente.', sqlerrm;
end $$;

-- Vencer facturas todos los días a las 00:10 hora de Colombia (05:10 UTC).
-- No depende del backend: es SQL puro.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'hidroapp-vencer-facturas';
    perform cron.schedule('hidroapp-vencer-facturas', '10 5 * * *',
      'select public.marcar_facturas_vencidas()');
  end if;
end $$;

-- Programa TODAS las tareas que necesitan el backend: facturar y enviar
-- correos de factura y recordatorio (diaria), limpiar audios vencidos de
-- GOTA (cada hora, migración 20261029) y un ping cada 10 minutos para que el
-- servidor gratuito de Render no se duerma. Ejecutar UNA vez, con la URL real
-- del backend y el mismo valor de CRON_SECRET configurado en Render. Reemplaza
-- el cron manual de limpiar-audios descrito en la migración 20261029:
--
--   select public.programar_tareas_hidroapp('https://hidro-app.onrender.com', 'TU_CRON_SECRET');
--
create or replace function public.programar_tareas_hidroapp(p_url_backend text, p_secreto text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url text := rtrim(p_url_backend, '/');
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'Habilita pg_cron y pg_net en Database > Extensions';
  end if;
  if coalesce(length(p_secreto), 0) < 24 then
    raise exception 'El secreto debe tener al menos 24 caracteres';
  end if;

  perform cron.unschedule(jobid) from cron.job
  where jobname in ('hidroapp-tareas-diarias', 'hidroapp-mantener-despierto',
                    'hidroapp-limpiar-audios', 'limpiar-audios-averias');

  -- 06:00 hora de Colombia (11:00 UTC): factura (días 1 a 5), vence y recuerda.
  perform cron.schedule('hidroapp-tareas-diarias', '0 11 * * *', format(
    $cmd$select net.http_post(
      url := %L,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', %L),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    )$cmd$,
    v_url || '/api/tareas/diarias', p_secreto
  ));

  -- Cada hora: borrar audios de GOTA vencidos (conserva la transcripción).
  perform cron.schedule('hidroapp-limpiar-audios', '0 * * * *', format(
    $cmd$select net.http_post(
      url := %L,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', %L),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    )$cmd$,
    v_url || '/api/interno/limpiar-audios', p_secreto
  ));

  -- Ping cada 10 minutos entre 5 a. m. y 11 p. m. de Colombia.
  perform cron.schedule('hidroapp-mantener-despierto', '*/10 10-23,0-4 * * *', format(
    $cmd$select net.http_get(url := %L, timeout_milliseconds := 60000)$cmd$,
    v_url || '/health'
  ));

  return 'Tareas programadas: hidroapp-tareas-diarias, hidroapp-limpiar-audios y hidroapp-mantener-despierto';
end;
$$;
revoke all on function public.programar_tareas_hidroapp(text, text) from public, anon, authenticated;
