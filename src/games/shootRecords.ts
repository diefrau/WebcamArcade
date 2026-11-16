export type ShootResult = {
  score: number;
  combo: number;
  accuracy: number;
  hits: number;
  shots: number;
  newBest: boolean;
  evidence?: import("../achievements/types").GameResultDetails;
};
export type ShootRecords = {
  best: number;
  plays: number;
  day: string;
  daily: number;
  last: ShootResult | null;
};
export const emptyShootRecords: ShootRecords = {
  best: 0,
  plays: 0,
  day: "",
  daily: 0,
  last: null,
};
