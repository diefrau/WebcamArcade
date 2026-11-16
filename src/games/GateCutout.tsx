import { useEffect, useRef, type RefObject } from "react";
import { cutoutPlacement, type BodyCutoutFrame } from "../vision/bodyCutout";

/** Paint transferred frames without putting video pixels in React state. */
export function GateCutout({
  frames,
  onVisible,
}: {
  frames: RefObject<BodyCutoutFrame | null>;
  onVisible: (visible: boolean) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    // Fixed canvas coordinates: reuse the waist feather for every video frame.
    const fade = ctx.createLinearGradient(0, 460, 0, 520);
    fade.addColorStop(0, "#fff");
    fade.addColorStop(1, "#fff0");
    let raf = 0,
      last: BodyCutoutFrame | null = null,
      visible = false;
    const show = (next: boolean) => {
      if (visible !== next) {
        visible = next;
        onVisible(next);
      }
    };
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const frame = frames.current;
      if (!frame || document.hidden || performance.now() - frame.time >= 900) {
        ctx.clearRect(0, 0, 1000, 600);
        last = null;
        show(false);
        return;
      }
      if (frame === last) return;
      last = frame;
      const { bitmap, landmarks } = frame;
      const placement = cutoutPlacement(landmarks, bitmap.width, bitmap.height);
      ctx.clearRect(0, 0, 1000, 600);
      if (!placement) {
        show(false);
        return;
      }
      ctx.save();
      ctx.translate(500, 270);
      ctx.scale(-placement.scale, placement.scale);
      ctx.translate(-placement.x, -placement.y);
      ctx.drawImage(bitmap, 0, 0);
      ctx.restore();
      // Upper body only: soften the waist edge instead of showing floating legs.
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, 1000, 600);
      ctx.globalCompositeOperation = "source-over";
      show(true);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, 1000, 600);
    };
  }, [frames, onVisible]);
  return (
    <canvas
      ref={canvas}
      width={1000}
      height={600}
      className="gate-cutout"
      aria-hidden="true"
    />
  );
}
