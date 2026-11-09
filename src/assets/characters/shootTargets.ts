import first from "./images/shoot-target-1.webp";
import firstHit from "./images/shoot-target-1-hit.webp";
import second from "./images/shoot-target-2.webp";
import secondHit from "./images/shoot-target-2-hit.webp";
import third from "./images/shoot-target-3.webp";
import thirdHit from "./images/shoot-target-3-hit.webp";

export const shootTargets = [
  { idle: first, hit: firstHit },
  { idle: second, hit: secondHit },
  { idle: third, hit: thirdHit },
] as const;
