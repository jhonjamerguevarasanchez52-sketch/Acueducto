create sequence if not exists public.facturas_numero_seq;

alter table public.invoices
  add column if not exists numero_factura bigint;

update public.invoices
set numero_factura = nextval('public.facturas_numero_seq')
where numero_factura is null;

alter table public.invoices
  alter column numero_factura set default nextval('public.facturas_numero_seq');
alter table public.invoices
  alter column numero_factura set not null;
alter sequence public.facturas_numero_seq owned by public.invoices.numero_factura;

do $$
declare
  max_numero bigint;
  ultimo_numero bigint;
  secuencia_usada boolean;
begin
  select max(numero_factura) into max_numero from public.invoices;
  select last_value, is_called into ultimo_numero, secuencia_usada from public.facturas_numero_seq;
  perform setval(
    'public.facturas_numero_seq',
    greatest(coalesce(max_numero, 1), ultimo_numero),
    secuencia_usada or max_numero is not null
  );
end $$;

create unique index if not exists idx_invoices_numero_factura
  on public.invoices (numero_factura);