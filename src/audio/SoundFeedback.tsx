import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useCamera } from "../vision/CameraProvider";
import type { PlaySound } from "./useGameSound";

/** UI delegation covers native, keyboard and pinch clicks without per-button audio. */
export function SoundFeedback({ play }: { play: PlaySound }) {
  const { pathname } = useLocation();
  const camera = useCamera();
  const path = useRef(pathname);
  const connected = useRef(false);
  const detected = useRef({ hand: false, face: false, body: false });
  useEffect(() => {
    if (path.current === pathname) return;
    path.current = pathname;
    if (!pathname.startsWith("/result/")) play("navigation.transition");
  }, [pathname, play]);
  useEffect(() => {
    const ready = camera.state === "ready";
    if (ready && !connected.current) play("camera.ready");
    connected.current = ready;
  }, [camera.state, play]);
  useEffect(() => {
    const next = {
      hand: camera.hand.detected,
      face: camera.face.detected,
      body: camera.body.detected,
    };
    for (const key of ["hand", "face", "body"] as const) {
      if (next[key] && !detected.current[key] && camera.vision === "ready")
        play(
          key === "hand"
            ? "camera.handDetected"
            : key === "face"
              ? "camera.faceDetected"
              : "camera.bodyDetected",
        );
    }
    detected.current = next;
  }, [
    camera.hand.detected,
    camera.face.detected,
    camera.body.detected,
    camera.vision,
    play,
  ]);
  useEffect(() => {
    let hovered: Element | null = null;
    const click = (event: MouseEvent) => {
      const element = (event.target as Element)?.closest<HTMLElement>(
        'button,a[href],input[type="checkbox"]',
      );
      if (
        !element ||
        element.matches(
          ':disabled,[aria-disabled="true"],[data-sound="none"],.camera-connect,.camera-utility',
        ) ||
        element.closest(".target-character,.dodge-controls,.cham-controls")
      )
        return;
      if (element.matches("[data-sound-toggle]")) return;
      if (
        element.matches(
          ".back-link,.circle-back,.coach-reset,.camera-cancel",
        ) ||
        element.getAttribute("data-sound") === "back"
      )
        play("ui.back");
      else if (element.matches('input[type="checkbox"],[role="switch"]')) {
        const on =
          element instanceof HTMLInputElement
            ? element.checked
            : element.getAttribute("aria-checked") === "true";
        play(on ? "ui.toggleOn" : "ui.toggleOff");
      } else if (element.matches("[aria-pressed]"))
        play(
          element.getAttribute("aria-pressed") === "true"
            ? "ui.toggleOff"
            : "ui.toggleOn",
        );
      else play("ui.click");
    };
    const hover = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const element = (event.target as Element)?.closest(
        ".top-nav a,.game-card.available,.arcade-button,.utilities button",
      );
      if (element === hovered) return;
      hovered = element;
      if (
        element &&
        !element.matches(":disabled") &&
        !document.querySelector("dialog[open]")
      )
        play("ui.hover");
    };
    const reaction = (event: MouseEvent) => {
      const image = (event.target as Element)
        ?.closest(".hero-mascot")
        ?.querySelector("[data-character]");
      if (!image || pathname !== "/") return;
      const asset = image.getAttribute("data-character") ?? "";
      play(
        asset.includes("dodge")
          ? "character.chick"
          : asset.includes("circle")
            ? "character.dog"
            : "character.aki",
      );
    };
    document.addEventListener("click", click, true);
    document.addEventListener("click", reaction);
    document.addEventListener("pointerover", hover);
    return () => {
      document.removeEventListener("click", click, true);
      document.removeEventListener("click", reaction);
      document.removeEventListener("pointerover", hover);
    };
  }, [play, pathname]);
  return null;
}
