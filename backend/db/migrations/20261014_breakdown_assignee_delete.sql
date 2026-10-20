-- Preserve breakdown history while allowing deletion of a plumber profile.
-- Find the FK by its columns instead of relying on the default constraint
-- name, which may differ between existing installations.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select constraint_row.conname
    from pg_constraint as constraint_row
    join pg_class as table_row on table_row.oid = constraint_row.conrelid
    join pg_namespace as schema_row on schema_row.oid = table_row.relnamespace
    join pg_attribute as column_row
      on column_row.attrelid = table_row.oid
      and column_row.attname = 'fontanero_id'
      and not column_row.attisdropped
    where constraint_row.contype = 'f'
      and constraint_row.confrelid = 'public.profiles'::regclass
      and constraint_row.conkey = array[column_row.attnum]::smallint[]
      and schema_row.nspname = 'public'
      and table_row.relname = 'breakdowns'
  loop
    execute format('alter table public.breakdowns drop constraint %I', constraint_name);
  end loop;
end;
$$;

alter table public.breakdowns
  add constraint breakdowns_fontanero_id_fkey
  foreign key (fontanero_id)
  references public.profiles (id)
  on delete set null;
