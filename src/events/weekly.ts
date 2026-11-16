import { readRuns, type Run } from "../community/store";
const DAY = 86400000,
  KST = 9 * 3600000;
export const hideKey = "arcade.event.hiddenUntil";
export function nextKstMidnight(now = Date.now()) {
  return (Math.floor((now + KST) / DAY) + 1) * DAY - KST;
}
const themes = [
  {
    title: ["동물 친구들의 개장 파티!", "The arcade opening party!"],
    body: [
      "친구들과 여러 게임을 돌아다녀 보세요. 세 미션을 모두 완료하면 이번 주 기념 스탬프를 받을 수 있어요!",
      "Meet your friends across the arcade. Complete all three missions to collect this week's stamp!",
    ],
    game: "gate",
    href: "/play/gate",
    goal: 1,
    label: ["벽 통과! 한 판 완료", "Finish a game of Fit Through!"],
    accept: (r: Run) => r.game === "gate",
  },
  {
    title: ["정확하게 노려봐!", "Aim for perfection!"],
    body: [
      "손끝에 집중할 시간! 게임을 즐기고 멋진 원에도 도전해 보세요.",
      "Focus on your fingertips and try drawing a beautiful circle.",
    ],
    game: "circle",
    href: "/play/circle",
    goal: 1,
    label: ["원 그리기 800점 달성", "Score 800 in Draw a Circle"],
    accept: (r: Run) => r.game === "circle" && r.score >= 800,
  },
  {
    title: ["끝까지 살아남아!", "Stay in the game!"],
    body: [
      "다가오는 장애물을 피해 오래 버텨보세요. 생존 모드에서 45초에 도전!",
      "Dodge the obstacles and try surviving for 45 seconds!",
    ],
    game: "dodge",
    href: "/play/dodge?mode=endless",
    goal: 1,
    label: ["빨리 피해! 생존 45초", "Survive 45 seconds in Dodge!"],
    accept: (r: Run) => r.game === "dodge" && r.seconds >= 45,
  },
  {
    title: ["이번엔 내가 술래!", "Your turn to lead!"],
    body: [
      "친구와의 눈치 싸움! 술래 모드도 해보고 다양한 게임을 즐겨보세요.",
      "Challenge your rival and try being the seeker this week!",
    ],
    game: "cham",
    href: "/play/cham?role=seeker",
    goal: 1,
    label: ["참참참 술래 모드 완료", "Finish Seeker mode"],
    accept: (r: Run) => r.game === "cham" && r.details?.gameMode === "seeker",
  },
] as const;
export function weeklyEvent(now = Date.now()) {
  const day = Math.floor((now + KST) / DAY);
  const start = (day - ((new Date(day * DAY).getUTCDay() + 6) % 7)) * DAY - KST;
  const index =
    ((Math.floor((start - Date.parse("2026-11-15T15:00:00Z")) / (7 * DAY)) %
      4) +
      4) %
    4;
  return { ...themes[index], id: String(start), start, end: start + 7 * DAY };
}
export function eventProgress(event: ReturnType<typeof weeklyEvent>) {
  const runs = readRuns().filter(
    (r) => Date.parse(r.date) >= event.start && Date.parse(r.date) < event.end,
  );
  const values = [
    new Set(runs.map((r) => r.game)).size,
    runs.length,
    runs.filter(event.accept).length,
  ];
  let previous: number[] = [];
  try {
    previous = JSON.parse(
      localStorage.getItem(`arcade.event.progress.${event.id}`) || "[]",
    );
  } catch {}
  const targets = [3, 5, event.goal];
  const result = targets.map((target, i) =>
    Math.min(
      target,
      Math.max(values[i], Number.isFinite(previous[i]) ? previous[i] : 0),
    ),
  );
  try {
    localStorage.setItem(
      `arcade.event.progress.${event.id}`,
      JSON.stringify(result),
    );
  } catch {}
  return result;
}
