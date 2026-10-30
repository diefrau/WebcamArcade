export const secretIds = [
  "manners",
  "mystery",
  "jazz",
  "doublePeace",
  "winkPeace",
  "surprise",
] as const;
export type SecretId = (typeof secretIds)[number];
export const secretDescriptions: Record<
  SecretId,
  { name: [string, string]; detail: [string, string] }
> = {
  manners: {
    name: ["어허, 그건 안돼요~", "Hey, mind your manners!"],
    detail: [
      "가운데 손가락만 펴고 1.2초 유지했어요.",
      "Held up only the middle finger for 1.2 seconds.",
    ],
  },
  mystery: {
    name: ["이게... 뭐죠?", "What… is that?"],
    detail: [
      "얼굴이 보이는 상태에서 손으로 중앙을 가렸다 치우기를 5초 안에 3번 반복했어요.",
      "Covered and uncovered the center with a close hand three times within five seconds while your face remained visible.",
    ],
  },
  jazz: {
    name: ["손이 두 배, 신남도 두 배!", "Double hands, double fun!"],
    detail: [
      "얼굴과 펼친 두 손을 2초 동안 보여줬어요.",
      "Showed your face and two open palms for two seconds.",
    ],
  },
  doublePeace: {
    name: ["평화는 두 손으로!", "Double peace!"],
    detail: [
      "양손으로 브이를 만들고 1.5초 유지했어요.",
      "Held a V sign with both hands for 1.5 seconds.",
    ],
  },
  winkPeace: {
    name: ["비밀 인사 접수!", "Secret greeting received!"],
    detail: [
      "브이와 함께 한쪽 눈을 1초 동안 찡긋했어요.",
      "Held a V sign and a one-eye wink for one second.",
    ],
  },
  surprise: {
    name: ["세상에, 대박!", "Oh, wow!"],
    detail: [
      "펼친 두 손과 입을 벌린 놀란 표정을 1초 동안 보여줬어요.",
      "Showed two open palms and an open-mouth surprised face for one second.",
    ],
  },
};
export type SecretRecord = { id: SecretId; date: string; synced?: boolean };
const key = "arcade.community.secrets";
let memory: SecretRecord[] | null = null;
export function readSecrets(): SecretRecord[] {
  if (memory) return memory;
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value)
      ? value
          .filter(
            (r) => secretIds.includes(r?.id) && typeof r.date === "string",
          )
          .filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i)
      : [];
  } catch {
    return memory || [];
  }
}
export function writeSecrets(records: SecretRecord[]) {
  memory = records;
  try {
    localStorage.setItem(key, JSON.stringify(records));
  } catch {
    /* Session-only fallback. */
  }
}
export function storeSecret(id: SecretId) {
  const records = readSecrets();
  if (records.some((r) => r.id === id)) return false;
  writeSecrets([...records, { id, date: new Date().toISOString() }]);
  return true;
}
