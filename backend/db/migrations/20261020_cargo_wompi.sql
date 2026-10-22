-- Conserva el valor de la factura en monto (validado por el trigger) y registra
-- por separado el cargo trasladado al pagador y el total enviado a Wompi.
alter table public.payments
  add column if not exists cargo_wompi numeric(12,2) not null default 0 check (cargo_wompi >= 0),
  add column if not exists monto_total numeric(12,2);

update public.payments
set monto_total = monto + cargo_wompi
where monto_total is null;

alter table public.payments
  alter column monto_total set not null;
