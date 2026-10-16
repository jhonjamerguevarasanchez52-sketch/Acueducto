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
  perfil_id         uuid not null references public.profiles (id) on delete cascade,
  periodo           text not null,                 -- ej. '2026-09'
  tipo              text not null default 'servicio'
                    check (tipo in ('servicio', 'extraordinaria')),
  valor_total       numeric(12,2) not null check (valor_total > 0),
  estado            text not null default 'pendiente'
                     check (estado in ('pendiente', 'pagada', 'anulada', 'vencida')),
  fecha_emision     timestamptz not null default now(),
  fecha_vencimiento date,
  observacion       text,
  generada_automaticamente boolean not null default false,
  correo_factura_enviado_at timestamptz
);
create index if not exists idx_invoices_perfil on public.invoices (perfil_id);
create index if not exists idx_invoices_estado on public.invoices (estado);

-- ----------------------------------------------------------------------------
--  payments: pagos registrados contra una factura.
--  confirmado = false hasta que lo confirma un admin o el webhook de Wompi.
-- ----------------------------------------------------------------------------
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  factura_id          uuid not null references public.invoices (id) on delete cascade,
  perfil_id           uuid not null references public.profiles (id) on delete cascade,
  monto               numeric(12,2) not null check (monto > 0),
  metodo              text not null,               -- 'efectivo' | 'nequi' | 'pse' | 'tarjeta' ...
  referencia          text,
  confirmado          boolean not null default false,
  fecha_pago          timestamptz not null default now(),
  fecha_confirmacion  timestamptz,
  metodo_confirmacion text,                        -- 'manual' | 'wompi'
  estado_wompi        text,                        -- APPROVED | DECLINED | VOIDED | ERROR
  transaccion_id      text
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

-- ----------------------------------------------------------------------------
--  service_outages: cortes de servicio.
-- ----------------------------------------------------------------------------
create table if not exists public.service_outages (
  id               uuid primary key default gen_random_uuid(),
  perfil_id        uuid not null references public.profiles (id) on delete cascade,
  factura_id       uuid references public.invoices (id) on delete set null,
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
create policy "pagos: registrar los propios (sin confirmar)"
  on public.payments for insert
  with check (perfil_id = auth.uid() and confirmado = false);

-- breakdowns ----------------------------------------------------------
drop policy if exists "averias: ver las propias" on public.breakdowns;
create policy "averias: ver las propias"
  on public.breakdowns for select
  using (perfil_id = auth.uid());

drop policy if exists "averias: reportar las propias" on public.breakdowns;
create policy "averias: reportar las propias"
  on public.breakdowns for insert
  with check (perfil_id = auth.uid());

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
alter table public.invoices        add column if not exists observacion       text;
alter table public.invoices        add column if not exists generada_automaticamente boolean not null default false;
alter table public.invoices        add column if not exists correo_factura_enviado_at timestamptz;

alter table public.payments        add column if not exists fecha_pago          timestamptz default now();
alter table public.payments        add column if not exists fecha_confirmacion  timestamptz;
alter table public.payments        add column if not exists metodo_confirmacion text;
alter table public.payments        add column if not exists estado_wompi        text;
alter table public.payments        add column if not exists transaccion_id      text;

alter table public.breakdowns      add column if not exists nota_fontanero    text;
alter table public.breakdowns      add column if not exists fontanero_id      uuid references public.profiles (id) on delete set null;
alter table public.breakdowns      add column if not exists direccion         text;
alter table public.breakdowns      add column if not exists fecha_resolucion timestamptz;

alter table public.service_outages add column if not exists factura_id        uuid references public.invoices (id) on delete set null;
alter table public.service_outages add column if not exists fecha_reconexion  timestamptz;

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

-- Evita emitir dos facturas ordinarias del mismo periodo para un usuario.
-- Las extraordinarias pueden compartir periodo con una factura de servicio.
create unique index if not exists idx_invoices_servicio_perfil_periodo
  on public.invoices (perfil_id, periodo)
  where tipo = 'servicio';
