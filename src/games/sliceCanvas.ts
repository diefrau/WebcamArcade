import { SLICE_HEIGHT, SLICE_WIDTH, type SliceItem } from "./sliceRules";
import type { Point2D } from "../vision/visionTypes";

const palette = {
  apple: ["#ff5997", "#ffd5e4"],
  orange: ["#ff9a36", "#ffec9b"],
  lime: ["#a8ea39", "#edffb6"],
  banana: ["#ffda38", "#fff4ad"],
  strawberry: ["#ff4969", "#ffe69c"],
  grapes: ["#ac73f0", "#e9caff"],
  bomb: ["#424155", "#ffde38"],
};

function circle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
}

// Scale the custom fruit silhouettes to the blade's hit radius.
function drawBanana(ctx: CanvasRenderingContext2D, shine: string) {
  ctx.rotate(-0.35);
  ctx.beginPath();
  ctx.moveTo(-32, -6);
  ctx.bezierCurveTo(-20, 11, 1, 15, 16, -8);
  ctx.quadraticCurveTo(18, -17, 17, -26);
  ctx.lineTo(24, -29);
  ctx.bezierCurveTo(35, -8, 24, 19, 4, 25);
  ctx.bezierCurveTo(-13, 30, -30, 16, -32, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = shine;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-23, 5);
  ctx.quadraticCurveTo(1, 32, 20, -3);
  ctx.stroke();
}

function drawStrawberry(ctx: CanvasRenderingContext2D, seedColor: string) {
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.bezierCurveTo(-26, -31, -37, -10, -23, 10);
  ctx.quadraticCurveTo(-8, 31, 0, 33);
  ctx.quadraticCurveTo(9, 31, 23, 10);
  ctx.bezierCurveTo(37, -10, 26, -31, 0, -20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#81db50";
  ctx.beginPath();
  ctx.moveTo(-18, -24);
  ctx.lineTo(-5, -25);
  ctx.lineTo(0, -34);
  ctx.lineTo(6, -25);
  ctx.lineTo(18, -24);
  ctx.lineTo(7, -13);
  ctx.lineTo(0, -17);
  ctx.lineTo(-8, -13);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = seedColor;
  for (const [x, y] of [
    [-16, -5],
    [0, -4],
    [16, -5],
    [-10, 7],
    [10, 7],
    [0, 19],
  ]) {
    circle(ctx, x, y, 2.6);
    ctx.fill();
  }
}

function drawGrapes(ctx: CanvasRenderingContext2D, shine: string) {
  const grapeColor = ctx.fillStyle;
  ctx.fillStyle = "#81db50";
  ctx.beginPath();
  ctx.ellipse(9, -27, 12, 5, -0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 3.5;
  for (const [x, y] of [
    [0, -19],
    [-15, -10],
    [15, -10],
    [-9, 6],
    [9, 6],
    [0, 20],
  ]) {
    ctx.fillStyle = grapeColor;
    circle(ctx, x, y, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = shine;
    circle(ctx, x - 3, y - 4, 2.8);
    ctx.fill();
  }
}

function drawItem(ctx: CanvasRenderingContext2D, item: SliceItem) {
  const { x, y, radius, kind } = item;
  const [color, shine] = palette[kind];
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#171512";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.fillStyle = color;
  if (kind === "banana" || kind === "strawberry" || kind === "grapes") {
    ctx.scale(radius / 36, radius / 36);
    if (kind === "banana") drawBanana(ctx, shine);
    else if (kind === "strawberry") drawStrawberry(ctx, shine);
    else drawGrapes(ctx, shine);
    ctx.restore();
    return;
  }
  circle(ctx, 0, 0, radius);
  ctx.fill();
  ctx.stroke();
  if (kind === "bomb") {
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.moveTo(4, -18);
    ctx.lineTo(-11, 3);
    ctx.lineTo(-1, 3);
    ctx.lineTo(-5, 17);
    ctx.lineTo(12, -4);
    ctx.lineTo(2, -4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#a64b32";
    ctx.beginPath();
    ctx.moveTo(6, -radius);
    ctx.quadraticCurveTo(12, -radius - 19, 25, -radius - 14);
    ctx.stroke();
    circle(ctx, 26, -radius - 13, 7);
    ctx.fill();
  } else {
    ctx.fillStyle = "#69cc53";
    ctx.beginPath();
    ctx.ellipse(8, -radius + 1, 13, 6, -0.48, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = shine;
    ctx.beginPath();
    ctx.arc(0, 0, radius - 9, 3.28, 4.24);
    ctx.stroke();
  }
  ctx.restore();
}

export const BOMB_BLAST_MS = 480;
export function sliceBurstDuration(kind: SliceItem["kind"]) {
  return kind === "bomb" ? BOMB_BLAST_MS : 300;
}

function blastShape(
  ctx: CanvasRenderingContext2D,
  radius: number,
  rotation = 0,
) {
  ctx.beginPath();
  for (let i = 0; i < 20; i++) {
    const angle = (i * Math.PI) / 10 + rotation;
    const distance = radius * (i % 2 ? 0.64 : 1 + (i % 3) * 0.09);
    ctx.lineTo(Math.cos(angle) * distance, Math.sin(angle) * distance);
  }
  ctx.closePath();
}

function drawBombBlast(
  ctx: CanvasRenderingContext2D,
  item: SliceItem,
  progress: number,
  reducedMotion: boolean,
) {
  const expansion = 1 - (1 - progress) ** 3;
  const radius = reducedMotion ? 58 : 31 + 46 * expansion;
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.globalAlpha = reducedMotion ? 1 : Math.min(1, (1 - progress) * 2);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (!reducedMotion) {
    ctx.strokeStyle = "#b44124";
    ctx.lineWidth = 4;
    circle(ctx, 0, 0, 36 + 82 * expansion);
    ctx.stroke();
    ctx.strokeStyle = "#f45c39";
    ctx.lineWidth = 5;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4 + 0.23;
      const start = radius * 1.05 + 19 * expansion;
      const end = start + 13 + (i % 3) * 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * start, Math.sin(angle) * start);
      ctx.lineTo(Math.cos(angle) * end, Math.sin(angle) * end);
      ctx.stroke();
    }
  }

  ctx.fillStyle = "#ff703b";
  ctx.strokeStyle = "#171512";
  ctx.lineWidth = 5;
  blastShape(ctx, radius);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffe64d";
  blastShape(ctx, radius * 0.65, Math.PI / 10);
  ctx.fill();
  ctx.fillStyle = "#fff5c5";
  blastShape(ctx, radius * 0.31);
  ctx.fill();
  ctx.restore();
}

export type SliceBurst = { item: SliceItem; born: number };
export type SliceTrail = { points: Point2D[]; born: number };
export function drawSlice(
  ctx: CanvasRenderingContext2D,
  items: SliceItem[],
  cursor: Point2D | null,
  trail: SliceTrail | null,
  bursts: SliceBurst[],
  now: number,
  reducedMotion: boolean,
) {
  ctx.clearRect(0, 0, SLICE_WIDTH, SLICE_HEIGHT);
  for (const item of items) drawItem(ctx, item);
  for (const { item, born } of bursts) {
    const progress = Math.max(0, now - born) / sliceBurstDuration(item.kind);
    if (progress >= 1) continue;
    if (item.kind === "bomb") {
      drawBombBlast(ctx, item, progress, reducedMotion);
      continue;
    }
    ctx.globalAlpha = 1 - progress;
    ctx.fillStyle = palette[item.kind][0];
    ctx.strokeStyle = "#171512";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const r = item.radius * (0.65 + progress * 1.8);
      circle(
        ctx,
        item.x + Math.cos(angle) * r,
        item.y + Math.sin(angle) * r,
        7,
      );
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  if (trail && now - trail.born < 150) {
    ctx.globalAlpha = 1 - (now - trail.born) / 150;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(trail.points[0].x, trail.points[0].y);
    for (const point of trail.points.slice(1)) ctx.lineTo(point.x, point.y);
    ctx.strokeStyle = "#d93387";
    ctx.lineWidth = 12;
    ctx.stroke();
    ctx.strokeStyle = "#fffdf4";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (cursor) {
    ctx.strokeStyle = "#171512";
    ctx.lineWidth = 3;
    ctx.fillStyle = "#fff4af";
    circle(ctx, cursor.x, cursor.y, 9);
    ctx.fill();
    ctx.stroke();
  }
}
