import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation";
import { bowFrame } from "../src/animation";
import { projectileHeight } from "../src/combat";
import type { Input } from "../src/types";
function setup() {
  const g = new Simulation();
  g.started = true;
  g.remaining = 10000;
  g.defenders.slice(1).forEach((d) => (d.dead = 1000));
  Object.assign(g.player, { x: 1100, y: 1100 });
  const i: Input = {
    keys: new Set(),
    pressed: new Set(),
    mouse: { x: 0, y: 0 },
    down: true,
    clicked: true,
    aimRay: { x: 1500, y: 1100 },
  };
  return { g, i };
}
function step(g: Simulation, i: Input, n = 1) {
  for (let k = 0; k < n; k++) {
    g.update(1 / 60, i, i.aimRay!);
    i.clicked = false;
    i.pressed.clear();
  }
}
test("holding a bow charges without firing or consuming extra ammunition", () => {
  const { g, i } = setup();
  step(g, i);
  assert.equal(bowFrame(g.player), 1);
  step(g, i, 120);
  assert.equal(g.projectiles.length, 0);
  assert.equal(g.player.ammo, 23);
  assert.equal(g.player.shot?.charge, 1);
  assert.equal(bowFrame(g.player), 2);
  i.down = false;
  step(g, i);
  assert.equal(g.projectiles.length, 1);
  assert.equal(g.player.shot, null);
  assert.equal(bowFrame(g.player), 3);
  step(g, i, 10);
  assert.equal(g.player.ammo, 23);
});
test("a full charge increases both actual projectile travel and damage over a tap", () => {
  const tap = setup(),
    full = setup();
  step(tap.g, tap.i);
  tap.i.down = false;
  step(tap.g, tap.i);
  step(full.g, full.i, 60);
  full.i.down = false;
  step(full.g, full.i);
  const a = tap.g.projectiles[0],
    b = full.g.projectiles[0];
  assert.ok(b.damage > a.damage * 2);
  assert.equal(b.damage, 56);
  assert.ok(
    Math.hypot(b.vx, b.vy) * b.total > Math.hypot(a.vx, a.vy) * a.total * 4,
  );
});
test("release follows the latest cursor direction and never locks onto a nearby moving enemy", () => {
  const { g, i } = setup();
  g.spawn("goblin", 0);
  const e = g.enemies[0];
  Object.assign(e, { x: 1500, y: 1100, stun: 100 });
  step(g, i, 30);
  assert.equal(g.player.shot?.lockId, null);
  i.aimRay = { x: 1100, y: 1500 };
  i.down = false;
  step(g, i);
  const q = g.projectiles[0];
  assert.ok(Math.abs(q.vx) < 0.001);
  assert.ok(q.vy > 0);
  const z = projectileHeight(q);
  q.life *= 0.5;
  assert.equal(projectileHeight(q), z);
});
test("charge cancellation refunds the reserved arrow and cannot release a hidden shot", () => {
  const { g, i } = setup();
  step(g, i, 20);
  g.cancelCharge();
  assert.equal(g.player.ammo, 24);
  assert.equal(g.player.shot, null);
  i.down = false;
  step(g, i);
  assert.equal(g.projectiles.length, 0);
});
test("manual arrows hit the visible body on the cursor line and miss an enemy outside it", () => {
  const { g, i } = setup();
  g.spawn("goblin", 0);
  g.spawn("goblin", 0);
  Object.assign(g.enemies[0], {
    x: 1300,
    y: 1076,
    hp: 1000,
    maxHp: 1000,
    stun: 100,
  });
  Object.assign(g.enemies[1], {
    x: 1300,
    y: 1300,
    hp: 1000,
    maxHp: 1000,
    stun: 100,
  });
  step(g, i, 60);
  i.down = false;
  step(g, i, 30);
  assert.equal(g.enemies[0].hp, 944);
  assert.equal(g.enemies[1].hp, 1000);
});
test("Shift starts a brief dash and respects cooldown", () => {
  const { g, i } = setup();
  i.clicked = false;
  i.down = false;
  i.keys.add("d");
  i.pressed.add("shift");
  const x = g.player.x;
  step(g, i);
  assert.ok(g.player.x - x > 8);
  assert.ok(g.player.dodgeCooldown > 1);
  step(g, i, 20);
  i.pressed.add("shift");
  step(g, i);
  assert.equal(g.player.dodge, 0);
});
