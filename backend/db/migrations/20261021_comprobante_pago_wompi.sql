-- Conserva el medio de pago informado por Wompi y evita reenviar el
-- comprobante por los reintentos del webhook una vez enviado con éxito.
alter table public.payments
  add column if not exists medio_pago_wompi text,
  add column if not exists correo_comprobante_enviado_at timestamptz;
