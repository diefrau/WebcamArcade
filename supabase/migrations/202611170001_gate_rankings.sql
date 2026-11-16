begin;
alter table public.arcade_runs drop constraint arcade_runs_game_check;
alter table public.arcade_runs add constraint arcade_runs_game_check check (game in ('shoot','circle','cham','rps','dodge','gate'));
alter table public.arcade_runs drop constraint arcade_runs_game_score_check;
alter table public.arcade_runs add constraint arcade_runs_game_score_check check (game_mode in ('endless','vertical-endless') or game='shoot' or score <= case when game='gate' then 1500 when game='rps' then 500 when game='dodge' and game_mode in ('survival','vertical-survival') then 10000 when game='dodge' then 3000 else 1000 end);
create or replace function public.arcade_board_mode_v2(p_game text, p_mode text)
returns table(place bigint,nickname text,score integer,max_count bigint)
language sql stable security definer set search_path = '' as $$
 with ceiling as (
  select case when p_game='gate' and p_mode='standard' then 1500 when p_game='circle' and p_mode='standard' then 1000
   when p_game='cham' and p_mode in ('standard','hard','seeker') then 1000
   when p_game='rps' and p_mode='standard' then 500
   when p_game='shoot' and p_mode='wave' then 2500 else null end as points
 ), best as (
  select distinct on(r.user_id) r.user_id,r.score,r.created_at,r.id
  from public.arcade_runs r where r.game=p_game and r.game_mode=p_mode
  order by r.user_id,r.score desc,r.created_at,r.id
 ), counts as (
  select r.user_id,count(*) filter(where r.score=c.points) as max_count
  from public.arcade_runs r cross join ceiling c
  where r.game=p_game and r.game_mode=p_mode group by r.user_id
 )
 select row_number() over(order by b.score desc,c.max_count desc,b.created_at,b.id),
 coalesce(nullif(p.nickname,''),p.anonymous_name),b.score,c.max_count
 from best b join counts c using(user_id) join public.arcade_profiles p on p.user_id=b.user_id
 order by b.score desc,c.max_count desc,b.created_at,b.id limit 50;
$$;
notify pgrst, 'reload schema';
commit;
