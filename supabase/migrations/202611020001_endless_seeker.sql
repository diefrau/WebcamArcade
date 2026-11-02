begin;
alter table public.arcade_runs alter column seconds type numeric(10,1);
alter table public.arcade_runs drop constraint arcade_runs_seconds_check;
alter table public.arcade_runs drop constraint arcade_runs_game_score_check;
alter table public.arcade_runs drop constraint arcade_runs_game_mode_check;
alter table public.arcade_runs drop constraint arcade_runs_score_check;
alter table public.arcade_runs add constraint arcade_runs_score_check check (score >= 0 and score <= case when game_mode in ('endless','vertical-endless') then 2147483647 else 200000 end);
alter table public.arcade_runs add constraint arcade_runs_seconds_check check (seconds >= 0 and seconds <= case when game_mode in ('endless','vertical-endless') then 31536000 when game = 'dodge' and game_mode in ('survival','vertical-survival') then 60 else 30 end);
alter table public.arcade_runs add constraint arcade_runs_game_score_check check (game_mode in ('endless','vertical-endless') or game = 'shoot' or score <= case when game = 'rps' then 500 when game = 'dodge' and game_mode in ('survival','vertical-survival') then 10000 when game = 'dodge' then 3000 else 1000 end);
alter table public.arcade_runs add constraint arcade_runs_game_mode_check check (
 game_mode='standard' or (game='shoot' and game_mode in ('wave','endless')) or
 (game='cham' and game_mode in ('hard','seeker')) or
 (game='dodge' and game_mode in ('survival','vertical','vertical-survival','endless','vertical-endless'))
);
notify pgrst, 'reload schema';
commit;
