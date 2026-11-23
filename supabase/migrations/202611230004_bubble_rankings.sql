begin;

alter table public.arcade_runs drop constraint arcade_runs_game_check;
alter table public.arcade_runs add constraint arcade_runs_game_check
  check (game in ('shoot', 'circle', 'cham', 'rps', 'dodge', 'gate', 'slice', 'face-hockey', 'bubble-shooter'));

alter table public.arcade_runs drop constraint arcade_runs_seconds_check;
alter table public.arcade_runs add constraint arcade_runs_seconds_check
  check (seconds >= 0 and seconds <= case
    when game_mode in ('endless', 'vertical-endless') then 31536000
    when game = 'bubble-shooter' then 3600
    when game = 'face-hockey' then 60
    when game = 'dodge' and game_mode in ('survival', 'vertical-survival') then 60
    else 30
  end);

notify pgrst, 'reload schema';
commit;
