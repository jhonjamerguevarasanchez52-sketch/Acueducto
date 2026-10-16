-- Preserve breakdown history while allowing deletion of a plumber profile.
-- Remove the existing FK first so this migration also repairs older installs
-- where fontanero_id was created without an ON DELETE action.
alter table public.breakdowns
  drop constraint if exists breakdowns_fontanero_id_fkey;

alter table public.breakdowns
  add constraint breakdowns_fontanero_id_fkey
  foreign key (fontanero_id)
  references public.profiles (id)
  on delete set null;
