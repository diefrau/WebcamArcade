import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Hand } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCamera } from "../vision/CameraProvider";
import "./hand-menu-cursor.css";
import { useInputEnvironment } from "./InputEnvironment";

/** Pinch activates only explicitly marked menu buttons, never game targets. */
export function HandMenuCursor({ active }: { active: boolean }) {
  const camera = useCamera();
  const { compactTouch } = useInputEnvironment();
  const { t } = useTranslation();
  const consumed = useRef(camera.shotSequence);
  const armed = useRef(false);
  const [cursor, setCursor] = useState<{
    x: number;
    y: number;
    pinched: boolean;
    hovering: boolean;
  } | null>(null);
  useEffect(() => {
    const freshPinch = consumed.current !== camera.shotSequence;
    consumed.current = camera.shotSequence;
    if (
      !active ||
      compactTouch ||
      camera.state !== "ready" ||
      camera.vision !== "ready" ||
      !camera.hand.detected ||
      document.hidden ||
      document.querySelector("dialog[open]")
    ) {
      armed.current = false;
      setCursor(null);
      return;
    }
    const x = camera.hand.x * window.innerWidth;
    const y = camera.hand.y * window.innerHeight;
    const button = document
      .elementFromPoint(x, y)
      ?.closest<HTMLButtonElement>("button[data-hand-click]");
    const target = button && !button.disabled ? button : null;
    setCursor({ x, y, pinched: camera.hand.pinched, hovering: !!target });
    target?.classList.add("hand-hovered");
    if (!camera.hand.pinched) armed.current = true;
    else {
      if (freshPinch && armed.current) target?.click();
      armed.current = false;
    }
    return () => target?.classList.remove("hand-hovered");
  }, [
    active,
    compactTouch,
    camera.hand,
    camera.shotSequence,
    camera.state,
    camera.vision,
  ]);
  if (!cursor) return null;
  return createPortal(
    <>
      <div
        className={`hand-menu-cursor ${cursor.pinched ? "pinched" : ""} ${cursor.hovering ? "hovering" : ""}`}
        style={{ left: cursor.x, top: cursor.y }}
        aria-hidden="true"
      >
        <Hand />
      </div>
      <div className="hand-menu-hint">{t("handMenuHint")}</div>
    </>,
    document.body,
  );
}
