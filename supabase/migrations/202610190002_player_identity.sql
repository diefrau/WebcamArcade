-- Each anonymous player receives a stable, unique public display name.
create sequence public.arcade_anonymous_number start with 1000;
revoke all on sequence public.arcade_anonymous_number from public, anon, authenticated;
alter table public.arcade_profiles
  add column anonymous_name text not null default ('익명' || nextval('public.arcade_anonymous_number')) unique;

create or replace function public.arcade_board(p_game text) returns table(place bigint,nickname text,score integer)
language sql stable security definer set search_path = '' as $$
  with best as (
    select distinct on (r.user_id) r.user_id,r.score,r.created_at,r.id
    from public.arcade_runs r where r.game = p_game
    order by r.user_id,r.score desc,r.created_at,r.id
  )
  select row_number() over(order by b.score desc,b.created_at,b.id),
    coalesce(nullif(p.nickname,''),p.anonymous_name), b.score
  from best b join public.arcade_profiles p on p.user_id = b.user_id
  order by b.score desc,b.created_at,b.id limit 50;
$$;
