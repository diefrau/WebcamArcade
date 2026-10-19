-- Store discovered secret IDs only; camera frames and landmarks stay on the device.
create table public.arcade_secrets (
  user_id uuid not null references public.arcade_profiles(user_id) on delete cascade,
  secret text not null check (secret in ('manners','mystery','jazz','doublePeace','winkPeace','surprise')),
  unlocked_at timestamptz not null default now(),
  primary key (user_id,secret)
);
alter table public.arcade_secrets enable row level security;
revoke all on public.arcade_secrets from public,anon,authenticated;
grant select on public.arcade_secrets to authenticated;
create policy own_secrets on public.arcade_secrets for select to authenticated using ((select auth.uid()) = user_id);
create function public.arcade_unlock_secret(p_secret text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.arcade_profiles where user_id = auth.uid()) then raise exception 'Join first'; end if;
  insert into public.arcade_secrets(user_id,secret) values(auth.uid(),p_secret) on conflict do nothing;
end; $$;
revoke execute on function public.arcade_unlock_secret(text) from public,anon,authenticated;
grant execute on function public.arcade_unlock_secret(text) to authenticated;

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
    'counts',jsonb_build_object('plays',least(count(*),5),'games',least(count(distinct game),3)),
    'secrets',coalesce((select jsonb_object_agg(secret,true) from public.arcade_secrets where user_id = auth.uid()),'{}'::jsonb)
  ) from public.arcade_runs where user_id = auth.uid();
$$;
