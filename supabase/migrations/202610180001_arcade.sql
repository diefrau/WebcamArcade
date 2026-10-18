-- Supabase PostgreSQL. Run once in SQL Editor, or with `supabase db push`.
create table public.arcade_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '' check (char_length(nickname) <= 16 and nickname !~ '[[:cntrl:]]'),
  created_at timestamptz not null default now()
);
create table public.arcade_runs (
  id uuid primary key,
  user_id uuid not null references public.arcade_profiles(user_id) on delete cascade,
  game text not null check (game in ('shoot','circle','cham','rps','dodge')),
  score integer not null check (score >= 0 and score <= 200000),
  accuracy integer not null default 0 check (accuracy between 0 and 100),
  seconds numeric(4,1) not null default 0 check (seconds between 0 and 30),
  created_at timestamptz not null default now(),
  check (game = 'shoot' or score <= case game when 'rps' then 500 when 'dodge' then 3000 else 1000 end)
);
create index arcade_runs_board on public.arcade_runs(game, score desc, created_at);
create index arcade_runs_owner on public.arcade_runs(user_id, created_at);
alter table public.arcade_profiles enable row level security;
alter table public.arcade_runs enable row level security;
-- No direct client writes: all mutations go through bounded RPC functions.
revoke all on public.arcade_profiles, public.arcade_runs from anon, authenticated;
grant select on public.arcade_profiles, public.arcade_runs to authenticated;
create policy own_profile on public.arcade_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy own_runs on public.arcade_runs for select to authenticated using ((select auth.uid()) = user_id);

create function public.arcade_join(p_nickname text default '') returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.arcade_profiles(user_id,nickname) values(auth.uid(), btrim(coalesce(p_nickname,'')))
  on conflict(user_id) do update set nickname = excluded.nickname;
end; $$;

create function public.arcade_submit(p_id uuid,p_game text,p_score integer,p_accuracy integer default 0,p_seconds numeric default 0) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.arcade_profiles where user_id = auth.uid()) then raise exception 'Join first'; end if;
  -- Serialize submissions per identity; retries with an existing UUID are free.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(auth.uid()::text));
  if exists(select 1 from public.arcade_runs where id = p_id and user_id = auth.uid()) then return; end if;
  if (select count(*) from public.arcade_runs where user_id = auth.uid() and created_at > now() - interval '1 minute') >= 20 then raise exception 'Please retry later'; end if;
  insert into public.arcade_runs(id,user_id,game,score,accuracy,seconds)
  values(p_id,auth.uid(),p_game,p_score,p_accuracy,p_seconds);
end; $$;

-- Public output contains only rank, display name and best score; no auth IDs.
create function public.arcade_board(p_game text) returns table(place bigint,nickname text,score integer)
language sql stable security definer set search_path = '' as $$
  with best as (
    select distinct on (r.user_id) r.user_id,r.score,r.created_at,r.id
    from public.arcade_runs r where r.game = p_game
    order by r.user_id,r.score desc,r.created_at,r.id
  )
  select row_number() over(order by b.score desc,b.created_at,b.id),
    coalesce(nullif(p.nickname,''),'익명'), b.score
  from best b join public.arcade_profiles p on p.user_id = b.user_id
  order by b.score desc,b.created_at,b.id limit 50;
$$;

create function public.arcade_progress() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'first',count(*) >= 1, 'five',count(*) >= 5, 'variety',count(distinct game) >= 3,
    'sharp',coalesce(bool_or(game = 'shoot' and accuracy >= 90 and score > 0),false),
    'artist',coalesce(bool_or(game = 'circle' and score >= 800),false),
    'reflex',coalesce(bool_or(game = 'cham' and score >= 700),false),
    'rps',coalesce(bool_or(game = 'rps' and score >= 300),false),
    'survivor',coalesce(bool_or(game = 'dodge' and seconds >= 30),false)
  ) from public.arcade_runs where user_id = auth.uid();
$$;
revoke execute on function public.arcade_join(text), public.arcade_submit(uuid,text,integer,integer,numeric), public.arcade_board(text), public.arcade_progress() from public,anon,authenticated;
grant execute on function public.arcade_join(text), public.arcade_submit(uuid,text,integer,integer,numeric), public.arcade_progress() to authenticated;
grant execute on function public.arcade_board(text) to anon,authenticated;
