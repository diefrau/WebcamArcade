export type CirclePoint = { x: number; y: number; move?: boolean };

/** Measure the visible 1000 × 650 canvas, never a jump across a missing stroke. */
export function isCircleClosed(points: readonly CirclePoint[]): boolean {
  if (points.length < 24 || points.at(-1)?.move) return false;
  const pixels = points.map((p) => ({
    x: p.x * 1000,
    y: p.y * 650,
    move: p.move,
  }));
  if (pixels.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
    return false;
  const xs = pixels.map((p) => p.x),
    ys = pixels.map((p) => p.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  if (width < 60 || height < 60) return false;
  const diagonal = Math.hypot(width, height);
  const tolerance = Math.max(14, Math.min(30, diagonal * 0.06));
  const start = pixels[0],
    end = pixels[pixels.length - 1];
  const previous = pixels[pixels.length - 2];
  const dx = end.x - previous.x,
    dy = end.y - previous.y;
  const segmentSquared = dx * dx + dy * dy;
  const along = segmentSquared
    ? Math.max(
        0,
        Math.min(
          1,
          ((start.x - previous.x) * dx + (start.y - previous.y) * dy) /
            segmentSquared,
        ),
      )
    : 1;
  // A fast hand can pass the start between samples; the visible segment closes it.
  if (
    Math.hypot(
      start.x - previous.x - along * dx,
      start.y - previous.y - along * dy,
    ) > tolerance
  )
    return false;
  let length = 0,
    area = 0;
  for (let i = 1; i < pixels.length; i++) {
    const a = pixels[i - 1],
      b = pixels[i];
    const segment = Math.hypot(a.x - b.x, a.y - b.y);
    if (b.move) {
      // A tiny join can still be visibly connected; larger gaps are not drawn.
      if (segment > 12) return false;
    } else {
      length += segment;
    }
    area += a.x * b.y - b.x * a.y;
  }
  area += end.x * start.y - start.x * end.y;
  return (
    length >= Math.max(240, diagonal * 2) &&
    Math.abs(area) / 2 >= width * height * 0.25
  );
}
