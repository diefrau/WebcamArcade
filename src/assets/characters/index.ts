import landing from "./images/aki-landing.webp";
import cham from "./images/rabbit-look-out.webp";
import circle from "./images/dog-full-circle.webp";
import shoot from "./images/rival-pop-shot.webp";
import rps from "./images/rabbit-rock-paper.webp";
import dodge from "./images/chick-dodge.webp";
import pose from "./images/blue-pose.webp";

// Original supplied artwork: do not recolor or mirror asymmetrical accessories.
export const characterAssets = {
  landing: { src: landing, width: 1122, height: 1402, layout: "portrait" },
  cham: { src: cham, width: 1122, height: 1402, layout: "portrait" },
  circle: { src: circle, width: 1536, height: 1024, layout: "landscape" },
  shoot: { src: shoot, width: 1536, height: 1024, layout: "landscape" },
  rps: { src: rps, width: 1122, height: 1402, layout: "portrait" },
  dodge: { src: dodge, width: 1536, height: 1024, layout: "landscape" },
  pose: { src: pose, width: 1122, height: 1402, layout: "portrait" },
} as const;
export type CharacterAsset = keyof typeof characterAssets;
export const gameCharacterMap = {
  cham: "cham",
  circle: "circle",
  shoot: "shoot",
  futureRps: "rps",
  futureDodge: "dodge",
  futurePose: "pose",
} as const satisfies Record<string, CharacterAsset>;
