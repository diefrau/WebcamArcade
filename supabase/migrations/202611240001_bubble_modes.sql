begin;

alter table public.arcade_runs
  drop constraint arcade_runs_game_mode_check,
  drop constraint arcade_runs_score_check,
  drop constraint arcade_runs_seconds_check,
  drop constraint arcade_runs_game_score_check;

alter table public.arcade_runs
  add constraint arcade_runs_game_mode_check check (
    game_mode = 'standard'
    or (game = 'shoot' and game_mode in ('wave', 'endless'))
    or (game = 'cham' and game_mode in ('hard', 'seeker'))
    or (game = 'dodge' and game_mode in ('survival', 'vertical', 'vertical-survival', 'endless', 'vertical-endless'))
    or (game = 'bubble-shooter' and game_mode in ('endless', 'time-attack'))
  ),
  add constraint arcade_runs_score_check check (
    score between 0 and case
      when game_mode in ('endless', 'vertical-endless', 'time-attack') then 2147483647
      else 200000
    end
  ),
  add constraint arcade_runs_seconds_check check (
    seconds between 0 and case
      when game_mode in ('endless', 'vertical-endless', 'time-attack') then 31536000
      when game = 'bubble-shooter' then 3600
      when game = 'face-hockey' then 60
      when game = 'dodge' and game_mode in ('survival', 'vertical-survival') then 60
      else 30
    end
  ),
  add constraint arcade_runs_game_score_check check (
    game_mode in ('endless', 'vertical-endless', 'time-attack') or game = 'shoot' or score <= case
      when game = 'bubble-shooter' then 5200
      when game = 'face-hockey' then 60
      when game = 'gate' then 1500
      when game = 'rps' then 500
      when game = 'dodge' and game_mode in ('survival', 'vertical-survival') then 10000
      when game in ('dodge', 'slice') then 3000
      else 1000
    end
  );

commit;
