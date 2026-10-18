-- Add counts without changing the existing achievement flags or RPC permissions.
create or replace function public.arcade_progress() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'first',count(*) >= 1, 'five',count(*) >= 5, 'variety',count(distinct game) >= 3,
    'sharp',coalesce(bool_or(game = 'shoot' and accuracy >= 90 and score > 0),false),
    'artist',coalesce(bool_or(game = 'circle' and score >= 800),false),
    'reflex',coalesce(bool_or(game = 'cham' and score >= 700),false),
    'rps',coalesce(bool_or(game = 'rps' and score >= 300),false),
    'survivor',coalesce(bool_or(game = 'dodge' and seconds >= 30),false),
    'counts',jsonb_build_object('plays',least(count(*),5),'games',least(count(distinct game),3))
  ) from public.arcade_runs where user_id = auth.uid();
$$;
