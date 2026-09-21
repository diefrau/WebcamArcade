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
const out = new URL("../src/assets/characters/images/", import.meta.url);
await mkdir(out, { recursive: true });
for (const [original, name] of Object.entries(files)) {
  const source = new URL(`../char/${original}.png`, import.meta.url);
  const destination = new URL(`${name}.webp`, out);
  // Lossless format conversion only: original dimensions, alpha, colors, and artwork remain intact.
  await sharp(fileURLToPath(source))
    .webp({ lossless: true, effort: 6 })
    .toFile(fileURLToPath(destination));
  console.log(
    `${name}: ${(await stat(source)).size} -> ${(await stat(destination)).size} bytes`,
  );
}
