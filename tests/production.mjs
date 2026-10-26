import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium } from "@playwright/test";

const root = resolve("dist");
const prefix = "/LeChateauDuRenard/";
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const target = resolve(root, pathname.slice(prefix.length) || "index.html");
  if (!pathname.startsWith(prefix) || !target.startsWith(root + "/")) {
    res.writeHead(404).end();
    return;
  }
  try {
    const data = await readFile(target);
    res
      .writeHead(200, {
        "Content-Type": types[extname(target)] || "application/octet-stream",
      })
      .end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(`http://127.0.0.1:${server.address().port}${prefix}?test`);
  await page.waitForFunction(
    () =>
      window.__renderer?.atlasReady &&
      window.__renderer?.propsReady &&
      window.__renderer?.tileReady &&
      window.__renderer?.ballistaAtlasReady &&
      window.__renderer?.walkAtlasReady &&
      window.__renderer?.workerAtlasReady &&
      window.__renderer?.heroAssetsReady,
  );
  await page.getByRole("button", { name: "Prendre la garde" }).click();
  await page.waitForFunction(
    () => window.__game().started && window.__game().tick > 10,
  );
  const x = await page.evaluate(() => window.__game().player.x);
  await page.keyboard.down("d");
  await page.waitForTimeout(350);
  await page.keyboard.up("d");
  assert.ok(await page.evaluate((x) => window.__game().player.x > x + 30, x));
  assert.deepEqual(errors, []);
  console.log(
    "✓ Production bundle works under /LeChateauDuRenard/: scripts, fonts, images, game start and movement.",
  );
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
