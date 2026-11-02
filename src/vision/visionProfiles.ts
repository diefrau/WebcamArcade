export type VisionProfile = {
  detector: "hand" | "face" | "body" | null;
  segmentation: boolean;
  hands?: 1 | 2;
};
export const GAME_VISION_PROFILE = {
  cham: { detector: "face", segmentation: false },
  circle: { detector: "hand", segmentation: false },
  shoot: { detector: "hand", segmentation: false },
  rps: { detector: "hand", segmentation: false },
  dodge: { detector: "body", segmentation: false },
  gate: { detector: "body", segmentation: false },
  skewer: { detector: "hand", segmentation: false },
  catch: { detector: "hand", segmentation: false, hands: 2 },
  hit: { detector: "body", segmentation: false },
  freeze: { detector: "body", segmentation: false },
} as const satisfies Record<string, VisionProfile>;
export function visionProfile(path: string, search = ""): VisionProfile {
  if (path.startsWith("/result/"))
    return { detector: null, segmentation: false };
  if (
    path === "/play/gate" &&
    new URLSearchParams(search).get("input") === "mock"
  )
    return { detector: null, segmentation: false };
  const id = path.match(/^\/play\/([^/]+)/)?.[1];
  if (id === "cham" && new URLSearchParams(search).get("role") === "seeker")
    return { detector: "hand", segmentation: false };
  return id && id in GAME_VISION_PROFILE
    ? GAME_VISION_PROFILE[id as keyof typeof GAME_VISION_PROFILE]
    : { detector: "hand", segmentation: false };
}
