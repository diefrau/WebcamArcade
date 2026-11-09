import sharp from "sharp";
import { mkdir, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const files = {
  LandingAki: "aki-landing",
  LookOut: "rabbit-look-out",
  FullCircle: "dog-full-circle",
  PopShot: "rival-pop-shot",
  RockPaper: "rabbit-rock-paper",
  DodgeIt: "chick-dodge",
  StrikeAPose: "blue-pose",
};
const gameplayFiles = {
  LookDefault: ["cham-center", 450],
  LookLeft: ["cham-left", 450],
  LookRight: ["cham-right", 450],
  LookUp: ["cham-up", 450],
  LookDown: ["cham-down", 450],
  DodgeChar: ["dodge-player", 360],
  DodgeObstacle: ["dodge-obstacle", 256],
  Poptarget1_s: ["shoot-target-1", 360],
  Poptarget1_h: ["shoot-target-1-hit", 360],
  Poptarget2_s: ["shoot-target-2", 360],
  Poptarget2_h: ["shoot-target-2-hit", 360],
  Poptarget3_s: ["shoot-target-3", 360],
  Poptarget3_h: ["shoot-target-3-hit", 360],
};
const out = new URL("../src/assets/characters/images/", import.meta.url);
await mkdir(out, { recursive: true });
const originals = Object.entries(files).map(([original, name]) => [
  original,
  [name],
]);
for (const [original, [name, width]] of [
  ...originals,
  ...Object.entries(gameplayFiles),
]) {
  const source = new URL(`../char/${original}.png`, import.meta.url);
  const destination = new URL(`${name}.webp`, out);
  const image = sharp(fileURLToPath(source));
  if (width) image.resize({ width, withoutEnlargement: true });
  await image
    .webp({ lossless: true, effort: 6 })
    .toFile(fileURLToPath(destination));
  console.log(
    `${name}: ${(await stat(source)).size} -> ${(await stat(destination)).size} bytes`,
  );
}
