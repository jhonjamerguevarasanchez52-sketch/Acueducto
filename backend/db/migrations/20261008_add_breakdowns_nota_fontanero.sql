-- Añade la nota del fontanero a averías ya existentes.
-- Ejecutar en Supabase SQL Editor sobre el proyecto conectado por backend/.env.
alter table public.breakdowns
  add column if not exists nota_fontanero text;
