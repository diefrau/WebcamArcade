import landing320 from "./images/aki-landing-320.webp";
import landing640 from "./images/aki-landing-640.webp";
import cham320 from "./images/rabbit-look-out-320.webp";
import cham640 from "./images/rabbit-look-out-640.webp";
import circle320 from "./images/dog-full-circle-320.webp";
import circle640 from "./images/dog-full-circle-640.webp";
import shoot320 from "./images/rival-pop-shot-320.webp";
import shoot640 from "./images/rival-pop-shot-640.webp";
import rps320 from "./images/rabbit-rock-paper-320.webp";
import rps640 from "./images/rabbit-rock-paper-640.webp";
import dodge320 from "./images/chick-dodge-320.webp";
import dodge640 from "./images/chick-dodge-640.webp";
import pose320 from "./images/blue-pose-320.webp";
import pose640 from "./images/blue-pose-640.webp";
import landing from "./images/aki-landing-960.webp";
import cham from "./images/rabbit-look-out-960.webp";
import circle from "./images/dog-full-circle-960.webp";
import shoot from "./images/rival-pop-shot-960.webp";
import rps from "./images/rabbit-rock-paper-960.webp";
import dodge from "./images/chick-dodge-960.webp";
import pose from "./images/blue-pose-960.webp";
import chamCenter from "./images/cham-center.webp";
import chamLeft from "./images/cham-left.webp";
import chamRight from "./images/cham-right.webp";
import chamUp from "./images/cham-up.webp";
import chamDown from "./images/cham-down.webp";
import dodgePlayer from "./images/dodge-player.webp";
import dodgeObstacle from "./images/dodge-obstacle.webp";
import slice320 from "./images/slice-mascot-320.webp";
import slice640 from "./images/slice-mascot-640.webp";
import slice from "./images/slice-mascot-960.webp";
import hockey320 from "./images/hockey-mascot-320.webp";
import hockey640 from "./images/hockey-mascot-640.webp";
import hockey from "./images/hockey-mascot-960.webp";
import bubble320 from "./images/bubble-pop-mascot-320.webp";
import bubble640 from "./images/bubble-pop-mascot-640.webp";
import bubble from "./images/bubble-pop-mascot-960.webp";

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
  slice: { src: slice, width: 1000, height: 1174, layout: "portrait" },
  hockey: { src: hockey, width: 969, height: 1233, layout: "portrait" },
  bubble: { src: bubble, width: 932, height: 1362, layout: "portrait" },
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
  slice: "slice",
  "face-hockey": "hockey",
  "bubble-shooter": "bubble",
} as const satisfies Record<string, CharacterAsset>;

const responsiveImages: Partial<Record<CharacterAsset, string>> = {
  landing: `${landing320} 320w, ${landing640} 640w, ${landing} 960w`,
  cham: `${cham320} 320w, ${cham640} 640w, ${cham} 960w`,
  circle: `${circle320} 320w, ${circle640} 640w, ${circle} 960w`,
  shoot: `${shoot320} 320w, ${shoot640} 640w, ${shoot} 960w`,
  rps: `${rps320} 320w, ${rps640} 640w, ${rps} 960w`,
  dodge: `${dodge320} 320w, ${dodge640} 640w, ${dodge} 960w`,
  pose: `${pose320} 320w, ${pose640} 640w, ${pose} 960w`,
  slice: `${slice320} 320w, ${slice640} 640w, ${slice} 960w`,
  hockey: `${hockey320} 320w, ${hockey640} 640w, ${hockey} 960w`,
  bubble: `${bubble320} 320w, ${bubble640} 640w, ${bubble} 932w`,
};
export function characterResponsiveProps(
  asset: CharacterAsset,
  size = "md",
  className = "",
) {
  const srcSet = responsiveImages[asset];
  if (!srcSet) return {};
  const sizes = className.includes("card-character")
    ? "(max-width: 650px) 55vw, (max-width: 1100px) 27vw, 20vw"
    : size === "hero"
      ? "(max-width: 650px) 80vw, (max-width: 1100px) 36vw, 440px"
      : size === "icon"
        ? "48px"
        : size === "sm"
          ? "96px"
          : size === "lg"
            ? "320px"
            : "180px";
  return { srcSet, sizes };
}
