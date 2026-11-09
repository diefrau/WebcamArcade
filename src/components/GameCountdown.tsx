import "./game-countdown.css";

const BEAT_MS = 500;
export const GAME_COUNTDOWN_MS = 3 * BEAT_MS;

export function countdownBeat(remainingMs: number) {
  return Math.ceil(remainingMs / BEAT_MS);
}

export function GameCountdown({ beat }: { beat: number }) {
  return (
    <div className="game-countdown-beat" key={beat}>
      {beat}
    </div>
  );
}
