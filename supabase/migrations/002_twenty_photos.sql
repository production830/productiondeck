-- Expand photo slots from 0..11 to 0..19 (20 total). Existing photos stay in place.
-- Run once in Supabase SQL Editor with Database selected. Safe to rerun.
begin;
alter table public.pd_images
  drop constraint if exists pd_images_slot_check;
alter table public.pd_images
  add constraint pd_images_slot_check check (slot between 0 and 19);
commit;
