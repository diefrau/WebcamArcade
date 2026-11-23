import type { Point2D } from "../vision/visionTypes";
import {
  BUBBLE_HEIGHT,
  BUBBLE_RADIUS,
  BUBBLE_ROW_RISE,
  BUBBLE_WIDTH,
  LAUNCHER,
  bubbleCellPoint,
  traceBubble,
  type BubbleBurst,
  type BubbleColor,
  type BubbleRound,
} from "./bubbleRules";

export const BUBBLE_PALETTE = [
  { fill: "#ff72a8", symbol: "●" },
  { fill: "#49d1ff", symbol: "▲" },
  { fill: "#b2ea47", symbol: "◆" },
  { fill: "#cca4ff", symbol: "✦" },
] as const;
const ink = "#181318";
export const POP_MS = 340;
export const BUBBLE_ENTRY_MS = 240;
export type TimedBubbleBurst = BubbleBurst & { born: number };

function circle(ctx: CanvasRenderingContext2D, at: Point2D, radius: number) {
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  at: Point2D,
  color: BubbleColor,
  radius = BUBBLE_RADIUS - 2,
) {
  const { fill, symbol } = BUBBLE_PALETTE[color];
  circle(ctx, { x: at.x + 2, y: at.y + 3 }, radius);
  ctx.fillStyle = ink;
  ctx.fill();
  circle(ctx, at, radius);
  ctx.fillStyle = fill;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3.5;
  ctx.fill();
  ctx.stroke();
  circle(ctx, { x: at.x - radius * 0.4, y: at.y - radius * 0.46 }, 4);
  ctx.fillStyle = "#fffaf4";
  ctx.fill();
  ctx.font = `900 ${Math.round(radius * 0.9)}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = ink;
  ctx.fillText(symbol, at.x, at.y + 2);
}

export class BubbleCanvas {
  private layer: HTMLCanvasElement;
  private revision = -1;
  private guideAngle = NaN;
  private points: Point2D[] = [];

  constructor() {
    this.layer = document.createElement("canvas");
    this.layer.width = BUBBLE_WIDTH;
    this.layer.height = BUBBLE_HEIGHT;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    round: BubbleRound,
    angle: number,
    hold: number,
    bursts: TimedBubbleBurst[],
    now: number,
    showGuide: boolean,
    entryProgress = 1,
  ) {
    if (this.revision !== round.revision) {
      this.revision = round.revision;
      this.guideAngle = NaN;
      const layer = this.layer.getContext("2d")!;
      layer.clearRect(0, 0, BUBBLE_WIDTH, BUBBLE_HEIGHT);
      round.board.forEach((row, r) =>
        row.forEach((color, c) => {
          if (color !== null)
            drawBubble(
              layer,
              bubbleCellPoint(round.board, { row: r, col: c }),
              color,
            );
        }),
      );
    }
    ctx.clearRect(0, 0, BUBBLE_WIDTH, BUBBLE_HEIGHT);

    if (showGuide && !round.flight && !round.outcome) {
      if (
        !Number.isFinite(this.guideAngle) ||
        Math.abs(this.guideAngle - angle) >= 0.003
      ) {
        this.guideAngle = angle;
        this.points = traceBubble(round.board, angle).points;
      }
      ctx.beginPath();
      ctx.moveTo(LAUNCHER.x, LAUNCHER.y);
      for (const point of this.points.slice(1)) ctx.lineTo(point.x, point.y);
      ctx.setLineDash([8, 10]);
      ctx.strokeStyle = "#46315f";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.setLineDash([]);
      for (const point of this.points.slice(1, -1)) {
        circle(ctx, point, 6);
        ctx.fillStyle = "#a66df1";
        ctx.fill();
      }
    }
    const lower = round.lowered
      ? BUBBLE_ROW_RISE * (1 - entryProgress) ** 2
      : 0;
    ctx.drawImage(this.layer, 0, -lower);
    ctx.save();
    ctx.translate(LAUNCHER.x, LAUNCHER.y);
    ctx.rotate(angle);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 4;
    ctx.fillStyle = "#fff7d8";
    ctx.beginPath();
    ctx.roundRect(-16, -49, 32, 58, 12);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (round.flight) drawBubble(ctx, round.flight.at, round.flight.color);
    else if (!round.outcome) drawBubble(ctx, LAUNCHER, round.color);
    if (hold > 0) {
      ctx.beginPath();
      ctx.arc(
        LAUNCHER.x,
        LAUNCHER.y,
        35,
        -Math.PI / 2,
        2 * Math.PI * hold - Math.PI / 2,
      );
      ctx.strokeStyle = "#20814d";
      ctx.lineWidth = 6;
      ctx.stroke();
    }

    for (const burst of bursts) {
      const progress = (now - burst.born) / POP_MS;
      ctx.globalAlpha = 1 - progress;
      const at = {
        x: burst.at.x,
        y: burst.at.y + (burst.fallen ? 125 * progress ** 2 : 0),
      };
      circle(ctx, at, BUBBLE_RADIUS * (0.66 + 0.78 * progress));
      ctx.lineWidth = 6;
      ctx.strokeStyle = BUBBLE_PALETTE[burst.color].fill;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}
