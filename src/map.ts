import { type Vec, type Wall, type Side, clamp, distance } from "./types";
export const WORLD = { w: 2400, h: 2200 };
export const FORT = {
  left: 530,
  right: 1870,
  top: 490,
  bottom: 1710,
  band: 126,
};
export const STAIRS = [
  { x: 1200, y: 656, side: 0 },
  { x: 1704, y: 1100, side: 1 },
  { x: 1200, y: 1544, side: 2 },
  { x: 696, y: 1100, side: 3 },
];
export const STOCKS = [
  { x: 840, y: 840 },
  { x: 1560, y: 840 },
  { x: 840, y: 1360 },
  { x: 1560, y: 1360 },
];
export const POSTS: Vec[] = [
  { x: 970, y: 552 },
  { x: 1430, y: 552 },
  { x: 1808, y: 890 },
  { x: 1808, y: 1310 },
  { x: 970, y: 1648 },
  { x: 1430, y: 1648 },
  { x: 592, y: 890 },
  { x: 592, y: 1310 },
];
export function makeWalls(): Wall[] {
  const a: Wall[] = [];
  for (let s = 0; s < 4; s++)
    for (let i = 0; i < 5; i++) {
      const horizontal = s === 0 || s === 2,
        len = horizontal ? 1340 : 1220;
      const x = horizontal ? 530 + ((i + 0.5) * len) / 5 : s === 1 ? 1870 : 530;
      const y = horizontal
        ? s === 0
          ? 490
          : 1710
        : 490 + ((i + 0.5) * len) / 5;
      a.push({
        id: a.length,
        side: s as Side,
        x,
        y,
        w: horizontal ? len / 5 : 24,
        h: horizontal ? 24 : len / 5,
        hp: i === 2 ? 650 : 850,
        maxHp: i === 2 ? 650 : 850,
        gate: i === 2,
      });
    }
  return a;
}
export function elevation(p: Vec): number {
  const d = Math.min(p.x - 530, 1870 - p.x, p.y - 490, 1710 - p.y);
  if (d < 0) return 0;
  return 52 * clamp((174 - d) / 48, 0, 1);
}
export function blocked(
  p: Vec,
  r: number,
  walls: Wall[],
  large = false,
): boolean {
  if (p.x < 40 + r || p.y < 40 + r || p.x > 2360 - r || p.y > 2160 - r)
    return true;
  if (p.x > 1370 - r && p.x < 1535 + r && p.y > 720 - r && p.y < 815 + r)
    return true;
  for (const o of [
    { x: 1000, y: 800, r: 43 },
    { x: 900, y: 1030, r: 60 },
    { x: 1510, y: 1220, r: 60 },
  ])
    if (distance(p, o) < o.r + r) return true;
  for (const w of walls)
    if (
      w.hp > 0 &&
      Math.abs(p.x - w.x) < w.w / 2 + r &&
      Math.abs(p.y - w.y) < w.h / 2 + r
    )
      return true;
  // Low inner retaining walls force defenders through the four real stairways.
  const inner = { l: 656, r: 1744, t: 616, b: 1584 };
  const stairWidth = large ? 0 : 76;
  if (p.x > inner.l - r && p.x < inner.r + r) {
    if (
      (Math.abs(p.y - inner.t) < 14 + r || Math.abs(p.y - inner.b) < 14 + r) &&
      Math.abs(p.x - 1200) > stairWidth
    )
      return true;
    if (
      large &&
      (Math.abs(p.y - inner.t) < 14 + r || Math.abs(p.y - inner.b) < 14 + r)
    )
      return true;
  }
  if (p.y > inner.t - r && p.y < inner.b + r) {
    if (
      (Math.abs(p.x - inner.l) < 14 + r || Math.abs(p.x - inner.r) < 14 + r) &&
      Math.abs(p.y - 1100) > 104
    )
      return true;
  }
  return false;
}
export function move(
  p: Vec,
  dx: number,
  dy: number,
  r: number,
  walls: Wall[],
  large = false,
): boolean {
  const before = { ...p };
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 8));
  for (let n = 0; n < steps; n++) {
    if (!blocked({ x: p.x + dx / steps, y: p.y }, r, walls, large))
      p.x += dx / steps;
    if (!blocked({ x: p.x, y: p.y + dy / steps }, r, walls, large))
      p.y += dy / steps;
  }
  return distance(before, p) > 0.1;
}
export function findPath(
  start: Vec,
  end: Vec,
  walls: Wall[],
  radius = 17,
): Vec[] {
  const cell = 40,
    cols = 60,
    rows = 55;
  const key = (x: number, y: number) => y * cols + x;
  const from = {
    x: clamp(Math.round(start.x / cell), 1, cols - 2),
    y: clamp(Math.round(start.y / cell), 1, rows - 2),
  };
  const goal = {
    x: clamp(Math.round(end.x / cell), 1, cols - 2),
    y: clamp(Math.round(end.y / cell), 1, rows - 2),
  };
  const origin = key(from.x, from.y),
    target = key(goal.x, goal.y),
    open = [origin],
    came = new Map<number, number>(),
    g = new Map([[origin, 0]]),
    closed = new Set<number>();
  const h = (id: number) =>
    Math.abs((id % cols) - goal.x) + Math.abs(Math.floor(id / cols) - goal.y);
  let best = origin;
  for (let n = 0; open.length && n < 3300; n++) {
    let idx = 0;
    for (let j = 1; j < open.length; j++)
      if (g.get(open[j])! + h(open[j]) < g.get(open[idx])! + h(open[idx]))
        idx = j;
    const curr = open.splice(idx, 1)[0];
    if (h(curr) < h(best)) best = curr;
    if (curr === target) {
      best = curr;
      break;
    }
    closed.add(curr);
    const x = curr % cols,
      y = Math.floor(curr / cols);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        id = key(nx, ny);
      if (
        nx < 1 ||
        ny < 1 ||
        nx >= cols - 1 ||
        ny >= rows - 1 ||
        closed.has(id) ||
        blocked({ x: nx * cell, y: ny * cell }, radius, walls)
      )
        continue;
      const cost = g.get(curr)! + 1;
      if (cost < (g.get(id) ?? Infinity)) {
        came.set(id, curr);
        g.set(id, cost);
        if (!open.includes(id)) open.push(id);
      }
    }
  }
  const path: Vec[] = [];
  let cur = best;
  while (cur !== origin && came.has(cur)) {
    path.unshift({ x: (cur % cols) * cell, y: Math.floor(cur / cols) * cell });
    cur = came.get(cur)!;
  }
  if (best === target && !blocked(end, radius, walls)) path.push({ ...end });
  return path;
}
export function segmentDistance(a: Vec, b: Vec, p: Vec): number {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = clamp(
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      0,
      1,
    );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
