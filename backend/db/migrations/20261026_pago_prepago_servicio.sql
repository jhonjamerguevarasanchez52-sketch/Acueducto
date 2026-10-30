-- Permite pagar una, seis o doce mensualidades en una sola factura.
-- Ejecutar en Supabase antes de publicar el backend y la app móvil.

alter table public.invoices
  drop constraint if exists invoices_tipo_check;

alter table public.invoices
  add constraint invoices_tipo_check
  check (tipo in ('servicio', 'prepago', 'extraordinaria'));

alter table public.invoices
  add column if not exists periodo_inicio text,
  add column if not exists periodo_fin text,
  add column if not exists meses_cubiertos integer,
  add column if not exists detalle_prepago text,
  add column if not exists fecha_ultimo_pago timestamptz,
  add column if not exists fecha_proxima_facturacion date;

update public.invoices
set periodo_inicio = periodo,
    periodo_fin = periodo,
    meses_cubiertos = 1
where tipo = 'servicio'
  and (periodo_inicio is null or periodo_fin is null or meses_cubiertos is null);

-- Una factura de servicio anulada ya no bloquea volver a emitir ese mes:
-- solo puede haber una factura de servicio activa por usuario y periodo.
drop index if exists public.idx_invoices_servicio_perfil_periodo;
create unique index idx_invoices_servicio_perfil_periodo
  on public.invoices (perfil_id, periodo)
  where tipo = 'servicio' and estado <> 'anulada';

create table if not exists public.invoice_service_periods (
  perfil_id uuid not null references public.profiles (id) on delete cascade,
  periodo text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (perfil_id, periodo)
);

-- Una versión previa de schema.sql creó esta restricción con '\\d' (barra
-- literal), que rechazaba todos los periodos. Se recrea con el patrón correcto.
alter table public.invoice_service_periods
  drop constraint if exists invoice_service_periods_periodo_check;
alter table public.invoice_service_periods
  add constraint invoice_service_periods_periodo_check
  check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$');

alter table public.invoice_service_periods enable row level security;
revoke all on public.invoice_service_periods from public, anon, authenticated;
grant all on public.invoice_service_periods to service_role;

insert into public.invoice_service_periods (perfil_id, periodo, invoice_id)
select i.perfil_id, to_char(periodo_mes, 'YYYY-MM'), i.id
from public.invoices i
cross join lateral generate_series(
  to_date(i.periodo_inicio || '-01', 'YYYY-MM-DD'),
  to_date(i.periodo_fin || '-01', 'YYYY-MM-DD'),
  interval '1 month'
) as periodos(periodo_mes)
where i.tipo in ('servicio', 'prepago')
  and i.estado <> 'anulada'
  and i.perfil_id is not null
  and i.periodo_inicio ~ '^\d{4}-(0[1-9]|1[0-2])$'
  and i.periodo_fin ~ '^\d{4}-(0[1-9]|1[0-2])$'
on conflict (perfil_id, periodo) do nothing;

create or replace function public.sincronizar_periodos_factura_servicio()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inicio text;
  v_fin text;
begin
  if tg_op = 'UPDATE' then
    delete from public.invoice_service_periods where invoice_id = old.id;
  end if;

  -- Una factura anulada libera sus meses para que el cron pueda facturarlos.
  -- Facturas sin titular (datos antiguos) no cubren meses de nadie.
  if new.tipo in ('servicio', 'prepago') and new.estado <> 'anulada' and new.perfil_id is not null then
    v_inicio := coalesce(new.periodo_inicio, new.periodo);
    v_fin := coalesce(new.periodo_fin, v_inicio);
    -- Facturas antiguas con periodo fuera de AAAA-MM (p. ej. '09/10/2026') no
    -- registran meses cubiertos; sin esta guarda, pagarlas fallaría.
    if v_inicio ~ '^\d{4}-(0[1-9]|1[0-2])$' and v_fin ~ '^\d{4}-(0[1-9]|1[0-2])$' then
      insert into public.invoice_service_periods (perfil_id, periodo, invoice_id)
      select new.perfil_id, to_char(mes, 'YYYY-MM'), new.id
      from generate_series(
        to_date(v_inicio || '-01', 'YYYY-MM-DD'),
        to_date(v_fin || '-01', 'YYYY-MM-DD'),
        interval '1 month'
      ) as periodos(mes);
    end if;
  end if;
  return new;
end;
$$;

-- Toda factura de servicio guarda su rango de meses, sin importar si la creó
-- el cron, el panel o un script: una mensualidad cubre solo su periodo.
create or replace function public.completar_periodos_factura_servicio()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.tipo = 'servicio' then
    new.periodo_inicio := coalesce(new.periodo_inicio, new.periodo);
    new.periodo_fin := coalesce(new.periodo_fin, new.periodo_inicio);
    new.meses_cubiertos := coalesce(new.meses_cubiertos, 1);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_completar_periodos_factura on public.invoices;
create trigger trg_completar_periodos_factura
before insert on public.invoices
for each row execute function public.completar_periodos_factura_servicio();
drop trigger if exists trg_sync_invoice_service_periods on public.invoices;
create trigger trg_sync_invoice_service_periods
after insert or update of perfil_id, periodo, tipo, estado, periodo_inicio, periodo_fin
on public.invoices
for each row execute function public.sincronizar_periodos_factura_servicio();

-- Un pago bloquea el cambio de plan mientras pueda llegar a confirmarse: si
-- ya está confirmado, es físico/manual o sigue en curso en Wompi. Los intentos
-- rechazados o reemplazados no bloquean (el usuario puede elegir otro plan).
create or replace function public.factura_tiene_pago_activo(p_factura_id uuid)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.payments
    where factura_id = p_factura_id
      and (
        confirmado
        or estado_wompi is null
        or estado_wompi not in ('DECLINED', 'VOIDED', 'ERROR', 'SUPERSEDED')
      )
      -- Un checkout de Wompi abierto hace más de 30 minutos y sin transacción
      -- se abandonó: Wompi no avisa cuando el usuario lo cierra sin pagar.
      and not (
        not confirmado and metodo = 'wompi' and estado_wompi = 'PENDING'
        and transaccion_id is null and fecha_pago < now() - interval '30 minutes'
      )
  );
$$;

revoke all on function public.factura_tiene_pago_activo(uuid) from public, anon, authenticated;
grant execute on function public.factura_tiene_pago_activo(uuid) to service_role;

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
  -- Facturas con un valor distinto a la tarifa (recargos, tarifas antiguas)
  -- se pagan tal como se emitieron: cambiar de plan recalcularia su valor.
  if v_factura.valor_total <> 12000 * coalesce(v_factura.meses_cubiertos, 1) then
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

  v_inicio := coalesce(v_factura.periodo_inicio, v_factura.periodo);
  if v_inicio !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'El periodo inicial de la factura no es válido';
  end if;
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
      valor_total = 12000 * p_meses,
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
        format('Tu factura %s no se pagó como plan de %s meses; volvió a ser mensual por $12.000.',
          v_cubridora.numero_factura, v_cubridora.meses_cubiertos),
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

revoke all on function public.configurar_plan_factura(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.configurar_plan_factura(uuid, uuid, integer) to service_role;
revoke all on function public.crear_factura_mensual_si_no_cubierta(uuid, text, integer, timestamptz, date) from public, anon, authenticated;
grant execute on function public.crear_factura_mensual_si_no_cubierta(uuid, text, integer, timestamptz, date) to service_role;

create or replace function public.procesar_pago_confirmado()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_factura public.invoices%rowtype;
begin
  if old.confirmado or not new.confirmado then return new; end if;

  select * into v_factura
  from public.invoices
  where id = new.factura_id
  for update;

  if not found then raise exception 'La factura no existe'; end if;
  if v_factura.perfil_id <> new.perfil_id then
    raise exception 'El pago no corresponde al titular de la factura';
  end if;
  if new.monto <> v_factura.valor_total then
    raise exception 'El monto (%) no coincide con el valor de la factura (%)', new.monto, v_factura.valor_total;
  end if;
  if new.monto_total <> new.monto + coalesce(new.cargo_wompi, 0) then
    raise exception 'El total cobrado no corresponde al monto y cargo registrados';
  end if;
  if v_factura.estado in ('pagada', 'anulada') then
    raise exception 'La factura ya fue pagada o está anulada';
  end if;

  update public.invoices
  set estado = 'pagada',
      fecha_ultimo_pago = now(),
      fecha_proxima_facturacion = case
        when coalesce(v_factura.periodo_fin, v_factura.periodo) ~ '^\d{4}-(0[1-9]|1[0-2])$'
        then (
          to_date(coalesce(v_factura.periodo_fin, v_factura.periodo) || '-01', 'YYYY-MM-DD')
          + interval '2 months'
        )::date
      end
  where id = new.factura_id;

  update public.service_outages
  set estado = 'reconectado', fecha_reconexion = now()
  where perfil_id = new.perfil_id and estado = 'activo';

  update public.payments
  set estado_wompi = 'SUPERSEDED'
  where factura_id = new.factura_id
    and id <> new.id
    and confirmado = false
    and (estado_wompi is null or estado_wompi = 'PENDING');

  insert into public.notifications (perfil_id, mensaje, tipo, estado)
  values (
    new.perfil_id,
    format('El pago de la factura %s fue confirmado correctamente.', v_factura.numero_factura),
    'pago',
    'no_leido'
  );

  return new;
end;
$$;

notify pgrst, 'reload schema';
