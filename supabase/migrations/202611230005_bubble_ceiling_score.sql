begin;

alter table public.arcade_runs drop constraint arcade_runs_game_score_check;
alter table public.arcade_runs add constraint arcade_runs_game_score_check
  check (game_mode in ('endless', 'vertical-endless') or game = 'shoot' or score <= case
    when game = 'bubble-shooter' then 1600
    when game = 'face-hockey' then 60
    when game = 'gate' then 1500
    when game = 'rps' then 500
    when game = 'dodge' and game_mode in ('survival', 'vertical-survival') then 10000
    when game in ('dodge', 'slice') then 3000
    else 1000
  end);

notify pgrst, 'reload schema';
commit;
