import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const port = 5175,
  base = `http://127.0.0.1:${port}`;
const server = spawn(
  "npm",
  [
    "run",
    "dev",
    "--",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  { stdio: "ignore", detached: true },
);
let browser;
const errors = [],
  checks = [];
const check = (s) => {
  checks.push(s);
  console.log(`✓ ${s}`);
};
try {
  for (let n = 0; n < 80; n++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    if (n === 79) throw Error("Vite did not start");
    await new Promise((r) => setTimeout(r, 150));
  }
  await mkdir("artifacts/vfx", { recursive: true });
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") errors.push(e.text());
  });
  await page.goto(`${base}/?test`);
  await page.waitForFunction(() => window.__renderer?.ready);
  await page.getByRole("button", { name: "Prendre la garde" }).click();
  await page.addStyleTag({
    content: "#overlay, #hud { display:none !important; }",
  });
  await page.evaluate(() => {
    window.__game().paused = true;
    window.__renderer.autoQuality = false;
  });
  const step = async (frames) =>
    page.evaluate((frames) => {
      const g = window.__game(),
        r = window.__renderer;
      const input = {
        keys: new Set(),
        pressed: new Set(),
        mouse: { x: 0, y: 0 },
        down: false,
        clicked: false,
      };
      g.paused = false;
      for (let i = 0; i < frames; i++) g.update(1 / 60, input, g.player);
      g.paused = true;
      g.shake = 0;
      r.render(g, 0, g.player);
    }, frames);
  for (let id = 0; id < 8; id++) {
    const power = await page.evaluate((id) => {
      const g = window.__game(),
        r = window.__renderer;
      g.started = false;
      g.selectHero(0, id);
      g.started = true;
      g.remaining = 10000;
      g.phase = "preparation";
      g.waveAlert = null;
      g.enemies = [];
      g.projectiles = [];
      g.effects = [];
      g.particles = [];
      g.ballistas = [];
      g.defenders
        .slice(1)
        .forEach((d) => Object.assign(d, { dead: 1000, x: 2350, y: 2150 }));
      Object.assign(g.player, {
        x: 1100,
        y: 1100,
        hp: 70,
        ammo: 24,
        cooldown: 0,
        abilityCooldown: 0,
        shot: null,
      });
      Object.assign(r.camera, { x: 1100, y: 1010 });
      for (const x of [1320, 1390, 1460]) {
        g.spawn("goblin", 1);
        Object.assign(g.enemies.at(-1), {
          x,
          y: 1100,
          hp: 10000,
          maxHp: 10000,
          stun: 100,
        });
      }
      const screen = r.screen(g.enemies[0]);
      screen.y -= 48 * r.zoom;
      if (!g.useAbility(g.player, r.world(screen, 117), true))
        throw Error("Power did not start");
      return g.player.shot.power;
    }, id);
    const frames = [];
    for (const [label, count] of [
      ["draw", 10],
      ["flight", 13],
      ["impact", 19],
      ["after", 16],
    ]) {
      await step(count);
      const buffer = await page
        .locator("#game")
        .screenshot({ path: `artifacts/vfx/${power}-${label}.png` });
      frames.push(buffer);
    }
    assert.ok(!frames[0].equals(frames[1]));
    assert.ok(!frames[1].equals(frames[2]));
    assert.ok(!frames[2].equals(frames[3]));
    check(
      `${power}: windup, flight, impact and aftermath render distinct frames`,
    );
  }
  await page.evaluate(() => {
    const g = window.__game(),
      r = window.__renderer;
    g.enemies = [];
    g.effects = [];
    g.projectiles = [];
    g.particles = [];
    g.player.mounted = null;
    g.player.shot = null;
    g.player.x = 1200;
    g.player.y = 650;
    Object.assign(r.camera, { x: 1200, y: 560 });
    r.zoom = 0.9;
    const north = g.walls.filter((w) => w.side === 0);
    north.forEach((w) => (w.hp = w.maxHp));
  });
  const stages = [];
  for (const [label, ratio] of [
    ["intact", 1],
    ["chipped", 0.79],
    ["cracked", 0.54],
    ["critical", 0.24],
    ["collapsed", 0],
  ]) {
    await page.evaluate((ratio) => {
      const g = window.__game();
      const w = g.walls.filter((w) => w.side === 0)[2];
      if (ratio < 1) g.damageWall(w.id, w.hp - w.maxHp * ratio);
    }, ratio);
    await step(label === "collapsed" ? 12 : 5);
    stages.push(
      await page
        .locator("#game")
        .screenshot({ path: `artifacts/vfx/wall-${label}.png` }),
    );
  }
  for (let i = 1; i < stages.length; i++)
    assert.ok(!stages[i - 1].equals(stages[i]));
  assert.ok(
    await page.evaluate(() =>
      window.__game().effects.some((e) => e.kind === "wall-collapse"),
    ),
  );
  await step(120);
  assert.equal(
    await page.evaluate(() =>
      window.__game().effects.some((e) => e.kind === "wall-collapse"),
    ),
    false,
  );
  check(
    "Five wall stages render, collapse animates, and airborne debris expires",
  );
  await page.evaluate(() => {
    const g = window.__game(),
      r = window.__renderer;
    g.effects = [];
    g.particles = [];
    g.ballistas = [];
    Object.assign(g.player, { x: 970, y: 980, cooldown: 0, mounted: null });
    Object.assign(r.camera, { x: 1000, y: 860 });
    const b = g.installBallista({ x: 1000, y: 950 });
    b.angle = -0.2;
    g.player.mounted = b.id;
    b.user = 0;
    g.coins = 100;
    r.render(g, 0, g.player);
  });
  const loaded = await page
    .locator("#game")
    .screenshot({ path: "artifacts/vfx/ballista-loaded.png" });
  await page.evaluate(() => {
    const g = window.__game();
    g.shoot(g.player, { x: 1800, y: 1000 });
  });
  await step(3);
  const fired = await page
    .locator("#game")
    .screenshot({ path: "artifacts/vfx/ballista-release.png" });
  assert.ok(!loaded.equals(fired));
  await page.evaluate(() => {
    const g = window.__game();
    g.reload(g.player);
  });
  const reloadFrames = [];
  for (const [label, n] of [
    ["winch", 65],
    ["insert", 85],
    ["ready", 50],
  ]) {
    await step(n);
    reloadFrames.push(
      await page
        .locator("#game")
        .screenshot({ path: `artifacts/vfx/ballista-${label}.png` }),
    );
  }
  assert.ok(!reloadFrames[0].equals(reloadFrames[1]));
  assert.equal(
    await page.evaluate(() => window.__game().ballistas[0].loaded),
    true,
  );
  check(
    "Ballista release, string recovery, winch and bolt insertion animate through a real reload",
  );
  assert.deepEqual(errors, []);
  check("No Canvas or JavaScript errors across all effect phases");
  await writeFile(
    "artifacts/vfx/results.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(`${checks.length} visual animation checks passed.`);
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
}
