begin;
-- Existing runs predate mode selection and belong to standard mode.
alter table public.arcade_runs add column if not exists game_mode text not null default 'standard';
alter table public.arcade_runs drop constraint if exists arcade_runs_seconds_check;
alter table public.arcade_runs add constraint arcade_runs_seconds_check check (seconds >= 0 and seconds <= case when game = 'dodge' and game_mode in ('survival','vertical-survival') then 60 else 30 end);
alter table public.arcade_runs drop constraint if exists arcade_runs_check;
alter table public.arcade_runs add constraint arcade_runs_game_score_check check (game = 'shoot' or score <= case when game = 'rps' then 500 when game = 'dodge' and game_mode in ('survival','vertical-survival') then 10000 when game = 'dodge' then 3000 else 1000 end);
alter table public.arcade_runs add constraint arcade_runs_game_mode_check check (
  game_mode = 'standard' or (game = 'shoot' and game_mode = 'wave') or
  (game = 'cham' and game_mode = 'hard') or
  (game = 'dodge' and game_mode in ('survival', 'vertical', 'vertical-survival'))
);
create index arcade_runs_mode_board on public.arcade_runs(game, game_mode, score desc, created_at);

create function public.arcade_submit_mode(p_id uuid, p_game text, p_score integer, p_accuracy integer, p_seconds numeric, p_mode text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.arcade_profiles where user_id = auth.uid()) then raise exception 'Join first'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(auth.uid()::text));
  if exists(select 1 from public.arcade_runs where id = p_id and user_id = auth.uid()) then return; end if;
  if (select count(*) from public.arcade_runs where user_id = auth.uid() and created_at > now() - interval '1 minute') >= 20 then raise exception 'Please retry later'; end if;
  insert into public.arcade_runs(id,user_id,game,game_mode,score,accuracy,seconds)
  values(p_id,auth.uid(),p_game,p_mode,p_score,p_accuracy,p_seconds);
end; $$;

create function public.arcade_board_mode(p_game text, p_mode text) returns table(place bigint,nickname text,score integer)
language sql stable security definer set search_path = '' as $$
  with best as (
    select distinct on (r.user_id) r.user_id,r.score,r.created_at,r.id
    from public.arcade_runs r where r.game = p_game and r.game_mode = p_mode
    order by r.user_id,r.score desc,r.created_at,r.id
  )
  select row_number() over(order by b.score desc,b.created_at,b.id),
    coalesce(nullif(p.nickname,''),p.anonymous_name), b.score
  from best b join public.arcade_profiles p on p.user_id = b.user_id
  order by b.score desc,b.created_at,b.id limit 50;
$$;
-- Older clients continue to see the standard leaderboard only.
create or replace function public.arcade_board(p_game text) returns table(place bigint,nickname text,score integer)
language sql stable security definer set search_path = '' as $$
  select * from public.arcade_board_mode(p_game, 'standard');
$$;
revoke execute on function public.arcade_submit_mode(uuid,text,integer,integer,numeric,text), public.arcade_board_mode(text,text) from public,anon,authenticated;
grant execute on function public.arcade_submit_mode(uuid,text,integer,integer,numeric,text) to authenticated;
grant execute on function public.arcade_board_mode(text,text) to anon,authenticated;

notify pgrst, 'reload schema';
commit;
