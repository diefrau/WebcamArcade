import type { Point2D } from "../visionTypes";
export const mirrored = (p: Point2D): Point2D => ({ x: 1 - p.x, y: p.y });
export const toViewport = (
  p: Point2D,
  width: number,
  height: number,
): Point2D => ({ x: p.x * width, y: p.y * height });
