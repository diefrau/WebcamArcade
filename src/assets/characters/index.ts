import landing from "./images/aki-landing.webp";
import cham from "./images/rabbit-look-out.webp";
import circle from "./images/dog-full-circle.webp";
import shoot from "./images/rival-pop-shot.webp";
import rps from "./images/rabbit-rock-paper.webp";
import dodge from "./images/chick-dodge.webp";
import pose from "./images/blue-pose.webp";
import chamCenter from "./images/cham-center.webp";
import chamLeft from "./images/cham-left.webp";
import chamRight from "./images/cham-right.webp";
import chamUp from "./images/cham-up.webp";
import chamDown from "./images/cham-down.webp";
import dodgePlayer from "./images/dodge-player.webp";
import dodgeObstacle from "./images/dodge-obstacle.webp";

const chamPose = { width: 450, height: 600, layout: "portrait" } as const;

// Original supplied artwork: do not recolor or mirror asymmetrical accessories.
export const characterAssets = {
  landing: { src: landing, width: 1122, height: 1402, layout: "portrait" },
  cham: { src: cham, width: 1122, height: 1402, layout: "portrait" },
  circle: { src: circle, width: 1536, height: 1024, layout: "landscape" },
  shoot: { src: shoot, width: 1536, height: 1024, layout: "landscape" },
  rps: { src: rps, width: 1122, height: 1402, layout: "portrait" },
  dodge: { src: dodge, width: 1536, height: 1024, layout: "landscape" },
  pose: { src: pose, width: 1122, height: 1402, layout: "portrait" },
  chamCenter: { src: chamCenter, ...chamPose },
  chamLeft: { src: chamLeft, ...chamPose },
  chamRight: { src: chamRight, ...chamPose },
  chamUp: { src: chamUp, ...chamPose },
  chamDown: { src: chamDown, ...chamPose },
  dodgePlayer: {
    src: dodgePlayer,
    width: 360,
    height: 480,
    layout: "portrait",
  },
  dodgeObstacle: {
    src: dodgeObstacle,
    width: 256,
    height: 256,
    layout: "portrait",
  },
} as const;
export type CharacterAsset = keyof typeof characterAssets;
export const chamPoses = {
  center: "chamCenter",
  left: "chamLeft",
  right: "chamRight",
  up: "chamUp",
  down: "chamDown",
} as const satisfies Record<string, CharacterAsset>;
export const gameCharacterMap = {
  cham: "cham",
  circle: "circle",
  shoot: "shoot",
  rps: "rps",
  dodge: "dodge",
  gate: "pose",
} as const satisfies Record<string, CharacterAsset>;
