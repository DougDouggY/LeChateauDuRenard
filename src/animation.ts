import type { Defender } from "./types";
export const ARCHER_ROWS = [
  { y: 35, h: 412 },
  { y: 450, h: 381 },
  { y: 831, h: 399 },
];
/** Animation is driven by distance actually travelled, not elapsed wall time. */
export function archerFrame(actor: Defender): number {
  return actor.moving && actor.dead <= 0 && actor.mounted === null
    ? Math.floor(actor.walk) % 4
    : 0;
}
