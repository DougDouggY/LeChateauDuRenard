import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation";
import { HEROES } from "../src/heroes";
import { bowFrame } from "../src/animation";
import type { Input, Enemy } from "../src/types";
const input = (): Input => ({
  keys: new Set(),
  pressed: new Set(),
  mouse: { x: 0, y: 0 },
  down: false,
  clicked: false,
});
function setup(id = 0) {
  const g = new Simulation([id, 1, 4]);
  g.started = true;
  g.remaining = 10000;
  g.defenders.slice(1).forEach((d) => (d.dead = 1000));
  g.player.x = 1100;
  g.player.y = 1100;
  return g;
}
function step(g: Simulation, seconds: number, i = input()) {
  for (let n = 0; n < Math.ceil(seconds * 60); n++) {
    g.update(1 / 60, i, { x: 1350, y: 1100 });
    i.pressed.clear();
    i.clicked = false;
    i.abilityPressed = false;
  }
}
function enemy(g: Simulation, x = 1300, y = 1100, hp = 1000): Enemy {
  g.spawn("goblin", 0);
  const e = g.enemies.at(-1)!;
  e.x = x;
  e.y = y;
  e.hp = e.maxHp = hp;
  e.stun = 100;
  return e;
}
test("eight hooded profiles expose eight distinct powers and selection swaps occupied party slots", () => {
  assert.equal(HEROES.length, 8);
  assert.equal(new Set(HEROES.map((h) => h.power)).size, 8);
  assert.equal(new Set(HEROES.map((h) => h.color)).size, 8);
  const g = new Simulation();
  assert.equal(g.selectHero(0, 1), true);
  assert.deepEqual(
    g.defenders.map((d) => d.hero),
    [1, 0, 4],
  );
  assert.equal(g.player.name, "Brune");
  for (let n = 0; n < 8; n++) {
    assert.equal(g.selectHero(0, n), true);
    assert.equal(g.player.color, HEROES[n].color);
    assert.equal(new Set(g.defenders.map((d) => d.hero)).size, 3);
  }
  assert.equal(g.selectHero(0, 99), false);
  g.started = true;
  assert.equal(g.selectHero(0, 2), false);
});
test("bow visibly winds up before spawning a projectile, then enters the release frame", () => {
  const g = setup(),
    e = enemy(g);
  g.shoot(g.player, e);
  assert.equal(g.projectiles.length, 0);
  assert.equal(g.player.ammo, 23);
  assert.equal(bowFrame(g.player), 1);
  step(g, 0.12);
  assert.equal(bowFrame(g.player), 2);
  assert.equal(g.projectiles.length, 0);
  step(g, 0.14);
  assert.equal(g.player.shot, null);
  assert.equal(bowFrame(g.player), 3);
  assert.equal(g.projectiles.length, 1);
  step(g, 0.17);
  assert.equal(bowFrame(g.player), 0);
});
test("right-click input casts one ability, spends ammo once and respects its own cooldown", () => {
  const g = setup(),
    e = enemy(g),
    i = input();
  i.abilityPressed = true;
  g.update(1 / 60, i, e);
  assert.equal(g.player.shot?.power, "explosive");
  assert.equal(g.player.ammo, 23);
  assert.equal(g.player.abilityCooldown, 10);
  assert.equal(g.useAbility(g.player, e), false);
  assert.equal(g.player.ammo, 23);
  step(g, 0.3);
  assert.ok(g.player.abilityCooldown < 10);
  assert.equal(g.projectiles[0].power, "explosive");
});
test("a special shot can replace an unfinished normal draw without charging both shots", () => {
  const g = setup(1),
    e = enemy(g);
  g.shoot(g.player, e);
  assert.equal(g.player.ammo, 23);
  assert.equal(g.useAbility(g.player, e), true);
  assert.equal(g.player.ammo, 21);
  assert.equal(g.player.shot?.power, "multishot");
  step(g, 0.25);
  assert.equal(g.projectiles.length, 5);
  assert.equal(new Set(g.projectiles.map((q) => Math.round(q.vy))).size, 5);
});
test("explosive arrows damage a real cluster and do not damage distant enemies", () => {
  const g = setup();
  const a = enemy(g, 1300),
    b = enemy(g, 1355),
    far = enemy(g, 1750);
  g.useAbility(g.player, a);
  step(g, 0.9);
  assert.equal(a.hp, 915);
  assert.ok(b.hp < 1000);
  assert.equal(far.hp, 1000);
  assert.ok(g.effects.some((e) => e.kind === "explosion"));
});
test("frost applies a timed area slow and slow reduces real movement speed", () => {
  const g = setup(2),
    a = enemy(g),
    b = enemy(g, 1350);
  g.useAbility(g.player, a);
  step(g, 0.8);
  assert.ok(a.slow > 3);
  assert.ok(b.slow > 3);
  const normal = setup(),
    slow = setup();
  normal.spawn("goblin", 0);
  slow.spawn("goblin", 0);
  for (const v of [normal, slow]) {
    v.enemies[0].x = 1200;
    v.enemies[0].y = 100;
  }
  slow.enemies[0].slow = 4;
  step(normal, 1);
  step(slow, 1);
  const fastDelta = normal.enemies[0].y - 100,
    slowDelta = slow.enemies[0].y - 100;
  assert.ok(slowDelta < fastDelta * 0.5);
});
for (const [id, status] of [
  [3, "burn"],
  [6, "poison"],
] as const)
  test(`${status} deals continuing damage and ends after its stated duration`, () => {
    const g = setup(id),
      a = enemy(g);
    g.useAbility(g.player, a);
    step(g, 0.8);
    assert.ok(a[status] > 0);
    const hp = a.hp;
    step(g, 2);
    assert.ok(a.hp < hp);
    step(g, 7);
    assert.equal(a[status], 0);
    const stopped = a.hp;
    step(g, 2);
    assert.equal(a.hp, stopped);
  });
test("piercing shot damages a line of enemies rather than disappearing at the first target", () => {
  const g = setup(4);
  const targets = [enemy(g, 1230), enemy(g, 1320), enemy(g, 1410)];
  g.useAbility(g.player, targets[0]);
  step(g, 1);
  assert.ok(targets.every((e) => e.hp === 905));
});
test("moon arrow heals the shooter and nearby living allies but cannot resurrect fallen ones", () => {
  const g = setup(5),
    a = enemy(g);
  g.player.hp = 80;
  const ally = g.defenders[1];
  ally.dead = 0;
  ally.hp = 90;
  ally.x = g.player.x + 50;
  ally.y = g.player.y + 20;
  ally.order = "follow";
  g.useAbility(g.player, a);
  step(g, 0.8);
  assert.equal(g.player.hp, 98);
  assert.equal(ally.hp, 108);
  assert.equal(g.defenders[2].hp, 160);
  assert.ok(g.defenders[2].dead > 0);
});
test("lightning chains to four distinct enemies and briefly stuns them", () => {
  const g = setup(7);
  const targets = [
    enemy(g, 1250),
    enemy(g, 1310),
    enemy(g, 1370),
    enemy(g, 1430),
    enemy(g, 1490),
  ];
  g.useAbility(g.player, targets[0]);
  step(g, 0.65);
  assert.ok(targets.slice(0, 4).every((e) => e.hp === 955));
  assert.equal(targets[4].hp, 1000);
  assert.ok(targets.slice(0, 4).every((e) => e.stun > 0 && e.stun < 1));
  assert.ok(g.effects.some((e) => e.kind === "lightning"));
});
test("powers cannot be cast without ammo, from a ballista, or while carrying one", () => {
  const g = setup(1),
    a = enemy(g);
  g.player.ammo = 2;
  assert.equal(g.useAbility(g.player, a), false);
  assert.equal(g.player.abilityCooldown, 0);
  g.player.ammo = 24;
  g.player.mounted = 0;
  assert.equal(g.useAbility(g.player, a), false);
  g.player.mounted = null;
  g.player.carried = 0;
  assert.equal(g.useAbility(g.player, a), false);
  assert.equal(g.player.ammo, 24);
});
test("gold is awarded once per kill, remains integral during repairs, and pays for workshop orders", () => {
  const g = setup(),
    a = enemy(g, 1400, 1100, 50);
  g.damageEnemy(a, 100);
  g.damageEnemy(a, 100);
  assert.equal(g.coins, 10);
  assert.ok(g.effects.some((e) => e.kind === "coins" && e.amount === 10));
  const w = g.walls[2];
  w.hp = 400;
  g.player.x = w.x;
  g.player.y = w.y + 60;
  for (let n = 0; n < 20; n++) g.repair(g.player, 1 / 60);
  assert.ok(Number.isInteger(g.coins));
  assert.ok(w.hp > 400);
  g.wave = 1;
  g.workshop.arrive();
  step(g, 2);
  g.coins = 120;
  assert.equal(g.workshop.order("stock", g.availableSites("stock")[0]), true);
  assert.equal(g.coins, 80);
});
test("wave alerts announce north, east/west and all fronts, and freeze during pause", () => {
  const g = setup();
  g.startWave();
  assert.equal(g.waveAlert?.text, "Des monstres arrivent du nord !");
  const life = g.waveAlert!.life;
  g.paused = true;
  step(g, 1);
  assert.equal(g.waveAlert?.life, life);
  g.paused = false;
  g.phase = "preparation";
  g.startWave();
  assert.equal(
    g.waveAlert?.text,
    "Des monstres arrivent de l’est et de l’ouest !",
  );
  g.phase = "preparation";
  g.wave = 3;
  g.startWave();
  assert.equal(g.waveAlert?.text, "Des monstres arrivent de tous les côtés !");
  step(g, 4.6);
  assert.equal(g.waveAlert, null);
});
test("refilling produces a reserve pulse and a real arrow-transfer effect", () => {
  const g = setup();
  const s = g.stocks[0];
  g.player.x = s.x;
  g.player.y = s.y + 35;
  g.player.ammo = 9;
  g.interact();
  assert.equal(g.player.ammo, 24);
  assert.equal(s.pulse, 1);
  assert.ok(g.effects.some((e) => e.kind === "ammo" && e.amount === 15));
  step(g, 0.6);
  assert.equal(s.pulse, 0);
});
