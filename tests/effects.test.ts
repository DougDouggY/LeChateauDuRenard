import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation";
import { wallDamageStage } from "../src/destruction";
import { effect, powerImpact } from "../src/powers";
const setup = () => {
  const g = new Simulation();
  g.started = true;
  g.remaining = 10000;
  g.defenders.slice(1).forEach((d) => (d.dead = 1000));
  return g;
};
const input = {
  keys: new Set<string>(),
  pressed: new Set<string>(),
  mouse: { x: 0, y: 0 },
  down: false,
  clicked: false,
};
test("five damage stages use relative health, including upgraded and repaired walls", () => {
  assert.deepEqual(
    [1, 0.8, 0.55, 0.25, 0].map((r) => wallDamageStage(r * 800, 800)),
    [0, 1, 2, 3, 4],
  );
  const g = setup(),
    w = g.walls[0];
  for (const ratio of [0.79, 0.54, 0.24, 0]) {
    g.damageWall(w.id, w.hp - w.maxHp * ratio);
    const event = g.effects.filter((e) => e.wallId === w.id);
    assert.equal(event.length, 1);
    assert.equal(event[0].stage, wallDamageStage(w.hp, w.maxHp));
  }
  assert.equal(g.effects.find((e) => e.wallId === w.id)?.kind, "wall-collapse");
  const count = g.effects.length;
  g.damageWall(w.id, 20);
  assert.equal(g.effects.length, count);
  w.hp = w.maxHp;
  assert.equal(wallDamageStage(w.hp, w.maxHp), 0);
});
test("impact and collapse animations expire without changing gameplay health", () => {
  const g = setup(),
    w = g.walls[0];
  g.damageWall(w.id, 100);
  const hp = w.hp;
  for (let i = 0; i < 120; i++) g.update(1 / 60, input, g.player);
  assert.equal(w.hp, hp);
  assert.equal(
    g.effects.some((e) => e.kind === "wall-hit"),
    false,
  );
  g.damageWall(w.id, w.hp);
  for (let i = 0; i < 130; i++) g.update(1 / 60, input, g.player);
  assert.equal(
    g.effects.some((e) => e.kind === "wall-collapse"),
    false,
  );
  assert.equal(w.hp, 0);
});
test("the cosmetic budget stays bounded while actual power impacts still apply", () => {
  const g = setup();
  for (let i = 0; i < 600; i++)
    effect(g, "cast", g.player, "#fff", 30, 0.4, { power: "fire" });
  assert.equal(g.effects.length, 160);
  g.spawn("goblin", 0);
  const e = g.enemies[0];
  e.hp = e.maxHp = 1000;
  g.projectile(g.player, e, 1, "ally", "arrow", null, "fire", 0);
  powerImpact(g, g.projectiles[0], e);
  assert.equal(e.burn, 5);
  assert.ok(g.effects.some((e) => e.kind === "fire-impact"));
  assert.equal(g.effects.length, 160);
});
test("ballista release creates one mechanical impulse and the bolt originates at the rail tip", () => {
  const g = setup(),
    b = g.installBallista({ x: 1200, y: 1100 });
  g.player.mounted = b.id;
  b.user = 0;
  g.shoot(g.player, { x: 1700, y: 1100 }, true);
  assert.equal(g.effects.filter((e) => e.kind === "bolt-launch").length, 1);
  assert.equal(b.recoil, 1);
  assert.equal(b.loaded, false);
  assert.equal(g.projectiles[0].x, b.x + 70);
  assert.equal(g.projectiles[0].startZ, 94);
  g.shoot(g.player, { x: 1700, y: 1100 }, true);
  assert.equal(g.projectiles.length, 1);
  for (let i = 0; i < 20; i++) g.update(1 / 60, input, g.player);
  assert.equal(b.recoil, 0);
});
