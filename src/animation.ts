import type { Defender } from "./types";
import { hero } from "./heroes";
/** Calibrated transparent rows: keep boots intact and avoid neighbouring cells. */
export const WALK_ROWS = [
  [
    { y: 22, h: 318 },
    { y: 344, h: 304 },
    { y: 648, h: 307 },
    { y: 955, h: 299 },
  ],
  [
    { y: 15, h: 326 },
    { y: 342, h: 342 },
    { y: 685, h: 299 },
    { y: 984, h: 270 },
  ],
];
export const SHOT_ROWS = [
  [
    { y: 0, h: 328 },
    { y: 329, h: 312 },
    { y: 642, h: 310 },
    { y: 954, h: 300 },
  ],
  [
    { y: 0, h: 333 },
    { y: 335, h: 316 },
    { y: 652, h: 308 },
    { y: 961, h: 293 },
  ],
];
export const ARCHER_ROWS = WALK_ROWS[0];
export function archerFrame(actor: Defender): number {
  return actor.moving && actor.dead <= 0 && actor.mounted === null
    ? Math.floor(actor.walk) % 4
    : 0;
}
export function bowFrame(actor: Defender): number {
  if (actor.shot?.held) return (actor.shot.charge ?? 0) < 0.45 ? 1 : 2;
  if (actor.shot)
    return actor.shot.remaining / actor.shot.duration > 0.6 ? 1 : 2;
  return actor.releaseFlash > 0 ? 3 : 0;
}
export function spriteFrame(actor: Defender) {
  const h = hero(actor.hero),
    shooting =
      !!actor.shot ||
      actor.releaseFlash > 0 ||
      !actor.moving ||
      actor.mounted !== null;
  return {
    group: h.group,
    row: h.row,
    shooting,
    frame: shooting ? bowFrame(actor) : archerFrame(actor),
  };
}
