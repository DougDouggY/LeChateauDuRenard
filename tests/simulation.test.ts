import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation";
import {
  blocked,
  findPath,
  move,
  POSTS,
  FLOOR_HEIGHT,
  elevation,
  CENTRAL_STAIR,
  WORKSHOP_COUNTER,
  SUPPLY_POSTS,
} from "../src/map";
import { distance, type Input } from "../src/types";
import { archerFrame } from "../src/animation";
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
    input.clicked = false;
  }
}
function isolate(g: Simulation) {
  for (const d of g.defenders.slice(1)) d.dead = 1000;
}
function intermission(g: Simulation) {
  g.wave = 1;
  g.phase = "preparation";
  g.remaining = 10000;
  g.workshop.arrive();
  run(g, 2);
  assert.equal(g.workshop.ready, true);
}
test("start is three archers, one supply, eight empty sockets and no points or ballistas", () => {
  const g = setup();
  assert.equal(g.defenders.length, 3);
  assert.ok(g.defenders.every((d) => d.weapon === 2 && d.ammo === 24));
  assert.equal(g.ballistas.length, 0);
  assert.equal(g.stocks.length, 1);
  assert.equal(g.resources, 0);
  assert.equal(g.availableSites("ballista").length, 8);
  assert.equal(g.workshop.state, "hidden");
  assert.equal(g.buy("arrows"), false);
});
test("the entire fighting deck is at parapet height with no internal movement blockers", () => {
  const g = setup();
  for (let x = 600; x <= 1800; x += 80)
    for (let y = 560; y <= 1640; y += 80) {
      assert.equal(elevation({ x, y }), FLOOR_HEIGHT);
      assert.equal(blocked({ x, y }, 35, g.walls, true), false);
    }
  assert.equal(elevation({ x: 100, y: 100 }), 0);
  const p = { x: 1200, y: 1200 };
  move(p, 0, -450, 35, g.walls, true);
  assert.ok(Math.abs(p.y - 750) < 1e-6);
  for (const post of POSTS) {
    const path = findPath(g.player, post, g.walls);
    assert.ok(distance(path.at(-1)!, post) < 2);
  }
});
test("outer walls prevent tunnelling while a broken gate admits enemies", () => {
  const g = setup(),
    p = { x: 1200, y: 550 };
  move(p, 0, -300, 17, g.walls);
  assert.ok(p.y >= 519);
  g.walls[2].hp = 0;
  move(p, 0, -300, 17, g.walls);
  assert.ok(p.y < 490);
});
test("arrows fired from the center clear the parapet and hit an exterior enemy", () => {
  const g = setup();
  isolate(g);
  g.player.x = 1200;
  g.player.y = 1100;
  g.spawn("goblin", 0);
  const e = g.enemies[0];
  e.x = 1200;
  e.y = 275;
  g.shoot(g.player, e);
  assert.equal(g.player.ammo, 23);
  run(g, 1.6);
  assert.ok(e.hp < e.maxHp);
});
test("kills award points immediately without inaccessible outside pickups", () => {
  const g = setup();
  g.spawn("goblin", 0);
  g.damageEnemy(g.enemies[0], 1000);
  assert.equal(g.resources, 10);
  g.damageEnemy(g.enemies[0], 1000);
  assert.equal(g.resources, 10);
  g.spawn("brute", 1);
  g.damageEnemy(g.enemies[1], 1000);
  assert.equal(g.resources, 30);
  assert.equal(g.pickups.length, 0);
});
test("walk cycle uses distinct sprite frames, stops on release and does not walk against a wall", () => {
  const g = setup();
  const input = empty();
  input.keys.add("d");
  const seen = new Set<number>();
  for (let i = 0; i < 50; i++) {
    g.update(1 / 60, input, g.player);
    seen.add(archerFrame(g.player));
  }
  assert.equal(seen.size, 4);
  input.keys.clear();
  run(g, 0.05, input);
  assert.equal(archerFrame(g.player), 0);
  assert.equal(g.player.moving, false);
  g.player.x = 1841;
  g.player.y = 1000;
  input.keys.add("d");
  const clock = g.player.walk;
  run(g, 0.2, input);
  assert.equal(g.player.moving, false);
  assert.equal(g.player.walk, clock);
});
test("short clicks consume ammo, empty bows cannot fire and the one reserve refills with E", () => {
  const g = setup();
  isolate(g);
  const i = empty();
  i.clicked = true;
  g.update(1 / 60, i, { x: g.player.x + 300, y: g.player.y });
  assert.equal(g.player.ammo, 23);
  g.player.ammo = 0;
  g.player.cooldown = 0;
  const count = g.projectiles.length;
  g.shoot(g.player, { x: 500, y: 500 });
  assert.equal(g.projectiles.length, count);
  g.player.x = g.stocks[0].x;
  g.player.y = g.stocks[0].y + 40;
  g.interact();
  assert.equal(g.player.ammo, 24);
});
test("worker actually ascends the central access and accepts interaction only between rounds", () => {
  const g = setup();
  assert.equal(g.workshop.state, "hidden");
  g.wave = 1;
  g.workshop.arrive();
  assert.deepEqual({ x: g.workshop.x, y: g.workshop.y }, CENTRAL_STAIR);
  run(g, 0.5);
  assert.notEqual(g.workshop.state, "ready");
  run(g, 1.5);
  assert.equal(g.workshop.ready, true);
  assert.ok(distance(g.workshop, WORKSHOP_COUNTER) < 2);
  g.player.x = g.workshop.x;
  g.player.y = g.workshop.y + 60;
  g.interact();
  assert.equal(g.shopRequested, true);
  g.phase = "assault";
  assert.equal(g.workshop.order("stock", SUPPLY_POSTS[0]), false);
});
test("purchasing reserves a valid socket, charges once, and delivers before installing", () => {
  const g = setup();
  intermission(g);
  g.resources = 200;
  assert.equal(g.requestPlacement("ballista"), true);
  assert.equal(g.resources, 200);
  assert.equal(g.placeOrder({ x: 1200, y: 1200 }), false);
  assert.equal(g.resources, 200);
  assert.equal(g.placeOrder(POSTS[0]), true);
  assert.equal(g.resources, 110);
  assert.equal(g.ballistas.length, 0);
  assert.equal(g.workshop.state, "fetching");
  assert.equal(g.workshop.order("ballista", POSTS[1]), false);
  assert.equal(g.resources, 110);
  run(g, 1);
  assert.equal(g.ballistas.length, 0);
  assert.equal(g.workshop.job?.kind, "ballista");
  run(g, 10);
  assert.equal(g.ballistas.length, 1);
  assert.ok(distance(g.ballistas[0], POSTS[0]) < 1);
  assert.equal(g.availableSites("ballista").length, 7);
  assert.equal(g.workshop.ready, true);
});
test("reserve delivery adds a usable new refill location and upgrades apply after delivery", () => {
  const g = setup();
  intermission(g);
  g.resources = 300;
  assert.equal(g.workshop.order("stock", SUPPLY_POSTS[1]), true);
  run(g, 9);
  assert.equal(g.stocks.length, 2);
  g.player.ammo = 0;
  g.player.x = SUPPLY_POSTS[1].x;
  g.player.y = SUPPLY_POSTS[1].y + 45;
  g.interact();
  assert.equal(g.player.ammo, 24);
  assert.equal(g.buy("arrows"), true);
  assert.equal(g.level("arrows"), 0);
  run(g, 4);
  assert.equal(g.level("arrows"), 1);
});
test("wave countdown and manual launch wait for an ongoing delivery", () => {
  const g = setup();
  intermission(g);
  g.resources = 150;
  g.workshop.order("ballista", POSTS[4]);
  g.remaining = 0.1;
  g.startWave();
  assert.equal(g.phase, "preparation");
  run(g, 1);
  assert.equal(g.phase, "preparation");
  assert.equal(g.ballistas.length, 0);
  run(g, 12);
  assert.equal(g.ballistas.length, 1);
  assert.equal(g.phase, "assault");
  assert.equal(g.wave, 2);
  run(g, 3);
  assert.equal(g.workshop.state, "hidden");
});
test("delivered ballista can mount, fire, reload, carry across the deck and drop", () => {
  const g = setup();
  intermission(g);
  g.resources = 200;
  g.workshop.order("ballista", POSTS[1]);
  run(g, 11);
  const b = g.ballistas[0];
  g.defenders.slice(1).forEach((d) => {
    g.release(d);
    d.order = "follow";
    d.dead = 1000;
  });
  g.player.x = b.x;
  g.player.y = b.y + 35;
  g.interact();
  assert.equal(g.player.mounted, 0);
  g.shoot(g.player, { x: b.x, y: 200 });
  assert.equal(b.loaded, false);
  const points = g.resources;
  const i = empty();
  i.pressed.add("r");
  g.update(1 / 60, i, { x: b.x, y: 200 });
  assert.equal(g.resources, points - 2);
  assert.ok(b.reload > 0);
  run(g, 3.4);
  assert.equal(b.loaded, true);
  g.carry();
  assert.equal(g.player.carried, 0);
  i.keys.add("s");
  run(g, 2, i);
  assert.ok(b.y > 700);
  g.interact();
  assert.equal(b.carrier, null);
  assert.equal(g.player.carried, null);
});
test("bow allies defend before equipment exists and refill autonomously", () => {
  const g = setup();
  g.phase = "assault";
  g.wave = 1;
  g.spawnLeft = 0;
  g.spawn("brute", 0);
  g.spawn("brute", 2);
  g.enemies.forEach((e) => (e.hp = e.maxHp = 10000));
  run(g, 12);
  assert.equal(g.ballistas.length, 0);
  assert.ok(g.enemies.some((e) => e.hp < e.maxHp));
  // Isolate refilling from live combat: a defender may legitimately fire again
  // immediately after refilling, which otherwise makes an exact ammo count race.
  const refill = setup(),
    archer = refill.defenders[1],
    stock = refill.stocks[0];
  archer.ammo = 0;
  archer.x = stock.x + 10;
  archer.y = stock.y;
  run(refill, 0.1);
  assert.equal(archer.ammo, 24);
});
test("worker rejects unaffordable orders and equipment on an occupied socket", () => {
  const g = setup();
  intermission(g);
  g.resources = 89;
  assert.equal(g.requestPlacement("ballista"), false);
  assert.equal(g.workshop.order("ballista", POSTS[0]), false);
  g.resources = 200;
  g.installBallista(POSTS[0]);
  assert.equal(g.workshop.order("ballista", POSTS[0]), false);
  assert.equal(g.resources, 200);
});
test("repairs consume points and rebuild a damaged section", () => {
  const g = setup();
  g.resources = 20;
  const w = g.walls[2];
  w.hp = 0;
  g.player.x = w.x;
  g.player.y = w.y + 65;
  assert.equal(g.repair(g.player, 1), true);
  assert.ok(w.hp > 0);
  assert.ok(g.resources < 20);
});
test("dodge is collision aware and briefly invulnerable; total defeat still ends the game", () => {
  const g = setup(),
    from = { ...g.player },
    i = empty();
  i.pressed.add(" ");
  run(g, 0.25, i);
  assert.ok(distance(from, g.player) > 100);
  g.player.dodge = 0.1;
  g.damageDefender(g.player, 20);
  assert.equal(g.player.hp, 160);
  g.player.dodge = 0;
  g.defenders.forEach((d) => g.damageDefender(d, 1000));
  run(g, 0.1);
  assert.equal(g.phase, "defeat");
});
test("a completed first round rewards points, creates the worker and schedules multiple fronts", () => {
  const g = setup();
  g.startWave();
  assert.deepEqual(g.fronts, [0]);
  g.spawnLeft = 0;
  run(g, 0.1);
  assert.equal(g.phase, "preparation");
  assert.equal(g.resources, 45);
  assert.equal(g.workshop.state, "arriving");
  run(g, 2);
  g.startWave();
  assert.equal(g.wave, 2);
  assert.deepEqual(g.fronts, [1, 3]);
});
