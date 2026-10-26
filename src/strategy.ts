import type { Simulation } from "./simulation";
import { type Vec, type Side, distance, toward } from "./types";
import { POSTS, STOCKS, move } from "./map";
export function updateAllies(g: Simulation, dt: number) {
  const alive = g.enemies.filter((e) => e.hp > 0);
  for (const d of g.defenders.slice(1)) {
    if (d.dead > 0) continue;
    // Distinct posts and ownership keep allies from competing for the same weapon.
    const threats = ([0, 1, 2, 3] as Side[])
      .map((side) => ({
        side,
        score:
          alive.filter((e) => e.side === side).length -
          (g.defenders.some((o) => o !== d && o.dead <= 0 && o.side === side)
            ? 2
            : 0),
      }))
      .sort((a, b) => b.score - a.score);
    if (d.order === "auto" && threats[0].score > 0) {
      const desired = threats[0].side;
      if (d.side !== desired) {
        g.release(d);
        d.path = [];
        d.side = desired;
      }
    }
    if (d.order === "follow") {
      g.release(d);
      const target = {
        x: g.player.x + (d.id === 1 ? -55 : 55),
        y: g.player.y + 50,
      };
      if (distance(d, target) > 85) g.navigate(d, target, dt, 205);
      const near = alive
        .filter((e) => distance(e, d) < 400)
        .sort((a, b) => distance(a, d) - distance(b, d))[0];
      if (near) {
        d.weapon = distance(d, near) < 90 ? 1 : 2;
        g.shoot(d, near);
      }
      continue;
    }
    const damaged = [...g.walls, ...g.ballistas]
      .filter((w) => w.hp < w.maxHp * 0.7)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    if (
      (d.order === "repair" ||
        (d.order === "auto" && alive.length < 3 && d.id === 1)) &&
      damaged.length &&
      g.resources > 3
    ) {
      g.release(d);
      const w = damaged[(d.id - 1) % damaged.length];
      let target: Vec = { x: w.x, y: w.y };
      if ("side" in w) {
        target = {
          x: w.x + (w.side === 1 ? -70 : w.side === 3 ? 70 : 0),
          y: w.y + (w.side === 0 ? 70 : w.side === 2 ? -70 : 0),
        };
      }
      if (distance(d, w) > 95) g.navigate(d, target, dt, 200);
      else g.repair(d, dt);
      continue;
    }
    if (d.mounted !== null) {
      const b = g.ballistas[d.mounted];
      const target = alive
        .filter((e) => e.side === d.side && distance(e, b) < 1150)
        .sort((a, b) => distance(a, d) - distance(b, d))[0];
      if (target) {
        b.angle = Math.atan2(target.y - b.y, target.x - b.x);
        g.shoot(d, target);
        g.reload(d);
      } else if (d.order === "auto" && g.phase === "preparation") g.release(d);
      if (d.mounted !== null) continue;
    }
    const near = alive
      .filter((e) => distance(e, d) < 95)
      .sort((a, b) => distance(a, d) - distance(b, d))[0];
    if (near) {
      d.weapon = 1;
      g.shoot(d, near);
      continue;
    }
    const available = g.ballistas.filter(
      (b) =>
        Math.floor(b.id / 2) === d.side &&
        b.hp > 0 &&
        b.user === null &&
        b.carrier === null,
    );
    const b = available.sort((a, b) => distance(a, d) - distance(b, d))[0];
    if (b && d.order !== "repair") {
      if (distance(d, b) > 55) g.navigate(d, b, dt, 210);
      else {
        b.user = d.id;
        d.mounted = b.id;
        d.x = b.x;
        d.y = b.y + 30;
        d.path = [];
      }
      continue;
    }
    if (d.ammo === 0) {
      const s = [...STOCKS].sort((a, b) => distance(a, d) - distance(b, d))[0];
      if (distance(s, d) < 70) d.ammo = 24;
      else g.navigate(d, s, dt, 210);
      continue;
    }
    const post = POSTS[d.side * 2 + ((d.id - 1) % 2)];
    if (distance(d, post) > 65) g.navigate(d, post, dt, 210);
    const enemy = alive
      .filter((e) => distance(e, d) < 760)
      .sort((a, b) => distance(a, d) - distance(b, d))[0];
    if (enemy) {
      d.weapon = 2;
      g.shoot(d, enemy);
    }
  }
}
export function updateEnemies(g: Simulation, dt: number) {
  for (const e of g.enemies) {
    if (e.hp <= 0) continue;
    const walls = g.walls.filter((w) => w.side === e.side);
    const gate = walls.find((w) => w.gate)!;
    const melee = e.kind === "brute" || e.kind === "runner";
    const w = melee
      ? gate
      : [...walls].sort((a, b) => distance(a, e) - distance(b, e))[0];
    const inward = {
      x: e.side === 1 ? -1 : e.side === 3 ? 1 : 0,
      y: e.side === 0 ? 1 : e.side === 2 ? -1 : 0,
    };
    e.facing = Math.atan2(1100 - e.y, 1200 - e.x);
    if (melee && gate.hp <= 0) {
      const target = g.defenders
        .filter((d) => d.dead <= 0)
        .sort((a, b) => distance(a, e) - distance(b, e))[0];
      if (!target) continue;
      if (distance(e, target) > 55)
        g.navigate(e, target, dt, e.kind === "runner" ? 150 : 65);
      else if (e.cooldown <= 0) {
        g.damageDefender(target, e.kind === "brute" ? 26 : 13);
        e.cooldown = 1.1;
      }
      continue;
    }
    const goal = {
      x: w.x - inward.x * (melee ? 48 : 215),
      y: w.y - inward.y * (melee ? 48 : 215),
    };
    if (distance(e, goal) > 22) {
      const dir = toward(e, goal);
      const speed = melee ? (e.kind === "runner" ? 145 : 62) : 70;
      move(e, dir.x * speed * dt, dir.y * speed * dt, e.radius, g.walls);
      e.walk += (dt * speed) / 25;
    } else if (e.cooldown <= 0) {
      if (melee) {
        g.damageWall(w.id, e.kind === "brute" ? 38 : 13);
        e.cooldown = e.kind === "brute" ? 1.4 : 0.9;
      } else {
        const defenders = g.defenders.filter(
          (d) => d.dead <= 0 && distance(e, d) < 900,
        );
        const d =
          defenders.length && Math.random() < 0.6
            ? defenders[Math.floor(Math.random() * defenders.length)]
            : null;
        const target = d ? { x: d.x, y: d.y } : w;
        g.projectile(
          e,
          target,
          e.kind === "fire" ? 35 : 18,
          "enemy",
          e.kind === "fire" ? "fire" : "arrow",
          d ? null : w.id,
        );
        e.cooldown = e.kind === "fire" ? 3.6 : 2.7 + Math.random();
      }
    }
    // Separation is bounded and collision aware, avoiding stacks at doors.
    for (const other of g.enemies)
      if (
        other !== e &&
        other.hp > 0 &&
        other.id < e.id &&
        distance(e, other) < e.radius + other.radius
      ) {
        const v = toward(other, e);
        move(e, v.x * dt * 30, v.y * dt * 30, e.radius, g.walls);
      }
  }
}
