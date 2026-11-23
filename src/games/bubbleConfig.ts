export const BUBBLE_SHOTS = 30;
export const BUBBLE_MAX_SCORE = 5200;
export const BUBBLE_MAX_RECORD_SECONDS = 3600;
export const BUBBLE_ROW_SECONDS = 3;
export const bubbleModeLabels = {
  standard: "standardMode",
  endless: "endlessMode",
  "time-attack": "bubbleTimeAttack",
} as const;
export type BubbleMode = keyof typeof bubbleModeLabels;
