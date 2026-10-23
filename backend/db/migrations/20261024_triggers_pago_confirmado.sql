-- Asegura que confirmar un pago y aplicar sus efectos sea una sola transacción.

create or replace function public.forzar_pago_no_confirmado_al_insertar()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.confirmado := false;
  new.fecha_confirmacion := null;
  new.metodo_confirmacion := null;
  return new;
end;
$$;

drop trigger if exists trg_forzar_pago_no_confirmado on public.payments;
create trigger trg_forzar_pago_no_confirmado
before insert on public.payments
for each row execute function public.forzar_pago_no_confirmado_al_insertar();

create or replace function public.procesar_pago_confirmado()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_factura public.invoices%rowtype;
begin
  if old.confirmado or not new.confirmado then
    return new;
  end if;

  -- El bloqueo serializa dos pagos concurrentes para la misma factura.
  select * into v_factura
  from public.invoices
  where id = new.factura_id
  for update;

  if not found then
    raise exception 'La factura no existe';
  end if;
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

  update public.invoices set estado = 'pagada' where id = new.factura_id;

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

drop trigger if exists trg_procesar_pago_confirmado on public.payments;
create trigger trg_procesar_pago_confirmado
after update of confirmado on public.payments
for each row execute function public.procesar_pago_confirmado();
