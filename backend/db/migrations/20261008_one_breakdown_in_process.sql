-- Ensure the assignment column exists on older installations.
alter table public.breakdowns
  add column if not exists fontanero_id uuid references public.profiles (id);

-- Keep the oldest active report in progress; return extra active reports to waiting.
with averias_en_orden as (
  select id, row_number() over (order by fecha_reporte asc, id asc) as numero
  from public.breakdowns
  where estado = 'en_proceso'
)
update public.breakdowns as b
set estado = 'reportada', fontanero_id = null
from averias_en_orden as orden
where b.id = orden.id and orden.numero > 1;

-- Enforce one active breakdown at a time for the plumber.
create unique index if not exists idx_breakdowns_un_solo_en_proceso
  on public.breakdowns (estado)
  where estado = 'en_proceso';
