import type { Point2D } from "../vision/visionTypes";
import { BUBBLE_ROW_SECONDS, BUBBLE_SHOTS, type BubbleMode } from "./bubbleConfig";

export const BUBBLE_RADIUS = 28;
export const BUBBLE_WIDTH = 504;
export const BUBBLE_HEIGHT = 600;
export const BUBBLE_ANGLE_LIMIT = Math.PI / 3;
const nextRowInterval = (random = Math.random) => 1 + Math.floor(random() * 3);
export const LAUNCHER = { x: BUBBLE_WIDTH / 2, y: BUBBLE_HEIGHT - 39 };
const TOP = 35;
const ROWS = 10;
export const BUBBLE_ROW_RISE = Math.sqrt(3) * BUBBLE_RADIUS;
const SPEED = 980;

const bubbleColors = [0, 1, 2, 3] as const;
export type BubbleColor = (typeof bubbleColors)[number];
export type BubbleCell = { row: number; col: number };
export type BubbleBoard = (BubbleColor | null)[][];
export type ShotPath = { points: Point2D[]; hit: BubbleCell | null };
type BubbleFlight = {
  path: ShotPath;
  segment: number;
  at: Point2D;
  color: BubbleColor;
};
export type BubbleBurst = { at: Point2D; color: BubbleColor; fallen: boolean };
export type BubbleRound = {
  mode: BubbleMode;
  board: BubbleBoard;
  revision: number;
  flight: BubbleFlight | null;
  lowered: boolean;
  shotsUntilRow: number;
  secondsUntilRow: number;
  shotsFired: number;
  color: BubbleColor;
  next: BubbleColor;
  shotsLeft: number;
  popped: number;
  matches: number;
  score: number;
  outcome: "clear" | "over" | null;
};

const layout = ["002211330", "02211330", "330022110"];
const columns = (row: number) => (row % 2 === 0 ? 9 : 8);
const cellKey = ({ row, col }: BubbleCell) => row * 9 + col;
export function bubbleCellPoint(
  board: BubbleBoard,
  { row, col }: BubbleCell,
): Point2D {
  return {
    x: BUBBLE_RADIUS * (1 + col * 2 + Number(board[row].length === 8)),
    y: TOP + row * BUBBLE_ROW_RISE,
  };
}

export function bubbleNeighbors(
  board: BubbleBoard,
  { row, col }: BubbleCell,
): BubbleCell[] {
  const diagonal = col + (board[row].length === 8 ? 1 : -1);
  return [
    { row, col: col - 1 },
    { row, col: col + 1 },
    { row: row - 1, col },
    { row: row - 1, col: diagonal },
    { row: row + 1, col },
    { row: row + 1, col: diagonal },
  ].filter(
    (cell) =>
      cell.row >= 0 &&
      cell.row < board.length &&
      cell.col >= 0 &&
      cell.col < board[cell.row].length,
  );
}

function nextColor(board: BubbleBoard, random = Math.random): BubbleColor {
  const choices = new Set<BubbleColor>();
  for (const row of board)
    for (const color of row) if (color !== null) choices.add(color);
  return Array.from(choices)[Math.floor(random() * choices.size)] ?? 0;
}

function dangerColor(board: BubbleBoard, random: () => number): BubbleColor | undefined {
  // The last row ends the round, so check the two playable rows above it.
  for (const row of board.slice(-3, -1).reverse()) {
    const colors = [...new Set(row.filter((color) => color !== null))];
    if (colors.length) return colors[Math.floor(random() * colors.length)];
  }
}

export function newBubbleRound(mode: BubbleMode = "standard"): BubbleRound {
  const board: BubbleBoard = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: columns(row) }, (_, col) =>
      layout[row] ? (Number(layout[row][col]) as BubbleColor) : null,
    ),
  );
  return {
    mode,
    board,
    revision: 0,
    flight: null,
    lowered: false,
    shotsUntilRow: nextRowInterval(),
    secondsUntilRow: BUBBLE_ROW_SECONDS,
    shotsFired: 0,
    color: 2,
    next: nextColor(board),
    shotsLeft: mode === "standard" ? BUBBLE_SHOTS : Infinity,
    popped: 0,
    matches: 0,
    score: 0,
    outcome: null,
  };
}

export const clampBubbleAngle = (angle: number) =>
  Math.max(-BUBBLE_ANGLE_LIMIT, Math.min(BUBBLE_ANGLE_LIMIT, angle));

/** Trace both the visible guide and the actual shot against the same expanded circles. */
export function traceBubble(board: BubbleBoard, angle: number): ShotPath {
  const aim = clampBubbleAngle(angle);
  let dx = Math.sin(aim);
  const dy = -Math.cos(aim);
  let at = LAUNCHER;
  const points = [at];
  for (let bounce = 0; bounce < 5; bounce++) {
    const ceiling = (TOP - at.y) / dy;
    const wall =
      dx > 0.0001
        ? (BUBBLE_WIDTH - BUBBLE_RADIUS - at.x) / dx
        : dx < -0.0001
          ? (BUBBLE_RADIUS - at.x) / dx
          : Infinity;
    let distance = Math.min(ceiling, wall);
    let hit: BubbleCell | null = null;
    for (let row = 0; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        if (board[row][col] === null) continue;
        const cell = { row, col };
        const target = bubbleCellPoint(board, cell);
        const x = target.x - at.x;
        const y = target.y - at.y;
        const along = x * dx + y * dy;
        const perpendicular = x * dy - y * dx;
        const discriminant = (2 * BUBBLE_RADIUS) ** 2 - perpendicular ** 2;
        if (along <= 0 || discriminant < 0) continue;
        const crossing = Math.max(0, along - Math.sqrt(discriminant));
        if (crossing <= distance) {
          distance = crossing;
          hit = cell;
        }
      }
    }
    at = { x: at.x + dx * distance, y: at.y + dy * distance };
    points.push(at);
    if (hit || ceiling <= wall) return { points, hit };
    dx = -dx;
  }
  return { points, hit: null };
}

export function launchBubble(round: BubbleRound, angle: number) {
  if (round.flight || round.outcome || round.shotsLeft <= 0) return false;
  round.flight = {
    color: round.color,
    path: traceBubble(round.board, angle),
    segment: 1,
    at: LAUNCHER,
  };
  round.shotsLeft--;
  round.shotsFired++;
  return true;
}

function flood(
  board: BubbleBoard,
  starts: BubbleCell[],
  accepts: (color: BubbleColor | null) => boolean,
) {
  const visit = [...starts];
  const seen = new Set(starts.map(cellKey));
  for (let i = 0; i < visit.length; i++) {
    for (const cell of bubbleNeighbors(board, visit[i])) {
      const key = cellKey(cell);
      if (seen.has(key) || !accepts(board[cell.row][cell.col])) continue;
      seen.add(key);
      visit.push(cell);
    }
  }
  return { visit, seen };
}

function snapCell(board: BubbleBoard, path: ShotPath): BubbleCell | null {
  const at = path.points.at(-1)!;
  const candidates = path.hit
    ? bubbleNeighbors(board, path.hit)
    : board[0].map((_, col) => ({ row: 0, col }));
  let nearest: BubbleCell | null = null;
  let nearestDistance = Infinity;
  for (const cell of candidates) {
    if (board[cell.row][cell.col] !== null) continue;
    const p = bubbleCellPoint(board, cell);
    const distance = Math.hypot(at.x - p.x, at.y - p.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = cell;
    }
  }
  return nearest;
}

function addCeilingRow(board: BubbleBoard, random: () => number) {
  // Keep the existing rows' zigzag alignment as they shift down.
  const width = board[0].length === 9 ? 8 : 9;
  const groupOrder = [...bubbleColors];
  const extraColor = width === 9
    ? bubbleColors[Math.floor(random() * bubbleColors.length)]
    : null;
  for (let i = groupOrder.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [groupOrder[i], groupOrder[j]] = [groupOrder[j], groupOrder[i]];
  }
  const nextRow = groupOrder.flatMap((color) =>
    color === extraColor ? [color, color, color] : [color, color],
  );
  board.pop();
  board.unshift(nextRow);
}

function lowerRow(round: BubbleRound, random: () => number) {
  addCeilingRow(round.board, random);
  round.lowered = true;
  if (round.board.at(-1)!.some((color) => color !== null))
    round.outcome = "over";
}

function loadColors(round: BubbleRound, random: () => number) {
  const { board } = round;
  const urgentColor = dangerColor(board, random);
  round.color = urgentColor ?? (board.some((row) => row.includes(round.next))
    ? round.next
    : nextColor(board, random));
  round.next = urgentColor ?? nextColor(board, random);
}

export function advanceBubbleRowClock(
  round: BubbleRound,
  dt: number,
  random = Math.random,
) {
  if (round.mode !== "time-attack" || round.outcome) return false;
  round.secondsUntilRow -= dt;
  // Finish the current shot against the same board it was aimed at.
  if (round.secondsUntilRow > 0 || round.flight) return false;
  round.secondsUntilRow += BUBBLE_ROW_SECONDS;
  round.revision++;
  lowerRow(round, random);
  return true;
}

function land(
  round: BubbleRound,
  shot: BubbleFlight,
  random: () => number,
): BubbleBurst[] {
  const { board } = round;
  round.lowered = false;
  round.revision++;
  const cell = snapCell(board, shot.path);
  if (!cell) {
    round.outcome = "over";
    return [];
  }
  board[cell.row][cell.col] = shot.color;
  const cluster = flood(board, [cell], (color) => color === shot.color).visit;
  const bursts: BubbleBurst[] = [];
  function remove({ row, col }: BubbleCell, fallen: boolean) {
    const color = board[row][col];
    if (color === null) return;
    bursts.push({ at: bubbleCellPoint(board, { row, col }), color, fallen });
    board[row][col] = null;
    round.score += fallen ? 15 : 10;
  }
  if (cluster.length >= 3) {
    round.matches++;
    for (const part of cluster) remove(part, false);
    const ceiling = board[0].flatMap((color, col) =>
      color === null ? [] : [{ row: 0, col }],
    );
    const attached = flood(board, ceiling, (color) => color !== null).seen;
    for (let row = 1; row < board.length; row++) {
      for (let col = 0; col < board[row].length; col++) {
        if (!attached.has(cellKey({ row, col }))) remove({ row, col }, true);
      }
    }
  }
  round.popped += bursts.length;
  if (round.mode !== "time-attack") round.shotsUntilRow--;
  if (!board.some((row) => row.some((color) => color !== null))) {
    round.score += 50;
    round.outcome = "clear";
  } else if (board.at(-1)!.some((color) => color !== null))
    round.outcome = "over";
  else {
    if (round.mode !== "time-attack" && round.shotsUntilRow === 0 && round.shotsLeft > 0) {
      lowerRow(round, random);
      round.shotsUntilRow = nextRowInterval(random);
    }
    if (!round.shotsLeft)
      round.outcome = "over";
    if (!round.outcome) loadColors(round, random);
  }
  return bursts;
}

export function advanceBubble(
  round: BubbleRound,
  dt: number,
  random = Math.random,
): BubbleBurst[] | null {
  const shot = round.flight;
  if (!shot) return null;
  let travel = Math.max(dt, 0) * SPEED;
  while (shot.segment < shot.path.points.length) {
    const end = shot.path.points[shot.segment];
    const x = end.x - shot.at.x;
    const y = end.y - shot.at.y;
    const distance = Math.hypot(x, y);
    if (travel < distance) {
      shot.at = {
        x: shot.at.x + (x * travel) / distance,
        y: shot.at.y + (y * travel) / distance,
      };
      return null;
    }
    shot.at = end;
    shot.segment++;
    travel -= distance;
  }
  round.flight = null;
  return land(round, shot, random);
}
