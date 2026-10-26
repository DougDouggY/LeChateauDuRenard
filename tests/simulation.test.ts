import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation";
import { blocked, findPath, move, POSTS, segmentDistance } from "../src/map";
import { distance, type Input } from "../src/types";
const empty = (): Input => ({
  keys: new Set(),
  pressed: new Set(),
  mouse: { x: 0, y: 0 },
  down: false,
  clicked: false,
});
function setup() {
  const g = new Simulation();
  g.started = true;
  g.remaining = 10000;
  return g;
}
function run(g: Simulation, seconds: number, input = empty()) {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) {
    g.update(1 / 60, input, { x: g.player.x, y: g.player.y - 500 });
    input.pressed.clear();
  }
}
function isolate(g: Simulation) {
  for (const d of g.defenders.slice(1)) d.dead = 1000;
}
test("all eight firing positions are reachable through functional stairways", () => {
  const g = setup();
  for (const post of POSTS) {
    const path = findPath(g.player, post, g.walls);
    assert.ok(path.length > 0);
    assert.ok(distance(path.at(-1)!, post) < 2);
    assert.ok(path.every((p) => !blocked(p, 17, g.walls)));
  }
});
test("walls stop movement, broken gates open, and swept movement does not tunnel", () => {
  const g = setup(),
    p = { x: 1200, y: 550 };
  move(p, 0, -300, 17, g.walls);
  assert.ok(p.y >= 519);
  const gate = g.walls.find((w) => w.side === 0 && w.gate)!;
  gate.hp = 0;
  move(p, 0, -300, 17, g.walls);
  assert.ok(p.y < 490);
});
test("carried ballistas fit wide stairs and cannot use narrow north stairs", () => {
  const g = setup();
  assert.equal(blocked({ x: 1200, y: 616 }, 35, g.walls, true), true);
  assert.equal(blocked({ x: 656, y: 1100 }, 35, g.walls, true), false);
  assert.equal(blocked({ x: 1200, y: 616 }, 17, g.walls), false);
});
test("sword, arrow and swept projectile collision inflict real damage", () => {
  const g = setup();
  isolate(g);
  g.spawn("goblin", 0);
  const e = g.enemies[0];
  e.x = g.player.x + 45;
  e.y = g.player.y;
  g.player.weapon = 1;
  g.shoot(g.player, e);
  assert.equal(e.hp, e.maxHp - 48);
  g.player.cooldown = 0;
  g.player.weapon = 2;
  g.shoot(g.player, e);
  run(g, 0.08);
  assert.ok(e.hp <= 0);
  assert.equal(g.kills, 1);
  assert.equal(
    segmentDistance({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 4 }),
    4,
  );
});
test("arrows clear parapets from battlements but are stopped when fired too low", () => {
  for (const high of [false, true]) {
    const g = setup();
    isolate(g);
    g.spawn("goblin", 0);
    const e = g.enemies[0];
    e.x = 1200;
    e.y = 275;
    g.player.x = 1200;
    g.player.y = high ? 552 : 800;
    g.projectile(g.player, e, 30, "ally", "arrow");
    run(g, 1);
    assert.equal(e.hp < e.maxHp, high);
  }
});
test("mount, fire, spend wood to reload, transport and deposit a ballista", () => {
  const g = setup(),
    p = g.player,
    b = g.ballistas[0];
  p.x = b.x;
  p.y = b.y + 35;
  g.interact();
  assert.equal(p.mounted, b.id);
  g.shoot(p, { x: b.x, y: b.y - 300 });
  assert.equal(b.loaded, false);
  assert.equal(g.projectiles[0].kind, "bolt");
  const wood = g.resources;
  g.reload(p);
  assert.equal(g.resources, wood - 2);
  run(g, 3.4);
  assert.equal(b.loaded, true);
  g.carry();
  assert.equal(p.carried, b.id);
  assert.equal(b.user, null);
  const input = empty();
  input.keys.add("d");
  const before = b.x;
  run(g, 0.3, input);
  assert.ok(b.x > before);
  assert.equal(b.x, p.x);
  g.interact();
  assert.equal(p.carried, null);
  assert.equal(b.carrier, null);
});
test("repairs consume resources, rebuild a breach and upgrades change stats", () => {
  const g = setup(),
    w = g.walls[2];
  w.hp = 0;
  g.player.x = w.x;
  g.player.y = w.y + 65;
  const wood = g.resources;
  assert.equal(g.repair(g.player, 1), true);
  assert.ok(w.hp > 0);
  assert.ok(g.resources < wood);
  g.resources = 300;
  const max = w.maxHp;
  assert.equal(g.buy("walls"), true);
  assert.equal(w.maxHp, max + 150);
  g.phase = "assault";
  assert.equal(g.buy("arrows"), false);
});
test("dodge moves without held movement, grants invulnerability and respects cooldown", () => {
  const g = setup();
  const p = g.player;
  const from = { x: p.x, y: p.y };
  const input = empty();
  input.pressed.add(" ");
  run(g, 0.25, input);
  assert.ok(distance(from, p) > 100);
  assert.ok(p.dodgeCooldown > 1);
  p.dodge = 0.1;
  const hp = p.hp;
  g.damageDefender(p, 20);
  assert.equal(p.hp, hp);
  p.dodge = 0;
  g.damageDefender(p, 20);
  assert.equal(p.hp, hp - 20);
});
test("allies navigate, reserve separate ballistas, fire and reload autonomously", () => {
  const g = setup();
  g.phase = "assault";
  g.wave = 2;
  g.spawnLeft = 0;
  g.spawn("brute", 0);
  g.spawn("brute", 2);
  g.enemies.forEach((e) => {
    e.hp = e.maxHp = 10000;
  });
  g.defenders.slice(1).forEach((d) => (d.order = "ballista"));
  run(g, 20);
  const [a, b] = g.defenders.slice(1);
  assert.notEqual(a.mounted, null);
  assert.notEqual(b.mounted, null);
  assert.notEqual(a.mounted, b.mounted);
  assert.ok(g.resources < 110);
  assert.ok(g.enemies.some((e) => e.hp < e.maxHp));
});
test("ranged enemies advance and pause to attack the castle with visible projectiles", () => {
  const g = setup();
  isolate(g);
  g.spawn("skeleton", 1);
  const e = g.enemies[0],
    initial = e.x;
  run(g, 10);
  assert.ok(e.x < initial);
  assert.ok(e.x >= 1870 + 180);
  assert.ok(
    g.projectiles.length > 0 || g.integrity < 1 || g.player.hp < g.player.maxHp,
  );
});
test("next waves add multiple fronts; all defenders down triggers defeat", () => {
  const g = setup();
  g.startWave();
  assert.equal(g.wave, 1);
  assert.deepEqual(g.fronts, [0]);
  g.spawnLeft = 0;
  run(g, 0.1);
  assert.equal(g.phase, "preparation");
  assert.ok(g.resources >= 155);
  g.startWave();
  assert.equal(g.wave, 2);
  assert.deepEqual(g.fronts, [1, 3]);
  g.defenders.forEach((d) => {
    d.hp = 1;
    g.damageDefender(d, 10);
  });
  run(g, 0.1);
  assert.equal(g.phase, "defeat");
});
test("follow and repair orders perform different real tasks", () => {
  const g = setup();
  const ally = g.defenders[1];
  ally.order = "follow";
  const before = distance(ally, g.player);
  g.player.x = 800;
  g.player.y = 1300;
  run(g, 3);
  assert.ok(distance(ally, g.player) < 150);
  const w = g.walls[10];
  w.hp = 100;
  ally.order = "repair";
  ally.x = w.x;
  ally.y = w.y - 60;
  run(g, 1);
  assert.ok(w.hp > 100);
  assert.ok(before >= 0);
});

test("short clicks and short R taps are consumed even between render frames", () => {
  const g = setup();
  isolate(g);
  g.player.weapon = 2;
  const input = empty();
  input.clicked = true;
  g.update(1 / 60, input, { x: g.player.x + 200, y: g.player.y });
  assert.equal(g.player.ammo, 11);
  const b = g.ballistas[0];
  g.player.x = b.x;
  g.player.y = b.y;
  g.interact();
  b.loaded = false;
  input.clicked = false;
  input.pressed.add("r");
  g.update(1 / 60, input, { x: 1000, y: 100 });
  assert.ok(b.reload > 0);
});
