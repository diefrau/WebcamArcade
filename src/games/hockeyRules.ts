import type { Point2D } from "../vision/visionTypes";
import { HOCKEY_SECONDS } from "./hockeyConfig";

export const HOCKEY_WIDTH = 960;
export const HOCKEY_HEIGHT = 540;
export const HOCKEY_STEP = 1 / 120;
export const MALLET_RADIUS = 43;
export const CPU_MALLET_RADIUS = 38;
export const PUCK_RADIUS = 17;
export const GOAL_HALF_HEIGHT = 88;
export const CPU_GOAL_HALF_HEIGHT = 108;
export const HOCKEY_CENTER = { x: HOCKEY_WIDTH / 2, y: HOCKEY_HEIGHT / 2 };
export const PLAYER_HOME = { x: HOCKEY_WIDTH / 4, y: HOCKEY_CENTER.y };
const CPU_HOME = { x: (HOCKEY_WIDTH * 3) / 4, y: HOCKEY_CENTER.y };
const CPU_SPEED = 300;
const CPU_REACTION_INTERVAL = 0.34;
const SERVE_DELAY = 0.7;
const MAX_PUCK_SPEED = 1100;
const MAX_MALLET_CONTACT = 5;
const CONTACT_MARGIN = 3;
const CLEARANCE_MARGIN = 8;

type Side = "player" | "cpu";
type Disc = Point2D & { vx: number; vy: number };
export type HockeyEvent = "hit" | Side | null;
export type HockeyState = {
  elapsed: number;
  players: Record<Side, Disc>;
  puck: Disc;
  score: Record<Side, number>;
  serveIn: number;
  serveDirection: -1 | 1;
  cpuTarget: Point2D;
  cpuThinkIn: number;
  contactSeconds: Record<Side, number>;
};
const disc = (center: Point2D): Disc => ({ ...center, vx: 0, vy: 0 });
export const clampHockey = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

export function hockeyMalletTarget(point: Point2D, side: Side): Point2D {
  const padding = MALLET_RADIUS + 6;
  return {
    x:
      side === "player"
        ? clampHockey(point.x, padding, HOCKEY_CENTER.x - padding)
        : clampHockey(
            point.x,
            HOCKEY_CENTER.x + padding,
            HOCKEY_WIDTH - padding,
          ),
    y: clampHockey(point.y, padding, HOCKEY_HEIGHT - padding),
  };
}

export function newHockey(): HockeyState {
  return {
    elapsed: 0,
    players: { player: disc(PLAYER_HOME), cpu: disc(CPU_HOME) },
    puck: disc(HOCKEY_CENTER),
    score: { player: 0, cpu: 0 },
    serveIn: SERVE_DELAY,
    serveDirection: -1,
    cpuTarget: CPU_HOME,
    cpuThinkIn: 0,
    contactSeconds: { player: 0, cpu: 0 },
  };
}

function moveMallet(body: Disc, goal: Point2D, speed: number, dt: number) {
  const dx = goal.x - body.x;
  const dy = goal.y - body.y;
  const distance = Math.hypot(dx, dy);
  const scale = distance
    ? Math.min(1 - Math.exp(-dt / 0.047), (speed * dt) / distance)
    : 0;
  body.vx = (dx * scale) / dt;
  body.vy = (dy * scale) / dt;
  body.x += dx * scale;
  body.y += dy * scale;
}

function cpuTarget(state: HockeyState): Point2D {
  const { puck, elapsed } = state;
  const error = Math.sin(elapsed * 2.4 + 0.3) * 41;
  const incomingShot = puck.vx > 300;
  if (puck.x < HOCKEY_CENTER.x || state.serveIn > 0 || incomingShot) {
    return {
      x: CPU_HOME.x,
      y: HOCKEY_CENTER.y + (puck.y - HOCKEY_CENTER.y) * 0.24 + error,
    };
  }
  return {
    x: puck.x + 65,
    y: puck.y + error * 0.65,
  };
}

function bounceFromMallet(state: HockeyState, side: Side, dt: number) {
  const { puck, contactSeconds } = state;
  const mallet = state.players[side];
  const dx = puck.x - mallet.x;
  const dy = puck.y - mallet.y;
  const distance = Math.hypot(dx, dy);
  const touch =
    (side === "cpu" ? CPU_MALLET_RADIUS : MALLET_RADIUS) + PUCK_RADIUS;
  const wasPassing = contactSeconds[side] >= MAX_MALLET_CONTACT;
  const margin = wasPassing ? CLEARANCE_MARGIN : CONTACT_MARGIN;
  if (distance > touch + margin) {
    contactSeconds[side] = 0;
    return false;
  }

  contactSeconds[side] = Math.min(
    MAX_MALLET_CONTACT,
    contactSeconds[side] + dt,
  );
  if (contactSeconds[side] >= MAX_MALLET_CONTACT - 1e-9) {
    contactSeconds[side] = MAX_MALLET_CONTACT;
    if (!wasPassing) {
      // A puck wedged against two rails may have no velocity left to escape.
      const inwardX = HOCKEY_CENTER.x - puck.x;
      const inwardY = HOCKEY_CENTER.y - puck.y;
      const length = Math.hypot(inwardX, inwardY);
      const speed = Math.max(320, Math.hypot(puck.vx, puck.vy));
      puck.vx = length
        ? (inwardX / length) * speed
        : side === "player"
          ? -speed
          : speed;
      puck.vy = length ? (inwardY / length) * speed : 0;
    }
    return false;
  }
  if (distance >= touch) return false;

  const nx = distance > 0.001 ? dx / distance : side === "player" ? 1 : -1;
  const ny = distance > 0.001 ? dy / distance : 0;
  puck.x = mallet.x + nx * (touch + 0.1);
  puck.y = mallet.y + ny * (touch + 0.1);
  const normalSpeed = (puck.vx - mallet.vx) * nx + (puck.vy - mallet.vy) * ny;
  if (normalSpeed >= 0) return false;
  const impulse = -normalSpeed * 1.91;
  puck.vx += impulse * nx;
  puck.vy += impulse * ny;
  const speed = Math.hypot(puck.vx, puck.vy);
  if (speed > MAX_PUCK_SPEED) {
    puck.vx *= MAX_PUCK_SPEED / speed;
    puck.vy *= MAX_PUCK_SPEED / speed;
  }
  return impulse > 60;
}

function rails(puck: Disc): Side | null {
  if (puck.y < PUCK_RADIUS || puck.y > HOCKEY_HEIGHT - PUCK_RADIUS) {
    puck.y = clampHockey(puck.y, PUCK_RADIUS, HOCKEY_HEIGHT - PUCK_RADIUS);
    puck.vy = Math.abs(puck.vy) * (puck.y === PUCK_RADIUS ? 0.95 : -0.95);
  }
  const goalHalfHeight =
    puck.x < HOCKEY_CENTER.x ? GOAL_HALF_HEIGHT : CPU_GOAL_HALF_HEIGHT;
  const inGoal =
    Math.abs(puck.y - HOCKEY_CENTER.y) <= goalHalfHeight - PUCK_RADIUS;
  if (inGoal) {
    if (puck.x <= -PUCK_RADIUS) return "cpu";
    if (puck.x >= HOCKEY_WIDTH + PUCK_RADIUS) return "player";
  } else if (puck.x < PUCK_RADIUS || puck.x > HOCKEY_WIDTH - PUCK_RADIUS) {
    puck.x = clampHockey(puck.x, PUCK_RADIUS, HOCKEY_WIDTH - PUCK_RADIUS);
    puck.vx = Math.abs(puck.vx) * (puck.x === PUCK_RADIUS ? 0.95 : -0.95);
  }
  return null;
}

export function stepHockey(
  state: HockeyState,
  aim: Point2D,
  dt = HOCKEY_STEP,
): HockeyEvent {
  if (dt <= 0 || state.elapsed >= HOCKEY_SECONDS) return null;
  state.elapsed = Math.min(HOCKEY_SECONDS, state.elapsed + dt);
  moveMallet(state.players.player, hockeyMalletTarget(aim, "player"), 1080, dt);
  state.cpuThinkIn -= dt;
  if (state.cpuThinkIn <= 0) {
    state.cpuTarget = hockeyMalletTarget(cpuTarget(state), "cpu");
    state.cpuThinkIn = CPU_REACTION_INTERVAL;
  }
  moveMallet(state.players.cpu, state.cpuTarget, CPU_SPEED, dt);

  const puck = state.puck;
  if (state.serveIn > 0) {
    state.serveIn = Math.max(0, state.serveIn - dt);
    if (state.serveIn === 0) {
      puck.vx = 405 * state.serveDirection;
      puck.vy = (state.score.player + state.score.cpu) % 2 ? -114 : 114;
    }
    return null;
  }

  puck.x += puck.vx * dt;
  puck.y += puck.vy * dt;
  const playerHit = bounceFromMallet(state, "player", dt);
  const cpuHit = bounceFromMallet(state, "cpu", dt);
  puck.vx *= 1 - 0.095 * dt;
  puck.vy *= 1 - 0.095 * dt;
  const goal = rails(puck);
  if (goal) {
    state.score[goal]++;
    state.puck = disc(HOCKEY_CENTER);
    state.serveIn = SERVE_DELAY;
    state.serveDirection = goal === "player" ? 1 : -1;
    state.contactSeconds.player = 0;
    state.contactSeconds.cpu = 0;
    return goal;
  }
  return playerHit || cpuHit ? "hit" : null;
}
