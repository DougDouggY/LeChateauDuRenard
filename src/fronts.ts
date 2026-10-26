import type { Simulation } from "./simulation";
import { FORT } from "./map";
import { distance, type Vec, type Side } from "./types";
export const FRONT_COLORS = ["#8fc7d9", "#e3bb75", "#dc987e", "#baacd9"];
export const DEFENSE_POSTS: Vec[] = [
  { x: 1200, y: 590 },
  { x: 1770, y: 1100 },
  { x: 1200, y: 1610 },
  { x: 630, y: 1100 },
];
export const SECTOR_BANDS = [
  { x: 575, y: 525, w: 1250, h: 160 },
  { x: 1665, y: 535, w: 165, h: 1130 },
  { x: 575, y: 1515, w: 1250, h: 160 },
  { x: 570, y: 535, w: 165, h: 1130 },
];
export interface FrontState {
  side: Side;
  enemies: number;
  integrity: number;
  breaches: number;
  incoming: boolean;
  active: boolean;
  defenders: number;
  urgency: number;
}
export function nearRampart(p: Vec): boolean {
  return (
    Math.min(
      Math.abs(p.x - FORT.left),
      Math.abs(p.x - FORT.right),
      Math.abs(p.y - FORT.top),
      Math.abs(p.y - FORT.bottom),
    ) < 190
  );
}
export function frontState(g: Simulation): FrontState[] {
  const states: FrontState[] = ([0, 1, 2, 3] as Side[]).map((side) => ({
    side,
    enemies: 0,
    integrity: 1,
    breaches: 0,
    incoming: false,
    active: false,
    defenders: 0,
    urgency: 0,
  }));
  const health = [0, 0, 0, 0],
    maximum = [0, 0, 0, 0];
  for (const e of g.enemies) if (e.hp > 0) states[e.side].enemies++;
  for (const w of g.walls) {
    health[w.side] += w.hp;
    maximum[w.side] += w.maxHp;
    if (w.hp <= 0) states[w.side].breaches++;
  }
  for (const d of g.defenders)
    if (d.dead <= 0 && nearRampart(d)) states[d.side].defenders++;
  for (const f of states) {
    f.integrity = maximum[f.side] ? health[f.side] / maximum[f.side] : 1;
    f.incoming =
      g.phase === "assault" && g.spawnLeft > 0 && g.fronts.includes(f.side);
    f.active = g.phase === "assault" && (f.enemies > 0 || f.incoming);
    f.urgency =
      f.enemies * 2 + f.breaches * 6 + (f.incoming ? 1 : 0) - f.defenders * 2;
  }
  return states;
}
export function priorityFront(
  g: Simulation,
  states = frontState(g),
): FrontState | null {
  let best: FrontState | null = null,
    bestScore = -Infinity;
  for (const f of states)
    if (f.active) {
      const score =
        f.urgency - distance(g.player, DEFENSE_POSTS[f.side]) / 1000;
      if (score > bestScore) {
        bestScore = score;
        best = f;
      }
    }
  return best;
}
