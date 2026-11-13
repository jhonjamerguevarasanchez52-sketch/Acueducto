-- ============================================================================
--  Correcciones de la revisión del 9-nov-2026
-- ----------------------------------------------------------------------------
--  Ejecutar completo en el SQL Editor de Supabase, DESPUÉS de
--  20261030_mejoras_integrales.sql. Es idempotente: se puede volver a correr.
--
--   1. Nuevo estado de Wompi REEMBOLSADO (el administrador devolvió un cobro
--      que no se pudo aplicar): ya no bloquea la factura.
--   2. Revertir a mensual un plan semestral/anual sin pagar ya no falla si la
--      tarifa cambió después de emitirlo (antes el usuario se quedaba sin la
--      factura del mes).
--   3. Asignar el fontanero en una sola transacción (nunca queda el acueducto
--      sin fontanero si algo falla a mitad).
--   4. Las tarifas nuevas deben tener una cuota mayor que cero.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Un pago devuelto (REEMBOLSADO) ya no cuenta como pago activo
-- ----------------------------------------------------------------------------
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
        or estado_wompi not in ('DECLINED', 'VOIDED', 'ERROR', 'SUPERSEDED', 'REEMBOLSADO')
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


-- ----------------------------------------------------------------------------
-- 2. Facturación mensual: revertir un plan sin pagar sin depender de la tarifa
-- ----------------------------------------------------------------------------
-- Antes se llamaba a configurar_plan_factura(…, 1), que exige que el valor de
-- la factura sea tarifa × meses. Si el administrador corregía la tarifa de ese
-- periodo, la función lanzaba "valor especial" y el usuario no recibía la
-- factura del mes. Ahora la factura vuelve a una sola mensualidad con el valor
-- mensual con el que se emitió (valor_total / meses), sin recalcular.
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
  v_inicio text;
  v_meses integer;
  v_valor_mensual numeric;
begin
  perform pg_advisory_xact_lock(hashtext(p_perfil_id::text)::bigint);

  select i.* into v_cubridora
  from public.invoice_service_periods cubierto
  join public.invoices i on i.id = cubierto.invoice_id
  where cubierto.perfil_id = p_perfil_id and cubierto.periodo = p_periodo;

  if found then
    v_meses := coalesce(v_cubridora.meses_cubiertos, 1);
    v_inicio := coalesce(v_cubridora.periodo_inicio, v_cubridora.periodo);
    -- Un semestre/año elegido pero nunca pagado no debe congelar la
    -- facturación ni inflar la deuda: al llegar el mes siguiente la factura
    -- vuelve a ser de una sola mensualidad y el cron sigue normalmente.
    if v_cubridora.estado in ('pendiente', 'vencida')
       and v_meses > 1
       and v_inicio < p_periodo
       and not public.factura_tiene_pago_activo(v_cubridora.id) then
      v_valor_mensual := round(v_cubridora.valor_total / v_meses);

      -- Un checkout abandonado con el valor del plan ya no sirve.
      update public.payments
      set estado_wompi = 'SUPERSEDED'
      where factura_id = v_cubridora.id and not confirmado and metodo = 'wompi'
        and estado_wompi = 'PENDING' and transaccion_id is null;

      update public.invoices
      set tipo = 'servicio',
          periodo = v_inicio,
          periodo_inicio = v_inicio,
          periodo_fin = v_inicio,
          meses_cubiertos = 1,
          valor_total = v_valor_mensual,
          detalle_prepago = null
      where id = v_cubridora.id;

      insert into public.notifications (perfil_id, mensaje, tipo, estado)
      values (
        p_perfil_id,
        format('Tu factura %s no se pagó como plan de %s meses; volvió a ser mensual por $%s.',
          v_cubridora.numero_factura, v_meses,
          replace(to_char(v_valor_mensual, 'FM999G999G999'), ',', '.')),
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

revoke all on function public.crear_factura_mensual_si_no_cubierta(uuid, text, integer, timestamptz, date) from public, anon, authenticated;
grant execute on function public.crear_factura_mensual_si_no_cubierta(uuid, text, integer, timestamptz, date) to service_role;


-- ----------------------------------------------------------------------------
-- 3. Asignar el único fontanero de forma atómica
-- ----------------------------------------------------------------------------
-- Baja a "usuario" al fontanero actual y sube al nuevo en la misma
-- transacción. Devuelve el perfil asignado (vacío si el id no existe; en ese
-- caso no se degrada a nadie).
create or replace function public.asignar_fontanero(p_perfil_id uuid)
returns setof public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.profiles where id = p_perfil_id) then
    return;
  end if;

  update public.profiles set rol = 'usuario'
  where rol = 'fontanero' and id <> p_perfil_id;

  return query
    update public.profiles set rol = 'fontanero'
    where id = p_perfil_id
    returning *;
end;
$$;

revoke all on function public.asignar_fontanero(uuid) from public, anon, authenticated;
grant execute on function public.asignar_fontanero(uuid) to service_role;


-- ----------------------------------------------------------------------------
-- 4. Tarifas con cuota positiva
-- ----------------------------------------------------------------------------
-- NOT VALID: no revisa las filas antiguas (por si alguna quedó en 0), pero
-- impide crear o editar tarifas nuevas con cuota 0 o negativa.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'rates_cuota_fija_positiva' and conrelid = 'public.rates'::regclass
  ) then
    alter table public.rates
      add constraint rates_cuota_fija_positiva check (cuota_fija > 0) not valid;
  end if;
end $$;
