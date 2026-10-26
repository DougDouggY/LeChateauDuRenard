import type { Projectile } from "./types";
import { clamp } from "./types";
import { FLOOR_HEIGHT, FORT } from "./map";

/** Shared height calculation keeps visual arcs and parapet collision consistent. */
export function projectileHeight(q: Projectile): number {
  const progress = clamp(1 - q.life / q.total, 0, 1);
  const arc = q.kind === "fire" ? 90 : 28;
  const height =
    q.startZ * (1 - progress) +
    q.endZ * progress +
    Math.sin(progress * Math.PI) * arc;
  // Archers stand on one continuous raised platform. Their arrows cannot dive
  // into its paving or hit its parapet before leaving the outer edge.
  const overPlatform =
    q.x >= FORT.left - 24 &&
    q.x <= FORT.right + 24 &&
    q.y >= FORT.top - 24 &&
    q.y <= FORT.bottom + 24;
  return q.team === "ally" && q.startZ >= FLOOR_HEIGHT && overPlatform
    ? Math.max(FLOOR_HEIGHT + 19, height)
    : height;
}
