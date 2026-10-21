-- Align profile foreign keys with the admin's permanent user deletion flow.
-- User-owned records are deleted with the profile; historical actor references
-- are anonymized so payments, outages, and audit records remain intact.

alter table public.breakdowns
  drop constraint if exists averias_perfil_id_fkey;
alter table public.breakdowns
  add constraint averias_perfil_id_fkey
  foreign key (perfil_id) references public.profiles (id) on delete cascade;

alter table public.invoices
  drop constraint if exists facturas_perfil_id_fkey;
alter table public.invoices
  add constraint facturas_perfil_id_fkey
  foreign key (perfil_id) references public.profiles (id) on delete cascade;

alter table public.notifications
  drop constraint if exists notificaciones_perfil_id_fkey;
alter table public.notifications
  add constraint notificaciones_perfil_id_fkey
  foreign key (perfil_id) references public.profiles (id) on delete cascade;

alter table public.payment_alerts
  drop constraint if exists alertas_pago_perfil_id_fkey;
alter table public.payment_alerts
  add constraint alertas_pago_perfil_id_fkey
  foreign key (perfil_id) references public.profiles (id) on delete cascade;

alter table public.payments
  drop constraint if exists pagos_perfil_id_fkey;
alter table public.payments
  add constraint pagos_perfil_id_fkey
  foreign key (perfil_id) references public.profiles (id) on delete cascade;

alter table public.payments
  drop constraint if exists payments_registrado_por_fkey,
  drop constraint if exists payments_confirmado_por_fkey,
  drop constraint if exists payments_rechazado_por_fkey,
  drop constraint if exists payments_anulado_por_fkey;
alter table public.payments
  add constraint payments_registrado_por_fkey
    foreign key (registrado_por) references public.profiles (id) on delete set null,
  add constraint payments_confirmado_por_fkey
    foreign key (confirmado_por) references public.profiles (id) on delete set null,
  add constraint payments_rechazado_por_fkey
    foreign key (rechazado_por) references public.profiles (id) on delete set null,
  add constraint payments_anulado_por_fkey
    foreign key (anulado_por) references public.profiles (id) on delete set null;

alter table public.service_outages
  drop constraint if exists cortes_servicio_perfil_id_fkey,
  drop constraint if exists service_outages_cortado_por_fkey,
  drop constraint if exists service_outages_reconectado_por_fkey;
alter table public.service_outages
  add constraint cortes_servicio_perfil_id_fkey
    foreign key (perfil_id) references public.profiles (id) on delete cascade,
  add constraint service_outages_cortado_por_fkey
    foreign key (cortado_por) references public.profiles (id) on delete set null,
  add constraint service_outages_reconectado_por_fkey
    foreign key (reconectado_por) references public.profiles (id) on delete set null;

alter table public.admin_audit_log
  drop constraint if exists admin_audit_log_admin_id_fkey;
alter table public.admin_audit_log
  add constraint admin_audit_log_admin_id_fkey
  foreign key (admin_id) references public.profiles (id) on delete set null;
