import { test } from "node:test";
import assert from "node:assert/strict";
import { Simulation } from "../src/simulation";
import { frontState, priorityFront } from "../src/fronts";

test("incoming fronts remain visible before spawning and clear after the assault", () => {
  const g = new Simulation();
  assert.equal(priorityFront(g), null);
  g.startWave();
  assert.deepEqual(
    frontState(g).map((f) => f.active),
    [true, false, false, false],
  );
  assert.equal(priorityFront(g)?.side, 0);
  g.spawnLeft = 0;
  assert.equal(priorityFront(g), null);
});

test("front health, breaches and living enemies identify the threatened wall", () => {
  const g = new Simulation();
  g.phase = "assault";
  g.spawnLeft = 0;
  g.spawn("brute", 1);
  g.spawn("goblin", 3);
  g.enemies[1].hp = 0;
  const wall = g.walls.find((w) => w.side === 1)!;
  wall.hp = 0;
  const fronts = frontState(g);
  assert.equal(fronts[1].enemies, 1);
  assert.equal(fronts[1].breaches, 1);
  assert.ok(fronts[1].integrity < 1);
  assert.equal(fronts[3].enemies, 0);
  assert.equal(fronts[3].active, false);
  assert.equal(priorityFront(g)?.side, 1);
});

test("standing at the center does not count as defending a rampart", () => {
  const g = new Simulation();
  g.defenders.slice(1).forEach((d) => (d.dead = 10));
  Object.assign(g.player, { x: 1200, y: 1100, side: 0 });
  assert.equal(frontState(g)[0].defenders, 0);
  g.player.y = 590;
  assert.equal(frontState(g)[0].defenders, 1);
});

test("walking across the open deck stays animated without repeated path searches", () => {
  const g = new Simulation();
  Object.assign(g.player, { x: 1000, y: 900 });
  for (let i = 0; i < 120; i++)
    g.navigate(g.player, { x: 1400, y: 900 }, 1 / 60, 225);
  assert.ok(g.player.x > 1390);
  assert.ok(g.player.walk > 0);
  assert.equal(g.navigationSearches, 0);
});

test("an unreachable goal retries periodically rather than every simulation tick", () => {
  const g = new Simulation();
  Object.assign(g.player, { x: 1200, y: 1100 });
  for (let i = 0; i < 120; i++)
    g.navigate(g.player, { x: -1000, y: -1000 }, 1 / 60, 225);
  assert.ok(g.navigationSearches <= 3);
});
