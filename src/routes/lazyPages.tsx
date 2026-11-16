import { lazy, useEffect } from "react";

const shoot = () => import("../games/ShootGamePage");
const gate = () => import("../games/GateGamePage");
const cham = () => import("../games/ChamGamePage");
const circle = () => import("../games/CircleGamePage");
const rps = () => import("../games/RpsGamePage");
const dodge = () => import("../games/DodgeGamePage");
const community = () => import("../community/CommunityPage");

export const ShootGamePage = lazy(() =>
  shoot().then((m) => ({ default: m.ShootGamePage })),
);
export const ShootResultPage = lazy(() =>
  shoot().then((m) => ({ default: m.ShootResultPage })),
);
export const GateGamePage = lazy(() =>
  gate().then((m) => ({ default: m.GateGamePage })),
);
export const GateResultPage = lazy(() =>
  gate().then((m) => ({ default: m.GateResultPage })),
);
export const ChamGamePage = lazy(() =>
  cham().then((m) => ({ default: m.ChamGamePage })),
);
export const ChamResultPage = lazy(() =>
  cham().then((m) => ({ default: m.ChamResultPage })),
);
export const CircleGamePage = lazy(() =>
  circle().then((m) => ({ default: m.CircleGamePage })),
);
export const CircleResultPage = lazy(() =>
  circle().then((m) => ({ default: m.CircleResultPage })),
);
export const RpsGamePage = lazy(() =>
  rps().then((m) => ({ default: m.RpsGamePage })),
);
export const RpsResultPage = lazy(() =>
  rps().then((m) => ({ default: m.RpsResultPage })),
);
export const DodgeGamePage = lazy(() =>
  dodge().then((m) => ({ default: m.DodgeGamePage })),
);
export const DodgeResultPage = lazy(() =>
  dodge().then((m) => ({ default: m.DodgeResultPage })),
);
export const CommunityPage = lazy(() =>
  community().then((m) => ({ default: m.CommunityPage })),
);

/** Warm only the destination the user points to, focuses, or touches. */
export function useRoutePrefetch() {
  useEffect(() => {
    const warmed = new Set<() => Promise<unknown>>();
    const base = new URL(import.meta.env.BASE_URL, location.origin).pathname;
    const warm = (event: Event) => {
      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.origin !== location.origin
      )
        return;
      const path = anchor.pathname.startsWith(base)
        ? "/" + anchor.pathname.slice(base.length)
        : anchor.pathname;
      const game = path.match(/^\/(?:play|result)\/(\w+)/)?.[1];
      const load =
        game === "shoot"
          ? shoot
          : game === "gate"
            ? gate
            : game === "cham"
              ? cham
              : game === "circle"
                ? circle
                : game === "rps"
                  ? rps
                  : game === "dodge"
                    ? dodge
                    : ["/ranking", "/achievements"].includes(path)
                      ? community
                      : null;
      if (!load || warmed.has(load)) return;
      warmed.add(load);
      void load().catch(() => warmed.delete(load));
    };
    document.addEventListener("pointerover", warm, { passive: true });
    document.addEventListener("focusin", warm);
    document.addEventListener("pointerdown", warm, { passive: true });
    return () => {
      document.removeEventListener("pointerover", warm);
      document.removeEventListener("focusin", warm);
      document.removeEventListener("pointerdown", warm);
    };
  }, []);
}
