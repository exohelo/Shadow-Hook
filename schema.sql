-- The table the app reads (sbLoadDispatch → dispatch_boards) and the worker writes.
-- Run once in the Supabase SQL editor.

create table if not exists public.dispatch_boards (
  key        text primary key,                    -- e.g. '2026-07-20_Mon_PM' / '2026-07-21_Tue_AM'
  data       jsonb not null default '{}'::jsonb,   -- the forecast JSON (total, boards, flops, ships, early, generated, src)
  updated_at timestamptz not null default now()
);

-- keep updated_at fresh on every upsert
create or replace function public.touch_dispatch_boards()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_touch_dispatch_boards on public.dispatch_boards;
create trigger trg_touch_dispatch_boards
  before update on public.dispatch_boards
  for each row execute function public.touch_dispatch_boards();

-- RLS: the app (anon key) may READ everything; nobody may write with the anon key.
-- The worker uses the SERVICE-ROLE key, which BYPASSES RLS, so it can upsert.
alter table public.dispatch_boards enable row level security;

drop policy if exists dispatch_boards_read on public.dispatch_boards;
create policy dispatch_boards_read
  on public.dispatch_boards for select
  using (true);
-- (intentionally no insert/update/delete policy → anon cannot write)
