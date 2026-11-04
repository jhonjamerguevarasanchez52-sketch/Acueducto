-- ============================================================================
--  HIDROAPP - Esquema de base de datos (PostgreSQL / Supabase)
-- ============================================================================
--  ESTE ARCHIVO ES UNA RECONSTRUCCIÓN a partir del código del backend.
--  Sirve como referencia y para poder recrear el proyecto desde cero.
--  Antes de darlo por bueno, compáralo con el esquema real en Supabase
--  (Table Editor / Database > Schema) y ajústalo.
--
--  Orden recomendado de ejecución: este archivo completo en el SQL Editor
--  de Supabase.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  profiles: datos de cada persona vinculada al acueducto.
--  La fila se crea desde el backend justo después del signUp de Supabase Auth.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                             uuid primary key references auth.users (id) on delete cascade,
  nombre                         text not null,
  apellido                       text not null,
  correo                         text unique not null,
  rol                            text not null default 'usuario'
                                   check (rol in ('administrador', 'usuario', 'fontanero')),
  activo                         boolean not null default true,
  is_verified                    boolean not null default false,
  debe_cambiar_password         boolean not null default false,

  -- verificación de cuenta / recuperación de contraseña (códigos de un solo uso)
  codigo_verificacion            text,
  codigo_verificacion_expiracion timestamptz,
  codigo_recuperacion            text,
  codigo_expiracion              timestamptz,

  -- datos editables por el propio usuario
  telefono                       text,
  numero_lote                    text,
  direccion                      text,
  ocupacion                      text,
  zona                           text,

  created_at                     timestamptz not null default now(),
  -- se actualiza cada vez que el propio usuario edita sus datos; sirve para
  -- limitar la edición del perfil a una vez cada 30 días.
  updated_at                     timestamptz
);

-- Solo puede existir una cuenta con acceso global a las averías.
create unique index if not exists idx_profiles_un_solo_fontanero
  on public.profiles (rol)
  where rol = 'fontanero';

-- ----------------------------------------------------------------------------
--  rates: tarifas del servicio. La "vigente" es la más reciente cuyo rango
--  de fechas contiene la fecha de hoy.
-- ----------------------------------------------------------------------------
create table if not exists public.rates (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null default 'residencial',
  cuota_fija    numeric(12,2) not null check (cuota_fija >= 0),
  vigente_desde date not null,
  vigente_hasta date,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
--  invoices: facturas emitidas a cada usuario.
-- ----------------------------------------------------------------------------
create sequence if not exists public.facturas_numero_seq;

create table if not exists public.invoices (
  id                uuid primary key default gen_random_uuid(),
  numero_factura    bigint not null default nextval('public.facturas_numero_seq'),
  -- restrict: las facturas son contabilidad; un usuario con historial se desactiva.
  perfil_id         uuid not null references public.profiles (id) on delete restrict,
  periodo           text not null,                 -- ej. '2026-09'
  tipo              text not null default 'servicio'
                    check (tipo in ('servicio', 'prepago', 'extraordinaria')),
  valor_total       numeric(12,2) not null check (valor_total > 0),
  estado            text not null default 'pendiente'
                     check (estado in ('pendiente', 'pagada', 'anulada', 'vencida')),
  fecha_emision     timestamptz not null default now(),
  fecha_vencimiento date,
  periodo_inicio    text,
  periodo_fin       text,
  meses_cubiertos   integer,
  detalle_prepago   text,
  fecha_ultimo_pago timestamptz,
  fecha_proxima_facturacion date,
  observacion       text,
  generada_automaticamente boolean not null default false,
  correo_factura_enviado_at timestamptz
);
create index if not exists idx_invoices_perfil on public.invoices (perfil_id);
create index if not exists idx_invoices_estado on public.invoices (estado);

create table if not exists public.invoice_service_periods (
  perfil_id uuid not null references public.profiles (id) on delete cascade,
  periodo text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (perfil_id, periodo)
);

-- ----------------------------------------------------------------------------
--  payments: pagos registrados contra una factura.
--  confirmado = false hasta que lo confirma un admin o el webhook de Wompi.
-- ----------------------------------------------------------------------------
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  factura_id          uuid not null references public.invoices (id) on delete restrict,
  perfil_id           uuid not null references public.profiles (id) on delete restrict,
  monto               numeric(12,2) not null check (monto > 0),
  cargo_wompi         numeric(12,2) not null default 0 check (cargo_wompi >= 0),
  monto_total         numeric(12,2) not null,
  metodo              text not null,               -- 'efectivo' | 'nequi' | 'pse' | 'tarjeta' ...
  referencia          text,
  confirmado          boolean not null default false,
  fecha_pago          timestamptz not null default now(),
  fecha_confirmacion  timestamptz,
  metodo_confirmacion text,                        -- 'manual' | 'wompi'
  estado_wompi        text,                        -- APPROVED | DECLINED | VOIDED | ERROR
  transaccion_id      text,
  medio_pago_wompi    text,
  correo_comprobante_enviado_at timestamptz,
  registrado_por      uuid references public.profiles (id) on delete set null
);
create index if not exists idx_payments_perfil on public.payments (perfil_id);
create index if not exists idx_payments_factura on public.payments (factura_id);

-- ----------------------------------------------------------------------------
--  breakdowns: averías reportadas por los usuarios.
--  `zona` = ubicación del beneficiario que reporta (no zona de asignación).
-- ----------------------------------------------------------------------------
create table if not exists public.breakdowns (
  id               uuid primary key default gen_random_uuid(),
  perfil_id        uuid not null references public.profiles (id) on delete cascade,
  fontanero_id     uuid references public.profiles (id) on delete set null,
  descripcion      text not null,
  zona             text,
  direccion        text,
  estado           text not null default 'reportada'
                    check (estado in ('reportada', 'en_proceso', 'resuelta', 'cancelada')),
  nota_fontanero   text,
  fecha_reporte    timestamptz not null default now(),
  fecha_resolucion timestamptz
);
create index if not exists idx_breakdowns_perfil on public.breakdowns (perfil_id);
create index if not exists idx_breakdowns_estado on public.breakdowns (estado);

-- ----------------------------------------------------------------------------
--  notifications: avisos para cada usuario.
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  id        uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.profiles (id) on delete cascade,
  mensaje   text not null,
  tipo      text not null default 'general',
  estado    text not null default 'no_leido' check (estado in ('leido', 'no_leido')),
  fecha     timestamptz not null default now()
);
create index if not exists idx_notifications_perfil on public.notifications (perfil_id);

-- Registro de acciones administrativas sensibles. Solo el backend service role
-- puede insertar; el panel no consulta esta tabla directamente.
create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references public.profiles (id) on delete set null,
  accion      text not null,
  tabla       text not null,
  registro_id uuid,
  detalle     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_admin_audit_log_created_at
  on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security;
revoke all on table public.admin_audit_log from public, anon, authenticated;
grant insert on table public.admin_audit_log to service_role;

-- ----------------------------------------------------------------------------
--  service_outages: cortes de servicio.
-- ----------------------------------------------------------------------------
create table if not exists public.service_outages (
  id               uuid primary key default gen_random_uuid(),
  perfil_id        uuid not null references public.profiles (id) on delete cascade,
  factura_id       uuid references public.invoices (id) on delete set null,
  cortado_por      uuid references public.profiles (id) on delete set null,
  reconectado_por  uuid references public.profiles (id) on delete set null,
  origen           text not null default 'manual',
  motivo           text not null,
  estado           text not null default 'activo' check (estado in ('activo', 'reconectado', 'resuelto')),
  fecha_corte      timestamptz not null default now(),
  fecha_reconexion timestamptz
);
create index if not exists idx_outages_perfil on public.service_outages (perfil_id);

-- Un mismo usuario no puede tener dos cortes "activo" a la vez. Sin este
-- índice, dos solicitudes POST /api/cortes concurrentes para el mismo
-- perfil_id pueden pasar ambas la verificación de "no duplicar" en la
-- aplicación (TOCTOU) e insertar dos cortes activos.
create unique index if not exists idx_outages_perfil_activo_unico
  on public.service_outages (perfil_id)
  where estado = 'activo';

-- ============================================================================
--  ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
--  El backend usa dos clientes:
--   - Cliente de usuario (con el JWT): sujeto a estas políticas. Solo toca
--     sus propios datos.
--   - Cliente admin (Service Role Key): ignora RLS. Se usa en las rutas ya
--     protegidas por verificarToken + verificarRol('administrador') y para
--     el fontanero.
--
--  Por eso las políticas de abajo cubren únicamente lo que hace el usuario
--  final sobre sus propias filas.
-- ============================================================================

alter table public.profiles        enable row level security;
alter table public.rates           enable row level security;
alter table public.invoices        enable row level security;
alter table public.payments        enable row level security;
alter table public.breakdowns      enable row level security;
alter table public.notifications   enable row level security;
alter table public.service_outages enable row level security;
alter table public.invoice_service_periods enable row level security;
revoke all on public.invoice_service_periods from public, anon, authenticated;
grant all on public.invoice_service_periods to service_role;

-- Nota: Postgres no soporta "create policy if not exists". Cada política
-- lleva delante un "drop policy if exists" para poder re-ejecutar el archivo.

-- profiles ------------------------------------------------------------------
drop policy if exists "perfil: ver el propio" on public.profiles;
create policy "perfil: ver el propio"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "perfil: actualizar el propio" on public.profiles;
create policy "perfil: actualizar el propio"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- rates -------------------------------------------------------------------
drop policy if exists "tarifas: lectura para autenticados" on public.rates;
create policy "tarifas: lectura para autenticados"
  on public.rates for select
  to authenticated
  using (true);

-- invoices ----------------------------------------------------------------
drop policy if exists "facturas: ver las propias" on public.invoices;
create policy "facturas: ver las propias"
  on public.invoices for select
  using (perfil_id = auth.uid());

-- payments --------------------------------------------------------------
drop policy if exists "pagos: ver los propios" on public.payments;
create policy "pagos: ver los propios"
  on public.payments for select
  using (perfil_id = auth.uid());

drop policy if exists "pagos: registrar los propios (sin confirmar)" on public.payments;

-- breakdowns ----------------------------------------------------------
drop policy if exists "averias: ver las propias" on public.breakdowns;
create policy "averias: ver las propias"
  on public.breakdowns for select
  using (perfil_id = auth.uid());

drop policy if exists "averias: reportar las propias" on public.breakdowns;

-- notifications -----------------------------------------------------
drop policy if exists "notificaciones: ver las propias" on public.notifications;
create policy "notificaciones: ver las propias"
  on public.notifications for select
  using (perfil_id = auth.uid());

drop policy if exists "notificaciones: marcar leídas las propias" on public.notifications;
create policy "notificaciones: marcar leídas las propias"
  on public.notifications for update
  using (perfil_id = auth.uid())
  with check (perfil_id = auth.uid());

-- service_outages -------------------------------------------------
drop policy if exists "cortes: ver los propios" on public.service_outages;
create policy "cortes: ver los propios"
  on public.service_outages for select
  using (perfil_id = auth.uid());

-- ============================================================================
--  ALTERS - si las tablas YA existen en tu proyecto Supabase, ejecuta solo
--  esta sección para añadir las columnas nuevas que usa el backend.
--  (Son idempotentes: "if not exists".)
-- ============================================================================
alter table public.invoices        add column if not exists periodo           text;
alter table public.invoices        add column if not exists numero_factura    bigint;
alter table public.invoices        add column if not exists tipo              text not null default 'servicio';
alter table public.invoices        add column if not exists fecha_vencimiento date;
alter table public.invoices        add column if not exists periodo_inicio    text;
alter table public.invoices        add column if not exists periodo_fin       text;
alter table public.invoices        add column if not exists meses_cubiertos   integer;
alter table public.invoices        add column if not exists detalle_prepago   text;
alter table public.invoices        add column if not exists fecha_ultimo_pago timestamptz;
alter table public.invoices        add column if not exists fecha_proxima_facturacion date;
alter table public.invoices        add column if not exists observacion       text;
alter table public.invoices        add column if not exists generada_automaticamente boolean not null default false;
alter table public.invoices        add column if not exists correo_factura_enviado_at timestamptz;

alter table public.invoices drop constraint if exists invoices_tipo_check;
alter table public.invoices add constraint invoices_tipo_check
  check (tipo in ('servicio', 'prepago', 'extraordinaria'));
update public.invoices
set periodo_inicio = periodo, periodo_fin = periodo, meses_cubiertos = 1
where tipo = 'servicio'
  and (periodo_inicio is null or periodo_fin is null or meses_cubiertos is null);

alter table public.payments        add column if not exists fecha_pago          timestamptz default now();
alter table public.payments        add column if not exists cargo_wompi        numeric(12,2) not null default 0 check (cargo_wompi >= 0);
alter table public.payments        add column if not exists monto_total        numeric(12,2);
update public.payments set monto_total = monto + cargo_wompi where monto_total is null;
alter table public.payments        alter column monto_total set not null;
alter table public.payments        add column if not exists fecha_confirmacion  timestamptz;
alter table public.payments        add column if not exists metodo_confirmacion text;
alter table public.payments        add column if not exists estado_wompi        text;
alter table public.payments        add column if not exists transaccion_id      text;
alter table public.payments        add column if not exists medio_pago_wompi   text;
alter table public.payments        add column if not exists correo_comprobante_enviado_at timestamptz;
alter table public.payments        add column if not exists registrado_por uuid references public.profiles (id) on delete set null;

alter table public.breakdowns      add column if not exists nota_fontanero    text;
alter table public.breakdowns      add column if not exists fontanero_id      uuid references public.profiles (id) on delete set null;
alter table public.breakdowns      add column if not exists direccion         text;
alter table public.breakdowns      add column if not exists fecha_resolucion timestamptz;

alter table public.service_outages add column if not exists factura_id        uuid references public.invoices (id) on delete set null;
alter table public.service_outages add column if not exists fecha_reconexion  timestamptz;
alter table public.service_outages add column if not exists cortado_por uuid references public.profiles (id) on delete set null;
alter table public.service_outages add column if not exists reconectado_por uuid references public.profiles (id) on delete set null;
alter table public.service_outages add column if not exists origen text not null default 'manual';

alter table public.profiles        add column if not exists activo            boolean not null default true;
alter table public.profiles        add column if not exists debe_cambiar_password boolean not null default false;
alter table public.profiles        add column if not exists updated_at         timestamptz;

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

-- La migraciÃ³n se ejecuta despuÃ©s de aÃ±adir columnas que puedan faltar en
-- instalaciones existentes, especialmente fontanero_id.
with averias_en_orden as (
  select id, row_number() over (order by fecha_reporte asc, id asc) as numero
  from public.breakdowns
  where estado = 'en_proceso'
)
update public.breakdowns as b
set estado = 'reportada', fontanero_id = null
from averias_en_orden as orden
where b.id = orden.id and orden.numero > 1;

create unique index if not exists idx_breakdowns_un_solo_en_proceso
  on public.breakdowns (estado)
  where estado = 'en_proceso';

-- Evita emitir dos facturas ordinarias activas del mismo periodo para un
-- usuario. Las anuladas no cuentan: así se puede volver a emitir ese mes.
-- Las extraordinarias pueden compartir periodo con una factura de servicio.
drop index if exists public.idx_invoices_servicio_perfil_periodo;
create unique index idx_invoices_servicio_perfil_periodo
  on public.invoices (perfil_id, periodo)
  where tipo = 'servicio' and estado <> 'anulada';

-- Los perfiles solo permiten que la app cambie campos de contacto propios.
-- RLS limita las filas, pero se requieren privilegios de columna para proteger
-- los códigos de recuperación y campos administrativos.
revoke select on table public.profiles from public, anon, authenticated;
grant select (
  id, nombre, apellido, correo, rol, activo, is_verified,
  debe_cambiar_password, telefono, numero_lote, direccion, ocupacion, zona,
  created_at, updated_at
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

-- Las escrituras con validación de negocio pasan por el backend autenticado.
revoke insert on table public.payments from public, anon, authenticated;
revoke insert on table public.breakdowns from public, anon, authenticated;
revoke update on table public.notifications from public, anon, authenticated;
grant update (estado) on table public.notifications to authenticated;

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

create unique index if not exists idx_payments_un_pendiente_por_factura
  on public.payments (factura_id)
  where confirmado = false
    and (estado_wompi is null or estado_wompi in (
      'PENDING',
      'APPROVED_NO_APLICADO',
      'MONTO_INVALIDO'
    ));

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

drop trigger if exists trg_procesar_pago_confirmado on public.payments;
create trigger trg_procesar_pago_confirmado
after update of confirmado on public.payments
for each row execute function public.procesar_pago_confirmado();

-- ----------------------------------------------------------------------------
--  Planes de pago (1, 6 o 12 mensualidades). Igual a
--  migrations/20261026_pago_prepago_servicio.sql.
-- ----------------------------------------------------------------------------
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


-- ----------------------------------------------------------------------------
--  Audios de averías (ver migración 20261029_audios_averias.sql).
-- ----------------------------------------------------------------------------
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

-- ============================================================================
--  Igual a migrations/20261030_mejoras_integrales.sql
-- ============================================================================
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
