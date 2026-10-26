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
const checks = [],
  errors = [];
const check = (name) => {
  checks.push(name);
  console.log(`✓ ${name}`);
};
try {
  for (let n = 0; n < 80; n++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    if (n === 79) throw new Error("Vite did not start");
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
  await page.waitForFunction(() => {
    const r = window.__renderer;
    return (
      r?.atlasReady &&
      r.propsReady &&
      r.tileReady &&
      r.ballistaAtlasReady &&
      r.walkAtlasReady &&
      r.workerAtlasReady
    );
  });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "artifacts/intro.png" });
  await page.getByRole("button", { name: "Prendre la garde" }).click();
  await page.waitForTimeout(200);
  assert.deepEqual(
    await page.evaluate(() => {
      const g = window.__game();
      g.remaining = 10000;
      return {
        archers: g.defenders.length,
        bows: g.defenders.every((d) => d.weapon === 2),
        ballistas: g.ballistas.length,
        supplies: g.stocks.length,
        points: g.resources,
        worker: g.workshop.state,
      };
    }),
    {
      archers: 3,
      bows: true,
      ballistas: 0,
      supplies: 1,
      points: 0,
      worker: "hidden",
    },
  );
  check(
    "New game starts with three bow archers, one reserve, no ballistas and no points",
  );
  const x = await page.evaluate(() => window.__game().player.x);
  await page.keyboard.down("d");
  await page.waitForTimeout(500);
  await page.keyboard.up("d");
  assert.ok(await page.evaluate((x) => window.__game().player.x > x + 70, x));
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => window.__game().player.moving), false);
  check("Keyboard movement works and the walk state stops on key release");
  const frames = await page.evaluate(async () => {
    const { archerFrame } = await import("/src/animation.ts");
    const g = window.__game(),
      input = {
        keys: new Set(["d"]),
        pressed: new Set(),
        mouse: { x: 0, y: 0 },
        down: false,
        clicked: false,
      },
      seen = new Set();
    for (let n = 0; n < 40; n++) {
      g.update(1 / 60, input, g.player);
      seen.add(archerFrame(g.player));
    }
    input.keys.clear();
    g.update(1 / 60, input, g.player);
    return { seen: [...seen], idle: archerFrame(g.player) };
  });
  assert.equal(frames.seen.length, 4);
  assert.equal(frames.idle, 0);
  const spriteHashes = await page.evaluate(() => {
    const img = window.__renderer.walkAtlas,
      c = document.createElement("canvas");
    c.width = 98;
    c.height = 130;
    const ctx = c.getContext("2d"),
      hashes = [];
    for (let n = 0; n < 4; n++) {
      ctx.clearRect(0, 0, 98, 130);
      ctx.drawImage(
        img,
        (n * img.width) / 4,
        (35 * img.height) / 1254,
        img.width / 4,
        (412 * img.height) / 1254,
        0,
        0,
        98,
        130,
      );
      const pixels = ctx.getImageData(0, 0, 98, 130).data;
      let hash = 0;
      for (const v of pixels) hash = (hash * 31 + v) >>> 0;
      hashes.push(hash);
    }
    return hashes;
  });
  assert.equal(new Set(spriteHashes).size, 4);
  check(
    "All four walking frames execute and contain distinct illustrated poses",
  );
  await page.screenshot({ path: "artifacts/archers-initial.png" });
  const enemyId = await page.evaluate(() => {
    const g = window.__game();
    g.spawn("goblin", 0);
    const e = g.enemies.at(-1);
    e.x = g.player.x + 100;
    e.y = g.player.y;
    return e.id;
  });
  for (let n = 0; n < 3; n++) {
    const pos = await page.evaluate((id) => {
      const e = window.__game().enemies.find((e) => e.id === id);
      if (!e || e.hp <= 0) return null;
      const p = window.__renderer.screen(e);
      return { x: p.x, y: p.y - 25 };
    }, enemyId);
    if (pos) await page.mouse.click(pos.x, pos.y);
    await page.waitForTimeout(700);
  }
  assert.ok(
    await page.evaluate(
      () =>
        window.__game().kills >= 1 &&
        window.__game().resources >= 10 &&
        window.__game().player.ammo < 24,
    ),
  );
  check(
    "Real bow shots kill an enemy, consume ammunition and award spendable points",
  );
  await page.evaluate(() => {
    const g = window.__game(),
      s = g.stocks[0];
    g.player.ammo = 0;
    g.player.x = s.x;
    g.player.y = s.y + 40;
  });
  await page.keyboard.press("e");
  await page.waitForFunction(() => window.__game().player.ammo === 24);
  check("E at the starting reserve refills the quiver");
  // Natural round completion using the actual bow, ammo, AI and movement systems.
  const round = await page.evaluate(() => {
    const g = window.__game(),
      input = {
        keys: new Set(),
        pressed: new Set(),
        mouse: { x: 0, y: 0 },
        down: false,
        clicked: false,
      };
    g.startWave();
    let n = 0;
    for (; n < 60 * 180 && g.phase === "assault"; n++) {
      const p = g.player;
      if (p.dead <= 0) {
        if (p.ammo === 0) {
          const s = g.stocks[0];
          if (Math.hypot(s.x - p.x, s.y - p.y) < 80) g.interact();
          else g.navigate(p, s, 1 / 60, 225);
        } else {
          const post = { x: 970, y: 552 };
          if (Math.hypot(post.x - p.x, post.y - p.y) > 30)
            g.navigate(p, post, 1 / 60, 225);
          const e = g.enemies
            .filter((e) => e.hp > 0)
            .sort(
              (a, b) =>
                Math.hypot(a.x - p.x, a.y - p.y) -
                Math.hypot(b.x - p.x, b.y - p.y),
            )[0];
          if (e) g.shoot(p, e);
        }
      }
      g.update(1 / 60, input, { x: p.x, y: 100 });
    }
    for (let n = 0; n < 140 && g.phase === "preparation"; n++)
      g.update(1 / 60, input, g.player);
    return {
      phase: g.phase,
      wave: g.wave,
      kills: g.kills,
      points: g.resources,
      integrity: g.integrity,
      worker: g.workshop.state,
      seconds: n / 60,
    };
  });
  assert.equal(round.phase, "preparation");
  assert.equal(round.wave, 1);
  assert.equal(round.worker, "ready");
  assert.ok(round.kills >= 14);
  check(
    `First full bow-only round completed: ${round.kills} kills, ${Math.floor(round.points)} points, worker arrived after ${round.seconds.toFixed(1)} s`,
  );
  await page.evaluate(() => {
    const g = window.__game();
    g.player.x = g.workshop.x;
    g.player.y = g.workshop.y + 65;
  });
  await page.waitForTimeout(700);
  await page.keyboard.press("e");
  await page.getByRole("heading", { name: "À votre service." }).waitFor();
  await page.screenshot({ path: "artifacts/worker-shop.png" });
  check(
    "The worker ascends the central stair, speaks and opens the shop with E",
  );
  const before = await page.evaluate(() => window.__game().resources);
  await page.locator('[data-equipment="ballista"]').click();
  assert.equal(
    await page.evaluate(() => window.__game().placement),
    "ballista",
  );
  assert.equal(await page.evaluate(() => window.__game().resources), before);
  const slot = await page.evaluate(() =>
    window.__renderer.screen({ x: 1430, y: 552 }),
  );
  await page.mouse.click(slot.x, slot.y);
  await page.waitForFunction(
    () => window.__game().workshop.job?.kind === "ballista",
  );
  assert.equal(await page.evaluate(() => window.__game().ballistas.length), 0);
  assert.equal(
    await page.evaluate(() => window.__game().resources),
    before - 90,
  );
  await page.screenshot({ path: "artifacts/worker-delivery.png" });
  check(
    "Choosing a marked socket charges once and starts a physical delivery rather than an instant spawn",
  );
  await page.keyboard.press("Tab");
  await page.getByLabel("Ordre pour Brune").selectOption("follow");
  await page.getByLabel("Ordre pour Osric").selectOption("follow");
  await page.keyboard.press("Tab");
  await page.evaluate(() => {
    const g = window.__game(),
      i = {
        keys: new Set(),
        pressed: new Set(),
        mouse: { x: 0, y: 0 },
        down: false,
        clicked: false,
      };
    for (let n = 0; n < 60 * 12; n++) g.update(1 / 60, i, g.player);
  });
  assert.equal(await page.evaluate(() => window.__game().ballistas.length), 1);
  assert.equal(await page.evaluate(() => window.__game().workshop.ready), true);
  check(
    "Worker carries, installs and returns; the ordered ballista now exists at its selected socket",
  );
  await page.evaluate(() => {
    const g = window.__game(),
      b = g.ballistas[0];
    g.player.x = b.x;
    g.player.y = b.y + 35;
  });
  await page.waitForTimeout(700);
  await page.keyboard.press("e");
  await page.waitForFunction(() => window.__game().player.mounted === 0);
  const aim = await page.evaluate(() =>
    window.__renderer.screen({ x: 1430, y: 220 }, 0),
  );
  await page.mouse.click(aim.x, aim.y);
  await page.waitForFunction(() => !window.__game().ballistas[0].loaded);
  await page.keyboard.press("r");
  await page.waitForFunction(() => window.__game().ballistas[0].reload > 0);
  await page.waitForTimeout(3300);
  assert.equal(
    await page.evaluate(() => window.__game().ballistas[0].loaded),
    true,
  );
  await page.keyboard.press("f");
  await page.waitForFunction(() => window.__game().player.carried === 0);
  await page.keyboard.down("s");
  await page.waitForTimeout(650);
  await page.keyboard.up("s");
  assert.ok(await page.evaluate(() => window.__game().ballistas[0].y > 600));
  await page.keyboard.press("e");
  await page.waitForFunction(() => window.__game().player.carried === null);
  check(
    "Purchased ballista can be mounted, aimed, fired, reloaded, moved freely and deposited",
  );
  await page.keyboard.press("b");
  await page.locator('[data-equipment="stock"]').click();
  const supplySpot = await page.evaluate(() =>
    window.__renderer.screen({ x: 1610, y: 1100 }),
  );
  await page.mouse.click(supplySpot.x, supplySpot.y);
  await page.waitForFunction(
    () => window.__game().workshop.job?.kind === "stock",
  );
  await page.evaluate(() => {
    const g = window.__game(),
      i = {
        keys: new Set(),
        pressed: new Set(),
        mouse: { x: 0, y: 0 },
        down: false,
        clicked: false,
      };
    for (let n = 0; n < 60 * 10; n++) g.update(1 / 60, i, g.player);
  });
  assert.equal(await page.evaluate(() => window.__game().stocks.length), 2);
  check(
    "Buying a reserve delivers and installs an actual second ammunition refill location",
  );
  await page.keyboard.press("b");
  await page.locator('[data-upgrade="arrows"]').click();
  assert.equal(await page.evaluate(() => window.__game().level("arrows")), 0);
  await page.evaluate(() => {
    const g = window.__game(),
      i = {
        keys: new Set(),
        pressed: new Set(),
        mouse: { x: 0, y: 0 },
        down: false,
        clicked: false,
      };
    for (let n = 0; n < 60 * 4; n++) g.update(1 / 60, i, g.player);
  });
  assert.equal(await page.evaluate(() => window.__game().level("arrows")), 1);
  check("Purchased arrow upgrade is applied when the worker delivers it");
  await page
    .getByRole("button", { name: "Appeler la prochaine vague" })
    .click();
  assert.equal(await page.evaluate(() => window.__game().wave), 2);
  await page.waitForTimeout(1000);
  assert.ok(await page.evaluate(() => window.__game().enemies.length > 0));
  check("The second round starts with new fronts and the equipment persists");
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => window.__game().paused), true);
  const time = await page.evaluate(() => window.__game().time);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__game().time), time);
  await page.getByRole("button", { name: "Continuer la veille" }).click();
  check("Pause and resume preserve the game state");
  await page.keyboard.press("h");
  await page.getByRole("heading", { name: "Chaque geste compte." }).waitFor();
  await page.keyboard.press("h");
  await page.screenshot({ path: "artifacts/gameplay.png" });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(150);
  assert.equal(
    await page.locator("body").evaluate((el) => el.scrollWidth > innerWidth),
    false,
  );
  check("Help and the desktop HUD work without horizontal overflow");
  await page.evaluate(() => (window.__game().phase = "defeat"));
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "Reprendre la garde" }).click();
  assert.deepEqual(
    await page.evaluate(() => ({
      ballistas: window.__game().ballistas.length,
      stocks: window.__game().stocks.length,
      wave: window.__game().wave,
    })),
    { ballistas: 0, stocks: 1, wave: 0 },
  );
  check(
    "Restart clears purchased gear and restores the bow-only starting state",
  );
  assert.deepEqual(errors, []);
  check("No browser JavaScript or console errors");
  await writeFile(
    "artifacts/browser-results.json",
    JSON.stringify({ checks, round, errors }, null, 2),
  );
  console.log(`\n${checks.length} browser checks passed.`);
} finally {
  await browser?.close();
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
}
