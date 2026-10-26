import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const port = 5174,
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
const checks = [];
const errors = [];
const check = (name) => {
  checks.push(name);
  console.log(`✓ ${name}`);
};
try {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(base);
      if (r.ok) break;
    } catch {}
    if (i === 79) throw new Error("Vite did not start");
    await new Promise((r) => setTimeout(r, 150));
  }
  await mkdir("artifacts", { recursive: true });
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(`${base}/?test`);
  await page.waitForFunction(
    () =>
      window.__renderer?.atlasReady &&
      window.__renderer?.propsReady &&
      window.__renderer?.tileReady &&
      window.__renderer?.ballistaAtlasReady,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "artifacts/intro.png" });
  await page.getByRole("button", { name: "Prendre la garde" }).click();
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.__game().started), true);
  check("Game starts with three live defenders and locally loaded artwork");
  await page.evaluate(() => {
    window.__game().remaining = 10000;
  });
  const x = await page.evaluate(() => window.__game().player.x);
  await page.keyboard.down("d");
  await page.waitForTimeout(500);
  await page.keyboard.up("d");
  assert.ok(
    await page.evaluate((old) => window.__game().player.x > old + 70, x),
  );
  check("WASD input moves the player and the camera follows");
  await page.keyboard.press("1");
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => window.__game().player.weapon), 1);
  let target = await page.evaluate(() => {
    const g = window.__game();
    g.spawn("runner", 0);
    const e = g.enemies.at(-1);
    e.x = g.player.x + 50;
    e.y = g.player.y;
    const p = window.__renderer.screen(e);
    return { id: e.id, x: p.x, y: p.y - 20 };
  });
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(150);
  assert.ok(
    await page.evaluate((id) => {
      const e = window.__game().enemies.find((e) => e.id === id);
      return !e || e.hp < e.maxHp;
    }, target.id),
  );
  check("Mouse aiming and sword attack damage an enemy");
  await page.keyboard.press("2");
  await page.waitForTimeout(500);
  target = await page.evaluate(() => {
    const g = window.__game();
    g.spawn("goblin", 0);
    const e = g.enemies.at(-1);
    e.x = g.player.x + 170;
    e.y = g.player.y;
    const p = window.__renderer.screen(e);
    return { id: e.id, x: p.x, y: p.y - 20 };
  });
  const ammo = await page.evaluate(() => window.__game().player.ammo);
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(500);
  assert.ok(
    await page.evaluate(
      ({ id, ammo }) => {
        const g = window.__game(),
          e = g.enemies.find((e) => e.id === id);
        return g.player.ammo < ammo && (!e || e.hp < e.maxHp);
      },
      { id: target.id, ammo },
    ),
  );
  check("Bow consumes ammunition and an actual projectile hits its target");
  await page.evaluate(() => {
    const g = window.__game();
    g.enemies = [];
    g.player.cooldown = 0;
    const b = g.ballistas[1];
    if (b.user !== null) g.release(g.defenders[b.user]);
    g.player.x = 1430;
    g.player.y = 582;
  });
  await page.waitForTimeout(800);
  await page.keyboard.press("e");
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => window.__game().player.mounted), 1);
  const aim = await page.evaluate(() =>
    window.__renderer.screen({ x: 1430, y: 220 }, 0),
  );
  await page.mouse.click(aim.x, aim.y);
  await page.waitForTimeout(80);
  assert.equal(
    await page.evaluate(() => window.__game().ballistas[1].loaded),
    false,
  );
  await page.keyboard.press("r");
  await page.waitForTimeout(80);
  assert.ok(await page.evaluate(() => window.__game().ballistas[1].reload > 0));
  await page.waitForTimeout(3300);
  assert.equal(
    await page.evaluate(() => window.__game().ballistas[1].loaded),
    true,
  );
  await page.keyboard.press("f");
  await page.waitForTimeout(80);
  const old = await page.evaluate(() => window.__game().ballistas[1].x);
  await page.keyboard.down("a");
  await page.waitForTimeout(400);
  await page.keyboard.up("a");
  assert.ok(
    await page.evaluate((x) => window.__game().ballistas[1].x < x - 20, old),
  );
  await page.keyboard.press("e");
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => window.__game().player.carried), null);
  check(
    "E / click / R / F moves through the full ballista mount, fire, reload, carry and drop cycle",
  );
  await page.evaluate(() => {
    const g = window.__game(),
      w = g.walls[1];
    w.hp = 400;
    g.player.x = w.x;
    g.player.y = w.y + 65;
  });
  const before = await page.evaluate(() => window.__game().walls[1].hp);
  await page.keyboard.down("r");
  await page.waitForTimeout(400);
  await page.keyboard.up("r");
  assert.ok(
    await page.evaluate((hp) => window.__game().walls[1].hp > hp, before),
  );
  check("Holding R repairs a damaged wall with wood");
  await page.keyboard.press("Tab");
  await page.getByLabel("Ordre pour Brune").selectOption("follow");
  assert.equal(
    await page.evaluate(() => window.__game().defenders[1].order),
    "follow",
  );
  await page.getByLabel("Front pour Osric").selectOption("1");
  assert.equal(await page.evaluate(() => window.__game().defenders[2].side), 1);
  await page.keyboard.press("Tab");
  check("Companion order controls update independent AI orders and fronts");
  // A frozen test fixture isolates the purchase UI from a ticking intermission.
  await page.evaluate(() => {
    const g = window.__game();
    g.phase = "preparation";
    g.remaining = 10000;
    g.resources = 300;
  });
  await page.keyboard.press("b");
  await page.locator('[data-upgrade="power"]').click();
  assert.equal(await page.evaluate(() => window.__game().level("power")), 1);
  await page
    .getByRole("button", { name: "Appeler la prochaine vague" })
    .click();
  assert.equal(await page.evaluate(() => window.__game().phase), "assault");
  check(
    "Workshop purchases change real stats and launching a wave starts enemy spawns",
  );
  await page.waitForTimeout(1300);
  assert.ok(await page.evaluate(() => window.__game().enemies.length > 0));
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => window.__game().paused), true);
  const tickTime = await page.evaluate(() => window.__game().time);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__game().time), tickTime);
  await page.getByRole("button", { name: "Continuer la veille" }).click();
  check("Pause freezes the simulation and resume restores it");
  // Advance the same fixed-step simulation without wall-clock waits to exercise a real assault.
  const assault = await page.evaluate(() => {
    const g = window.__game();
    g.defenders[1].order = "auto";
    g.defenders[2].order = "auto";
    g.player.x = 1200;
    g.player.y = 552;
    g.player.hp = 160;
    const i = {
      keys: new Set(),
      pressed: new Set(),
      mouse: { x: 0, y: 0 },
      down: false,
      clicked: false,
    };
    for (let n = 0; n < 60 * 35 && g.phase !== "defeat"; n++) {
      const e = g.enemies
        .filter((e) => e.hp > 0)
        .sort(
          (a, b) =>
            Math.hypot(a.x - g.player.x, a.y - g.player.y) -
            Math.hypot(b.x - g.player.x, b.y - g.player.y),
        )[0];
      if (e) {
        g.player.weapon = 2;
        if (g.player.ammo === 0) g.player.weapon = 1;
        g.shoot(g.player, e);
      }
      g.update(1 / 60, i, e || { x: 1200, y: 100 });
    }
    const firstWaveComplete = g.phase === "preparation" && g.wave === 1;
    for (let n = 0; n < 60 * 45 && g.phase !== "defeat"; n++) {
      const e = g.enemies.find((e) => e.hp > 0);
      if (e && g.player.ammo > 0) g.shoot(g.player, e);
      g.update(1 / 60, i, e || { x: 1200, y: 100 });
    }
    return {
      wave: g.wave,
      kills: g.kills,
      integrity: g.integrity,
      live: g.enemies.filter((e) => e.hp > 0).length,
      phase: g.phase,
      firstWaveComplete,
    };
  });
  assert.ok(assault.kills > 0);
  assert.ok(assault.firstWaveComplete);
  assert.ok(assault.wave >= 2);
  assert.ok(assault.integrity < 1 || assault.kills >= 5);
  check(
    `Assault simulation: ${assault.kills} kills, ${Math.round(assault.integrity * 100)}% integrity, phase ${assault.phase}`,
  );
  await page.evaluate(() => {
    window.__renderer.zoom = 0.66;
  });
  await page.waitForTimeout(350);
  await page.screenshot({ path: "artifacts/gameplay.png" });
  await page.keyboard.press("h");
  await page.getByRole("heading", { name: "Chaque geste compte." }).waitFor();
  await page.keyboard.press("h");
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: "artifacts/desktop-1024.png" });
  assert.equal(
    await page.locator("body").evaluate((el) => el.scrollWidth > innerWidth),
    false,
  );
  check("Help and desktop layout at 1024 × 768 work without overflow");
  await page.evaluate(() => {
    const g = window.__game();
    g.phase = "defeat";
  });
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Reprendre la garde" }).click();
  assert.equal(await page.evaluate(() => window.__game().phase), "preparation");
  assert.equal(await page.evaluate(() => window.__game().wave), 0);
  check("Defeat screen starts a clean new game");
  assert.deepEqual(errors, []);
  check("No browser console or JavaScript errors");
  await writeFile(
    "artifacts/browser-results.json",
    JSON.stringify({ checks, assault, errors }, null, 2),
  );
  console.log(`\n${checks.length} browser checks passed.`);
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
}
