import { test, expect } from "@playwright/test";
import { DrawingCursor } from "../src/vision/DrawingCursor";

test("cursor dampens stationary jitter while catching up to deliberate movement", () => {
  const cursor = new DrawingCursor();
  cursor.update(0.5, 0.5, 0);
  let error = 0;
  for (let i = 1; i <= 40; i++) {
    const point = cursor.update(0.5 + (i % 2 ? 0.01 : -0.01), 0.5, i * 40);
    error += Math.abs(point.x - 0.5);
  }
  expect(error / 40).toBeLessThan(0.004);
  let point = cursor.update(0.8, 0.7, 1640);
  expect(point.x).toBeLessThan(0.8);
  for (let i = 1; i <= 5; i++) point = cursor.update(0.8, 0.7, 1640 + i * 40);
  expect(point.x).toBeGreaterThan(0.79);
  cursor.reset();
  expect(cursor.update(0.1, 0.2, 1900)).toEqual({ x: 0.1, y: 0.2 });
});
