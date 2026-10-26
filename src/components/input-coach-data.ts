import type { GameId } from "../community/store";
export const inputKind: Record<GameId, "hand" | "face" | "body"> = {
  shoot: "hand",
  circle: "hand",
  cham: "face",
  rps: "hand",
  dodge: "body",
};
export const coachCopy: Record<
  GameId,
  {
    goal: [string, string];
    steps: [[string, string], [string, string], [string, string]];
  }
> = {
  shoot: {
    goal: [
      "과녁을 조준하고 집어서 쏘세요.",
      "Aim at the target, then pinch to fire.",
    ],
    steps: [
      ["손 이동", "Move"],
      ["조준", "Aim"],
      ["집어서 발사", "Pinch"],
    ],
  },
  circle: {
    goal: [
      "집은 동안 그리고, 손을 펴면 이동해요.",
      "Pinch to draw. Release to move without drawing.",
    ],
    steps: [
      ["집기", "Pinch"],
      ["원 그리기", "Draw"],
      ["놓고 이동", "Release"],
    ],
  },
  cham: {
    goal: [
      "화살표와 다른 방향으로 고개를 돌려요.",
      "Turn your head away from the arrow.",
    ],
    steps: [
      ["정면 보정", "Center"],
      ["옆으로 보기", "Turn"],
      ["정면으로", "Return"],
    ],
  },
  rps: {
    goal: [
      "가위·바위·보 중 하나를 잠깐 유지해요.",
      "Hold a rock, paper or scissors pose briefly.",
    ],
    steps: [
      ["바위", "Rock"],
      ["보", "Paper"],
      ["가위", "Scissors"],
    ],
  },
  dodge: {
    goal: [
      "몸을 좌우로 움직여 장애물을 피하세요.",
      "Move left and right to dodge obstacles.",
    ],
    steps: [
      ["가운데", "Center"],
      ["왼쪽 이동", "Left"],
      ["오른쪽 이동", "Right"],
    ],
  },
};

export const pointerCopy: typeof coachCopy = {
  shoot: {
    goal: [
      "과녁으로 이동한 뒤 클릭하거나 터치하세요.",
      "Move to the target, then click or tap.",
    ],
    steps: [
      ["이동", "Move"],
      ["조준", "Aim"],
      ["클릭 / 터치", "Click / tap"],
    ],
  },
  circle: {
    goal: [
      "누른 동안 그리고, 놓으면 이동해요.",
      "Hold to draw. Release to move without drawing.",
    ],
    steps: [
      ["누르기", "Hold"],
      ["원 그리기", "Draw"],
      ["놓기", "Release"],
    ],
  },
  cham: {
    goal: [
      "화살표와 다른 방향을 선택해요.",
      "Choose a direction different from the arrow.",
    ],
    steps: [
      ["방향 확인", "Watch"],
      ["방향 선택", "Choose"],
      ["피하기", "Dodge"],
    ],
  },
  rps: coachCopy.rps,
  dodge: {
    goal: [
      "좌우 버튼으로 장애물을 피하세요.",
      "Use the left and right controls to dodge.",
    ],
    steps: [
      ["가운데", "Center"],
      ["왼쪽 버튼", "Left"],
      ["오른쪽 버튼", "Right"],
    ],
  },
};
