import { useTranslation } from "react-i18next";

export function GameTimer({
  seconds,
  duration,
}: {
  seconds: number;
  duration?: number;
}) {
  const { t } = useTranslation();
  const label = t(duration === undefined ? "elapsedTime" : "time");

  return (
    <div className="timer-bar">
      <span>◷ {label}</span>
      {duration !== undefined && (
        <progress aria-label={label} max={duration} value={seconds} />
      )}
      <b>
        {seconds}
        <small>s</small>
      </b>
    </div>
  );
}
