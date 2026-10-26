import type { Simulation } from "./simulation";
import {
  distance,
  type Projectile,
  type Enemy,
  type Vec,
  type CombatEffect,
} from "./types";
export function effect(
  g: Simulation,
  kind: CombatEffect["kind"],
  p: Vec,
  color: string,
  radius: number,
  life = 0.6,
  extra: Partial<CombatEffect> = {},
) {
  // Cosmetic events have a hard budget, independently of gameplay projectiles.
  if (g.effects.length >= 160) {
    const cosmetic = g.effects.findIndex(
      (e) => e.kind !== "coins" && e.kind !== "damage",
    );
    if (cosmetic < 0) return;
    g.effects.splice(cosmetic, 1);
  }
  g.effects.push({
    id: g.nextId++,
    kind,
    x: p.x,
    y: p.y,
    color,
    radius,
    life,
    total: life,
    ...extra,
  });
}
export function powerImpact(
  g: Simulation,
  q: Projectile,
  target: Enemy | null,
) {
  if (!q.power || q.power === "multishot" || q.power === "piercing") return;
  if (q.effectDone) return;
  q.effectDone = true;
  const at = target ?? q;
  if (q.power === "explosive") {
    effect(g, "explosion", at, "#f4b364", 140, 1.25);
    g.shake = 6;
    g.particlesAt(at, "#ffd18a", 28);
    for (const e of g.enemies)
      if (e.hp > 0 && distance(at, e) < 140)
        g.damageEnemy(e, 62 * (1 - distance(at, e) / 400));
  } else if (q.power === "frost") {
    effect(g, "frost", at, "#9ae0f2", 110, 1.35);
    g.particlesAt(at, "#c2ecf3", 18);
    for (const e of g.enemies)
      if (e.hp > 0 && distance(at, e) < 110) {
        e.slow = 4;
        if (e !== target) g.damageEnemy(e, 12);
      }
  } else if (target && q.power === "fire") {
    effect(g, "fire-impact", at, "#ffad5e", 65, 0.9);
    target.burn = 5;
    g.particlesAt(target, "#ffa358", 14);
  } else if (target && q.power === "poison") {
    effect(g, "poison-impact", at, "#b9da77", 70, 1.25);
    target.poison = 6;
    g.particlesAt(target, "#b9d976", 12);
  } else if (target && q.power === "moon") {
    const source = g.defenders[q.ownerId];
    if (!source) return;
    for (const d of g.defenders)
      if (d.dead <= 0 && distance(d, source) < 500) {
        const healed = Math.min(18, d.maxHp - d.hp);
        d.hp += healed;
        effect(g, "heal", d, "#e9e3bd", 45, 0.9, { amount: healed });
      }
  } else if (target && q.power === "lightning") {
    target.stun = 0.8;
    const struck = new Set([target.id]);
    const chain: Vec[] = [{ x: target.x, y: target.y }];
    let current = target;
    for (let i = 0; i < 3; i++) {
      const next = g.enemies
        .filter(
          (e) => e.hp > 0 && !struck.has(e.id) && distance(e, current) < 230,
        )
        .sort((a, b) => distance(a, current) - distance(b, current))[0];
      if (!next) break;
      next.stun = 0.8;
      struck.add(next.id);
      chain.push({ x: next.x, y: next.y });
      g.damageEnemy(next, 45);
      current = next;
    }
    effect(g, "lightning", target, "#a2f0ef", 50, 0.42, { points: chain });
    g.particlesAt(target, "#c3ffff", 12);
  }
}
