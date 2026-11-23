import type { FaceBox } from "../vision/face";
import type { Point2D } from "../vision/visionTypes";
import { faceCrop } from "./hockeyFace";
import {
  CPU_GOAL_HALF_HEIGHT,
  CPU_MALLET_RADIUS,
  GOAL_HALF_HEIGHT,
  HOCKEY_CENTER,
  HOCKEY_HEIGHT,
  HOCKEY_WIDTH,
  MALLET_RADIUS,
  PUCK_RADIUS,
  type HockeyState,
} from "./hockeyRules";

const ink = "#161412";
const blue = "#42c9ef";
const pink = "#ff70ab";
const paper = "#fff9e8";

function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

export function makeHockeyRink() {
  const canvas = document.createElement("canvas");
  canvas.width = HOCKEY_WIDTH;
  canvas.height = HOCKEY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const { x: cx, y: cy } = HOCKEY_CENTER;
  const tint = ctx.createLinearGradient(0, 0, HOCKEY_WIDTH, 0);
  tint.addColorStop(0, "#b5efff");
  tint.addColorStop(0.5, "#fffbed");
  tint.addColorStop(1, "#ffd2e6");
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, HOCKEY_WIDTH, HOCKEY_HEIGHT);

  ctx.fillStyle = "#fff9";
  for (let y = 19; y < HOCKEY_HEIGHT; y += 20) {
    for (let x = y % 40; x < HOCKEY_WIDTH; x += 20) {
      circle(ctx, x, y, 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.setLineDash([13, 12]);
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, HOCKEY_HEIGHT);
  ctx.stroke();
  ctx.setLineDash([]);
  circle(ctx, cx, cy, 83);
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.stroke();
  circle(ctx, cx, cy, 9);
  ctx.fillStyle = ink;
  ctx.fill();

  for (const side of ["left", "right"] as const) {
    const x = side === "left" ? 0 : HOCKEY_WIDTH;
    const opening = side === "left" ? GOAL_HALF_HEIGHT : CPU_GOAL_HALF_HEIGHT;
    ctx.fillStyle = side === "left" ? "#77ddf8" : "#ffa5cc";
    ctx.beginPath();
    ctx.arc(x, cy, opening, -Math.PI / 2, Math.PI / 2, side === "right");
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.fillRect(
      side === "left" ? 0 : HOCKEY_WIDTH - 8,
      cy - opening,
      8,
      opening * 2,
    );
    ctx.fillStyle = "#fffbed";
    for (let y = cy - opening + 7; y < cy + opening - 4; y += 18)
      ctx.fillRect(side === "left" ? 0 : HOCKEY_WIDTH - 8, y, 8, 8);
  }
  return canvas;
}

function smile(ctx: CanvasRenderingContext2D, rival: boolean) {
  ctx.fillStyle = ink;
  for (const x of [-11, 11]) {
    circle(ctx, x, -5, 4.5);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 4, 12, 0.22, Math.PI - 0.22);
  ctx.lineWidth = 4;
  ctx.stroke();
  if (rival) {
    ctx.fillStyle = "#fc528c";
    for (const x of [-21, 21]) {
      circle(ctx, x, 5, 4.5);
      ctx.fill();
    }
  }
}

function drawMallet(
  ctx: CanvasRenderingContext2D,
  p: Point2D,
  rival: boolean,
  video?: HTMLVideoElement | null,
  box?: FaceBox | null,
) {
  const r = rival ? CPU_MALLET_RADIUS : MALLET_RADIUS;
  ctx.save();
  ctx.translate(p.x, p.y);
  circle(ctx, 3, 5, r + 1);
  ctx.fillStyle = ink;
  ctx.fill();
  circle(ctx, 0, 0, r);
  ctx.fillStyle = rival ? pink : blue;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  ctx.fill();
  ctx.stroke();

  const inner = r - 8;
  circle(ctx, 0, 0, inner);
  ctx.fillStyle = rival ? "#ffd8e7" : "#d3f8ff";
  ctx.fill();
  if (
    video &&
    box &&
    video.readyState >= 2 &&
    video.videoWidth &&
    video.videoHeight
  ) {
    const crop = faceCrop(box, video.videoWidth, video.videoHeight);
    ctx.save();
    ctx.clip();
    ctx.scale(-1, 1);
    ctx.drawImage(
      video,
      crop.x,
      crop.y,
      crop.size,
      crop.size,
      -inner,
      -inner,
      inner * 2,
      inner * 2,
    );
    ctx.restore();
  } else smile(ctx, rival);
  circle(ctx, 0, 0, inner);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

export function drawHockey(
  ctx: CanvasRenderingContext2D,
  rink: HTMLCanvasElement,
  state: HockeyState,
  video?: HTMLVideoElement | null,
  box?: FaceBox | null,
) {
  ctx.drawImage(rink, 0, 0);
  drawMallet(ctx, state.players.cpu, true);
  drawMallet(ctx, state.players.player, false, video, box);
  const { x, y } = state.puck;
  circle(ctx, x + 2, y + 4, PUCK_RADIUS);
  ctx.fillStyle = ink;
  ctx.fill();
  circle(ctx, x, y, PUCK_RADIUS);
  ctx.fillStyle = "#ffdd42";
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  ctx.stroke();
  circle(ctx, x - 4, y - 4, 4);
  ctx.fillStyle = "#fffae4";
  ctx.fill();
}
