-- Run in a dedicated Supabase Free project. No real email addresses or secrets belong here.
begin;
create table if not exists public.pd_members (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  admin boolean not null default false
);
create table if not exists public.pd_items (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  created timestamptz not null default now()
);
create table if not exists public.pd_images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.pd_items(id) on delete cascade,
  mime text not null check (mime in ('image/jpeg','image/png','image/webp')),
  slot smallint not null check (slot between 0 and 11),
  unique(item_id,slot)
);
create index if not exists pd_images_item_idx on public.pd_images(item_id);
create table if not exists public.pd_boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items)='array')
);
-- Only the server can access these tables. Authenticated browser keys have no access.
alter table public.pd_members enable row level security;
alter table public.pd_items enable row level security;
alter table public.pd_images enable row level security;
alter table public.pd_boards enable row level security;
revoke all on public.pd_members,public.pd_items,public.pd_images,public.pd_boards from anon,authenticated;
grant all on public.pd_members,public.pd_items,public.pd_images,public.pd_boards to service_role;
-- Fail safely if an existing bucket with this name is public.
do $$ begin
  if exists(select 1 from storage.buckets where id='productiondeck-photos' and public) then
    raise exception 'productiondeck-photos must be private';
  end if;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('productiondeck-photos','productiondeck-photos',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
commit;
