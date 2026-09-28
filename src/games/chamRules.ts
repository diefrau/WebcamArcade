import type { Direction } from "../vision/face";
export const winsRound = (computer: Direction, player: Direction | null) =>
  player !== null && player !== computer;
