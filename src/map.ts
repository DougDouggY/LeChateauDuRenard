import { type Vec, type Wall, type Side, clamp, distance } from "./types";
export const WORLD = { w: 2400, h: 2200 };
export const FORT = {
  left: 530,
  right: 1870,
  top: 490,
  bottom: 1710,
  band: 126,
};
export const FLOOR_HEIGHT = 52;
export const CENTRAL_STAIR: Vec = { x: 1200, y: 1130 };
export const WORKSHOP_COUNTER: Vec = { x: 1200, y: 1000 };
export const SUPPLY_POSTS: Vec[] = [
  { x: 1200, y: 740 },
  { x: 1610, y: 1100 },
  { x: 1200, y: 1460 },
  { x: 790, y: 1100 },
];
export function insideFort(p: Vec): boolean {
  return (
    p.x >= FORT.left &&
    p.x <= FORT.right &&
    p.y >= FORT.top &&
    p.y <= FORT.bottom
  );
}
export function sideOf(p: Vec): Side {
  const distances = [
    Math.abs(p.y - FORT.top),
    Math.abs(p.x - FORT.right),
    Math.abs(p.y - FORT.bottom),
    Math.abs(p.x - FORT.left),
  ];
  return distances.indexOf(Math.min(...distances)) as Side;
}
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
  return insideFort(p) ? FLOOR_HEIGHT : 0;
}
export function blocked(
  p: Vec,
  r: number,
  walls: Wall[],
  _large = false,
): boolean {
  if (
    p.x < 40 + r ||
    p.y < 40 + r ||
    p.x > WORLD.w - 40 - r ||
    p.y > WORLD.h - 40 - r
  )
    return true;
  return walls.some(
    (w) =>
      w.hp > 0 &&
      Math.abs(p.x - w.x) < w.w / 2 + r &&
      Math.abs(p.y - w.y) < w.h / 2 + r,
  );
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
