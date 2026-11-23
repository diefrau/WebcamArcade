begin;

create or replace function public.arcade_achievement_ids() returns text[]
language sql immutable set search_path = '' as $$
  select array[
    'first', 'five', 'variety', 'regular', 'resident', 'allrounder',
    'sessionAll', 'replayFive', 'warmup', 'collector', 'dayTen', 'chamFirst',
    'chamStreak3', 'chamStreak5', 'chamStreak10', 'chamFast', 'chamPerfect', 'reflex',
    'chamMaster', 'circleFirst', 'circle700', 'artist', 'circle900', 'circle950',
    'circleUnbroken', 'circleFast', 'circleStreak', 'circleTen', 'circle990', 'shootFirst',
    'shootTen', 'shootPrecise', 'shootPerfect', 'shootFive', 'shootFast', 'shootCombo',
    'shootAll', 'shootHigh', 'shootHundred', 'sharp', 'rpsFirst', 'rpsStreak3',
    'rpsStreak5', 'rpsStreak10', 'rps', 'rpsFast', 'rpsRecognized', 'rpsTrio',
    'rpsRock', 'rpsPaper', 'dodgeFirst', 'dodgeTen', 'survivor', 'dodgeMinute',
    'dodgeClean', 'dodgeStreak', 'dodgeDance', 'dodgePeak', 'poseFirst', 'pose80',
    'pose95', 'poseQuick', 'poseFive', 'poseTen', 'poseHint', 'poseFull',
    'poseRegular', 'hockeyFirst', 'hockeyGoal', 'hockeyThree', 'hockeyFive', 'hockeyShutout',
    'hockeyStreak', 'hockeyComeback', 'hockeyLead', 'hockeyWins', 'hockeyFast', 'sliceFirst',
    'sliceDouble', 'sliceTriple', 'sliceQuad', 'sliceCombo', 'sliceTwenty', 'sliceThirty',
    'sliceNoBomb', 'slicePerfect', 'bubbleMouth', 'bubbleFirstPop', 'bubbleBigShot', 'bubbleStreak',
    'bubbleBank', 'bubbleBothModes', 'bubbleEndlessFifty', 'bubbleEndlessHundred', 'bubbleEndlessThree', 'bubbleEndlessFive',
    'bubbleSurvivalFive', 'bubbleSurvivalTen', 'bubbleSurvivalTwenty', 'bubbleSurvivalCombo', 'manners', 'mystery',
    'jazz', 'doublePeace', 'winkPeace', 'surprise'
  ];
$$;

create table if not exists public.arcade_achievement_unlocks (
  user_id uuid not null references public.arcade_profiles(user_id) on delete cascade,
  achievement_id text not null,
  primary key (user_id, achievement_id)
);
alter table public.arcade_achievement_unlocks enable row level security;
revoke all on public.arcade_achievement_unlocks from public, anon, authenticated;

create or replace function public.arcade_sync_achievements(p_ids text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.arcade_profiles where user_id = auth.uid())
    then raise exception 'Join first'; end if;
  if coalesce(cardinality(p_ids), 0) > cardinality(public.arcade_achievement_ids())
    then raise exception 'Too many achievement IDs'; end if;

  insert into public.arcade_achievement_unlocks(user_id, achievement_id)
  select auth.uid(), id from unnest(public.arcade_achievement_ids()) as a(id)
  where id = any(p_ids)
  on conflict do nothing;
end;
$$;

create or replace function public.arcade_achievement_board()
returns table(place bigint, nickname text, unlocked integer, total integer)
language sql stable security definer set search_path = '' as $$
  with scores as (
    select u.user_id, count(*)::integer as unlocked
    from public.arcade_achievement_unlocks u
    where u.achievement_id = any(public.arcade_achievement_ids())
    group by u.user_id
  )
  select row_number() over (order by s.unlocked desc, s.user_id),
    coalesce(nullif(p.nickname, ''), p.anonymous_name), s.unlocked,
    cardinality(public.arcade_achievement_ids())
  from scores s join public.arcade_profiles p using (user_id)
  order by s.unlocked desc, s.user_id limit 50;
$$;

revoke execute on function public.arcade_achievement_ids(),
  public.arcade_sync_achievements(text[]), public.arcade_achievement_board()
  from public, anon, authenticated;
grant execute on function public.arcade_sync_achievements(text[]) to authenticated;
grant execute on function public.arcade_achievement_board() to anon, authenticated;

notify pgrst, 'reload schema';
commit;
