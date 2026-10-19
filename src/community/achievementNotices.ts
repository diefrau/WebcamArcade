export const achievementDescriptions: Record<string, [string, string]> = {
  first: ["첫 게임 완료", "Complete your first game"],
  five: ["게임 5번 완료", "Complete five games"],
  variety: ["서로 다른 게임 3종 완료", "Complete three different games"],
  sharp: ["쏴! 정확도 90% 이상 (점수 획득)", "Shoot: score with 90% accuracy"],
  artist: ["원 그리기 800점", "Circle: score 800"],
  reflex: ["참참참 700점", "Cham: score 700"],
  rps: ["가위바위보 300점", "Rock Paper Scissors: score 300"],
  survivor: ["빨리 피해! 30초 생존", "Dodge: survive 30 seconds"],
};

export type AchievementNotice = {
  id: string;
  title: [string, string];
  secret: boolean;
};
export function announceAchievement(notice: AchievementNotice) {
  window.dispatchEvent(
    new CustomEvent("arcade:achievement", { detail: notice }),
  );
}
