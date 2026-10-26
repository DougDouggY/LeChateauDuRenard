import type { Simulation } from "./simulation";
import {
  type Vec,
  type Defender,
  type Enemy,
  type Ballista,
  type Wall,
  type Stock,
  type CombatEffect,
  type PowerId,
  clamp,
} from "./types";
import {
  WORLD,
  FORT,
  POSTS,
  FLOOR_HEIGHT,
  CENTRAL_STAIR,
  elevation,
  insideFort,
} from "./map";
import { projectileHeight } from "./combat";
import { archerFrame, WALK_ROWS, SHOT_ROWS, spriteFrame } from "./animation";
import { hero, WALK_SHEETS, SHOT_SHEETS } from "./heroes";
import type { Workshop } from "./workshop";
import { RenderCache } from "./render-cache";
import {
  frontState,
  priorityFront,
  FRONT_COLORS,
  DEFENSE_POSTS,
  SECTOR_BANDS,
  type FrontState,
} from "./fronts";
import { SIDES } from "./types";
type Ctx = CanvasRenderingContext2D;
const P = (x: number, y: number, z = 0) => ({ x, y: y * 0.72 - z });
function path(
  c: Ctx,
  points: number[][],
  fill: string,
  stroke = "#18242a",
  width = 2,
) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.stroke();
  }
}
function ellipse(
  c: Ctx,
  x: number,
  y: number,
  rx: number,
  ry: number,
  fill: string,
  stroke = "",
  width = 2,
) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = width;
    c.stroke();
  }
}
function line(c: Ctx, a: number[], b: number[], color: string, w = 2) {
  c.beginPath();
  c.moveTo(a[0], a[1]);
  c.lineTo(b[0], b[1]);
  c.strokeStyle = color;
  c.lineWidth = w;
  c.stroke();
}
function polyWorld(
  c: Ctx,
  points: number[][],
  fill: string,
  stroke = "",
  z = 0,
) {
  path(
    c,
    points.map(([x, y]) => {
      const p = P(x, y, z);
      return [p.x, p.y];
    }),
    fill,
    stroke,
  );
}
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export class Renderer {
  ctx: Ctx;
  w = 0;
  h = 0;
  dpr = 1;
  camera = { x: 1200, y: 1100 };
  zoom = 0.8;
  terrain: HTMLCanvasElement;
  atlas = new Image();
  atlasReady = false;
  props = new Image();
  propsReady = false;
  tile = new Image();
  tileReady = false;
  ballistaAtlas = new Image();
  ballistaAtlasReady = false;
  walkAtlas = new Image();
  walkAtlasReady = false;
  workerAtlas = new Image();
  workerAtlasReady = false;
  heroWalk = [new Image(), new Image()];
  heroShot = [new Image(), new Image()];
  arrowAtlas = new Image();
  arrowAtlasReady = false;
  floorProps = new Image();
  floorPropsReady = false;
  portraits = new Map<number, string>();
  cache = new RenderCache();
  miniTerrain: HTMLCanvasElement | null = null;
  sceneTerrain: HTMLCanvasElement | null = null;
  private sceneSignature = "";
  overview = false;
  private savedZoom = 0.8;
  toggleOverview() {
    this.overview = !this.overview;
    if (this.overview) this.savedZoom = this.zoom;
    else this.zoom = this.savedZoom;
  }
  autoQuality = true;
  qualityRatio = 2;
  private slowFrames = 0;
  private fastFrames = 0;
  drawCalls = 0;
  get view() {
    const halfW = this.w / (2 * this.zoom),
      halfH = this.h / (2 * this.zoom);
    return {
      left: this.camera.x - halfW,
      right: this.camera.x + halfW,
      top: this.camera.y * 0.72 - halfH,
      bottom: this.camera.y * 0.72 + halfH,
    };
  }
  visible(p: Vec, z = elevation(p), top = 180, bottom = 25, width = 85) {
    const v = this.view,
      y = p.y * 0.72 - z;
    return (
      p.x + width >= v.left &&
      p.x - width <= v.right &&
      y + bottom >= v.top &&
      y - top <= v.bottom
    );
  }
  observeFrame(ms: number) {
    if (!this.autoQuality) return;
    if (ms > 30) {
      this.slowFrames += Math.min(ms, 100);
      this.fastFrames = 0;
    } else {
      this.slowFrames = Math.max(0, this.slowFrames - 40);
      this.fastFrames = ms < 20 ? this.fastFrames + ms : 0;
    }
    if (this.slowFrames > 900 && this.dpr > 1) {
      this.qualityRatio = Math.max(1, this.dpr - 0.25);
      this.slowFrames = 0;
      this.resize();
    } else if (
      this.fastFrames > 10000 &&
      this.dpr < Math.min(2, window.devicePixelRatio || 1)
    ) {
      this.qualityRatio = Math.min(2, this.dpr + 0.25);
      this.fastFrames = 0;
      this.resize();
    }
  }
  assetError = false;
  get ready() {
    return (
      this.heroAssetsReady &&
      this.atlasReady &&
      this.propsReady &&
      this.tileReady &&
      this.ballistaAtlasReady &&
      this.workerAtlasReady
    );
  }
  get heroAssetsReady() {
    return (
      [...this.heroWalk, ...this.heroShot].every(
        (i) => i.complete && i.naturalWidth > 0,
      ) &&
      this.arrowAtlasReady &&
      this.floorPropsReady
    );
  }
  lastTime = 0;
  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.terrain = this.makeTerrain();
    this.atlas.onload = () => (this.atlasReady = true);
    this.atlas.src = import.meta.env.BASE_URL + "assets/characters.png";
    this.props.onload = () => {
      this.propsReady = true;
      this.terrain = this.makeTerrain();
    };
    this.props.src = import.meta.env.BASE_URL + "assets/props.png";
    this.tile.onload = () => {
      this.tileReady = true;
      this.terrain = this.makeTerrain();
    };
    this.tile.src = import.meta.env.BASE_URL + "assets/courtyard.png";
    this.ballistaAtlas.onload = () => (this.ballistaAtlasReady = true);
    this.ballistaAtlas.src = import.meta.env.BASE_URL + "assets/ballistas.png";
    for (const group of [0, 1]) {
      this.heroWalk[group].onload = () => {
        this.walkAtlasReady = this.heroWalk.every(
          (i) => i.complete && i.naturalWidth > 0,
        );
        if (group === 0) this.walkAtlas = this.heroWalk[0];
        this.portraits.clear();
      };
      this.heroWalk[group].src = import.meta.env.BASE_URL + WALK_SHEETS[group];
      this.heroShot[group].src = import.meta.env.BASE_URL + SHOT_SHEETS[group];
    }
    this.arrowAtlas.onload = () => (this.arrowAtlasReady = true);
    this.arrowAtlas.src = import.meta.env.BASE_URL + "assets/arrows-v3.png";
    this.floorProps.onload = () => (this.floorPropsReady = true);
    this.floorProps.src =
      import.meta.env.BASE_URL + "assets/floor-props-v3.png";
    this.workerAtlas.onload = () => (this.workerAtlasReady = true);
    this.workerAtlas.src = import.meta.env.BASE_URL + "assets/worker-walk.png";
    for (const image of [
      this.atlas,
      this.props,
      this.tile,
      this.ballistaAtlas,
      this.workerAtlas,
      ...this.heroWalk,
      ...this.heroShot,
      this.arrowAtlas,
      this.floorProps,
    ]) {
      const loaded = image.onload;
      image.onload = (e) => {
        this.cache.clear();
        this.miniTerrain = null;
        this.sceneTerrain = null;
        if (loaded) loaded.call(image, e);
        window.dispatchEvent(new Event("hero-art-ready"));
      };
      image.onerror = () => {
        this.assetError = true;
        window.dispatchEvent(new Event("hero-art-ready"));
      };
    }
    this.resize();
  }
  heroPortrait(id: number): string {
    if (this.portraits.has(id)) return this.portraits.get(id)!;
    const h = hero(id),
      img = this.heroWalk[h.group];
    if (!img.complete || !img.naturalWidth) return "";
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 220;
    const c = canvas.getContext("2d")!,
      row = WALK_ROWS[h.group][h.row];
    c.drawImage(
      img,
      0,
      (row.y * img.height) / 1254,
      img.width / 4,
      (row.h * img.height) / 1254,
      0,
      0,
      200,
      220,
    );
    const url = canvas.toDataURL();
    this.portraits.set(id, url);
    return url;
  }
  resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.qualityRatio);
    this.canvas.width = this.w * this.dpr;
    this.canvas.height = this.h * this.dpr;
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
  }
  screen(p: Vec, z = elevation(p)) {
    return {
      x: (p.x - this.camera.x) * this.zoom + this.w / 2,
      y: (p.y * 0.72 - z - this.camera.y * 0.72) * this.zoom + this.h / 2,
    };
  }
  world(p: Vec, z = 0) {
    return {
      x: (p.x - this.w / 2) / this.zoom + this.camera.x,
      y: ((p.y - this.h / 2) / this.zoom + this.camera.y * 0.72 + z) / 0.72,
    };
  }
  makeTerrain() {
    const canvas = document.createElement("canvas");
    canvas.width = 2400;
    canvas.height = 1700;
    const c = canvas.getContext("2d")!,
      r = rng(481);
    c.fillStyle = "#152f32";
    c.fillRect(0, 0, 2400, 1700);
    // Moss, grass, pebbles and the old road remain deterministic between frames.
    for (let i = 0; i < 7500; i++) {
      const x = r() * 2400,
        y = r() * 2200;
      if (x > 500 && x < 1900 && y > 460 && y < 1740) continue;
      const p = P(x, y);
      ellipse(
        c,
        p.x,
        p.y,
        2 + r() * 16,
        1 + r() * 7,
        ["#193b39", "#1c393b", "#203c3b", "#244344", "#2b4141"][
          Math.floor(r() * 5)
        ],
      );
    }
    polyWorld(
      c,
      [
        [1090, 1710],
        [1310, 1710],
        [1350, 2200],
        [1050, 2200],
      ],
      "#43494a",
    );
    polyWorld(
      c,
      [
        [1140, 0],
        [1260, 0],
        [1290, 490],
        [1110, 490],
      ],
      "#354246",
    );
    // One continuous elevated fighting platform: no internal level changes.
    const top = FORT.top * 0.72 - FLOOR_HEIGHT;
    polyWorld(
      c,
      [
        [FORT.left, FORT.top],
        [FORT.right, FORT.top],
        [FORT.right, FORT.bottom],
        [FORT.left, FORT.bottom],
      ],
      "#5e6c72",
      "#243e49",
      FLOOR_HEIGHT,
    );
    if (this.tileReady) {
      const pattern = c.createPattern(this.tile, "repeat")!;
      pattern.setTransform(new DOMMatrix().scale(0.5, 0.36));
      c.fillStyle = pattern;
      c.fillRect(
        FORT.left,
        top,
        FORT.right - FORT.left,
        (FORT.bottom - FORT.top) * 0.72,
      );
    }
    c.fillStyle = "#55768a12";
    c.fillRect(
      FORT.left,
      top,
      FORT.right - FORT.left,
      (FORT.bottom - FORT.top) * 0.72,
    );
    // A flat inlaid border marks the patrol circuit without obstructing movement.
    c.strokeStyle = "#a2a68955";
    c.lineWidth = 3;
    c.strokeRect(
      FORT.left + 115,
      top + 83,
      FORT.right - FORT.left - 230,
      (FORT.bottom - FORT.top) * 0.72 - 166,
    );
    for (const [x, y, label] of [
      [1200, 730, "NORD"],
      [1620, 1100, "EST"],
      [1200, 1470, "SUD"],
      [780, 1100, "OUEST"],
    ] as const) {
      const p = P(x, y, FLOOR_HEIGHT);
      c.font = "bold 15px Georgia";
      c.textAlign = "center";
      c.fillStyle = "#a4b4ad55";
      c.fillText(label, p.x, p.y);
    }
    // A forest border with layered, illustrated evergreen silhouettes.
    for (let i = 0; i < 150; i++) {
      const x = r() * 2400,
        y = r() * 2200;
      if (x > 350 && x < 2040 && y > 320 && y < 1880) continue;
      this.tree(c, x, y, 45 + r() * 35, r());
    }
    return canvas;
  }
  tree(c: Ctx, x: number, y: number, size: number, variation: number) {
    const p = P(x, y);
    if (this.propsReady) {
      c.save();
      c.globalAlpha = 0.75;
      this.prop(c, 3, p.x, p.y, size * 2.8, size * 2.6);
      c.restore();
      return;
    }
    ellipse(c, p.x + 8, p.y + 5, size * 0.6, size * 0.25, "#0b2228");
    c.fillStyle = "#3b3b31";
    c.fillRect(p.x - 6, p.y - size * 0.5, 12, size * 0.55);
    for (let j = 0; j < 3; j++) {
      const cy = p.y - size * 0.3 - j * size * 0.32,
        w = size * (0.65 - j * 0.13);
      path(
        c,
        [
          [p.x - w, cy],
          [p.x - w * 0.65, cy - size * 0.2],
          [p.x - w * 0.8, cy - size * 0.2],
          [p.x, cy - size * 0.8],
          [p.x + w * 0.8, cy - size * 0.2],
          [p.x + w * 0.65, cy - size * 0.2],
          [p.x + w, cy],
        ],
        variation > 0.5 ? "#193b3b" : "#214343",
        "#102a31",
        2,
      );
      line(
        c,
        [p.x, cy - size * 0.65],
        [p.x - w * 0.55, cy - size * 0.08],
        "#2b5049",
        2,
      );
    }
  }
  fortScene(g: Simulation): HTMLCanvasElement {
    const signature = g.walls
      .map((w) => (w.hp <= 0 ? 0 : w.hp < w.maxHp * 0.65 ? 1 : 2))
      .join("");
    if (!this.sceneTerrain) {
      this.sceneTerrain = document.createElement("canvas");
      this.sceneTerrain.width = this.terrain.width;
      this.sceneTerrain.height = this.terrain.height;
      this.sceneSignature = "";
    }
    if (signature !== this.sceneSignature) {
      const ctx = this.sceneTerrain.getContext("2d")!;
      ctx.clearRect(0, 0, this.sceneTerrain.width, this.sceneTerrain.height);
      ctx.drawImage(this.terrain, 0, 0);
      for (const wall of g.walls) this.wallArt(ctx, wall);
      this.sceneSignature = signature;
    }
    return this.sceneTerrain;
  }
  render(g: Simulation, dt: number, aim: Vec) {
    const c = this.ctx,
      p = g.player;
    if (this.overview) {
      this.camera.x = 1200;
      this.camera.y = 1100;
    } else if (g.started) {
      this.camera.x += (p.x - this.camera.x) * (1 - Math.exp(-dt * 5));
      this.camera.y += (p.y - 90 - this.camera.y) * (1 - Math.exp(-dt * 5));
    } else {
      this.camera.x = 1200;
      this.camera.y = 1100;
    }
    if (this.overview)
      this.zoom = Math.min(
        (this.w - Math.min(430, this.w * 0.25)) / 1780,
        (this.h - 220) / 1120,
      );
    // Keep the viewport inside the world when following a defender at an edge.
    this.zoom = Math.max(
      this.zoom,
      this.w / WORLD.w,
      this.h / (WORLD.h * 0.72),
    );
    const halfWidth = this.w / (2 * this.zoom);
    const halfHeight = this.h / (2 * this.zoom * 0.72);
    this.camera.x = clamp(this.camera.x, halfWidth, WORLD.w - halfWidth);
    this.camera.y = clamp(this.camera.y, halfHeight, WORLD.h - halfHeight);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = "#101f29";
    c.fillRect(0, 0, this.w, this.h);
    c.save();
    c.translate(
      this.w / 2 - this.camera.x * this.zoom + (Math.random() - 0.5) * g.shake,
      this.h / 2 -
        this.camera.y * 0.72 * this.zoom +
        (Math.random() - 0.5) * g.shake,
    );
    c.scale(this.zoom, this.zoom);
    c.drawImage(this.fortScene(g), 0, 0);
    this.drawCalls = 1;
    const fronts = frontState(g);
    this.frontZones(c, g, fronts);
    const objects: { depth: number; draw: () => void }[] = [];
    objects.push({
      depth: CENTRAL_STAIR.y * 0.72 - 10,
      draw: () => this.centralAccess(c, g),
    });
    for (const w of g.walls)
      if (
        this.visible(
          w,
          0,
          (w.h * 0.72) / 2 + 110,
          (w.h * 0.72) / 2 + 30,
          w.w / 2 + 40,
        )
      )
        objects.push({
          depth: w.y * 0.72 + 6,
          draw: () => this.wall(c, w, fronts[w.side].active),
        });
    for (const pos of [
      [530, 490],
      [1870, 490],
      [530, 1710],
      [1870, 1710],
    ])
      objects.push({
        depth: pos[1] * 0.72 + 30,
        draw: () => this.tower(c, pos[0], pos[1], g.time),
      });
    for (const site of g.availableSites("ballista"))
      objects.push({
        depth: site.y * 0.72,
        draw: () =>
          this.slot(c, site, "ballista", g.placement === "ballista", aim),
      });
    if (g.placement === "stock")
      for (const site of g.availableSites("stock"))
        objects.push({
          depth: site.y * 0.72,
          draw: () => this.slot(c, site, "stock", true, aim),
        });
    for (const stock of g.stocks)
      objects.push({
        depth: stock.y * 0.72,
        draw: () => this.stock(c, stock, g.time),
      });
    if (g.workshop.state !== "hidden")
      objects.push({
        depth: g.workshop.y * 0.72,
        draw: () => this.worker(c, g.workshop),
      });
    for (const b of g.ballistas)
      objects.push({
        depth: b.y * 0.72,
        draw: () => this.ballista(c, b, g.time),
      });
    for (const a of [...g.defenders, ...g.enemies])
      if (this.visible(a))
        objects.push({
          depth: a.y * 0.72,
          draw: () => this.actor(c, a, g.time, a.id === 0),
        });
    for (const q of g.pickups) {
      const pp = P(q.x, q.y, elevation(q));
      c.save();
      c.translate(pp.x, pp.y - 5 + Math.sin(g.time * 3 + q.id) * 3);
      ellipse(c, 0, 4, 12, 6, "#26322b");
      path(
        c,
        [
          [-10, -5],
          [6, -12],
          [13, -4],
          [-4, 5],
        ],
        "#b8975c",
        "#352f28",
      );
      line(c, [-4, -2], [8, -9], "#f6ce7d", 3);
      c.restore();
    }
    objects.sort((a, b) => a.depth - b.depth);
    for (const o of objects) {
      o.draw();
      this.drawCalls++;
    }
    // Ballistic arcs are independent of wall collision, so bolts clear the parapets.
    for (const q of g.projectiles) {
      if (!this.visible(q, elevation(q) + 65, 120, 100, 110)) continue;
      const z = projectileHeight(q),
        pp = P(q.x, q.y, z),
        dir = Math.atan2(q.vy * 0.72, q.vx);
      c.save();
      c.translate(pp.x, pp.y);
      c.rotate(dir);
      if (q.kind === "fire") {
        const glow = c.createRadialGradient(0, 0, 1, 0, 0, 23);
        glow.addColorStop(0, "#ffcc76");
        glow.addColorStop(1, "#fb752000");
        c.fillStyle = glow;
        c.fillRect(-23, -23, 46, 46);
        ellipse(c, 0, 0, 7, 6, "#ffd18a", "#d86b3f");
      } else if (this.arrowAtlasReady) {
        const slots: Record<PowerId, number> = {
          explosive: 1,
          multishot: 0,
          fire: 2,
          frost: 3,
          piercing: 4,
          moon: 5,
          poison: 6,
          lightning: 7,
        };
        const index = q.power ? slots[q.power] : 0;
        if (q.power) {
          const colors: Record<PowerId, string> = {
            explosive: "#f4b366",
            multishot: "#b9dca7",
            fire: "#ff8b4e",
            frost: "#a2e7ff",
            piercing: "#ca9bff",
            moon: "#f0e3a7",
            poison: "#a6da6f",
            lightning: "#9ef5f2",
          };
          c.shadowColor = colors[q.power];
          c.shadowBlur = 0;
          line(c, [-64, 0], [-30, 0], colors[q.power], 3);
          c.shadowBlur = 0;
        }
        const w =
          q.kind === "bolt" ? 83 : q.power ? 64 : q.team === "enemy" ? 60 : 53;
        const sprite = this.cache.sprite(
          `arrow:${index}:${w}`,
          this.arrowAtlas,
          ((index % 4) * this.arrowAtlas.width) / 4,
          ((index < 4 ? 390 : 675) * this.arrowAtlas.height) / 1254,
          this.arrowAtlas.width / 4,
          (190 * this.arrowAtlas.height) / 1254,
          w,
          w * 0.6,
        );
        if (q.team === "enemy") line(c, [-75, 0], [-20, 0], "#f5a384", 2.5);
        else if (!q.power) line(c, [-49, 0], [-24, 0], "#e7dab17a", 1.5);
        c.drawImage(sprite, -w * 0.86, -w * 0.3, w, w * 0.6);
      } else
        line(c, [-28, 0], [8, 0], q.team === "ally" ? "#e5d9bc" : "#d89773", 3);
      c.restore();
    }
    for (const q of g.particles) {
      if (!this.visible(q, elevation(q) + 14, 15, 15, 15)) continue;
      const pp = P(q.x, q.y, elevation(q) + 14);
      c.globalAlpha = clamp(q.life / 0.4, 0, 1);
      c.fillStyle = q.color;
      c.fillRect(pp.x, pp.y, q.size, q.size);
    }
    c.globalAlpha = 1;
    for (const effect of g.effects) this.combatEffect(c, effect);
    // Warm pooled torch light, drawn over actual geometry.
    for (const pos of [
      [570, 560],
      [1830, 560],
      [570, 1640],
      [1830, 1640],
      [1100, 500],
      [1300, 500],
      [1100, 1700],
      [1300, 1700],
      [530, 1000],
      [1870, 1000],
      [820, 830],
      [1570, 1350],
    ])
      this.torch(c, pos[0], pos[1], g.time);
    if (g.started && p.dead <= 0) {
      const a = P(aim.x, aim.y, elevation(aim));
      c.strokeStyle = "#ead7a8";
      c.lineWidth = 1.4;
      c.globalAlpha = 0.75;
      ellipse(c, a.x, a.y, 8, 8, "", "#ead7a8", 1);
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ])
        line(
          c,
          [a.x + dx * 12, a.y + dy * 12],
          [a.x + dx * 17, a.y + dy * 17],
          "#ead7a8",
          1.4,
        );
      c.globalAlpha = 1;
    }
    c.restore();
    this.frontPointers(c, g, fronts);
  }

  frontZones(c: Ctx, g: Simulation, fronts: FrontState[]) {
    if (!g.started) return;
    for (const f of fronts) {
      const preview = g.wave === 0 && g.phase === "preparation" && f.side === 0;
      if (!f.active && !preview) continue;
      const b = SECTOR_BANDS[f.side],
        p = P(b.x, b.y, FLOOR_HEIGHT),
        color = FRONT_COLORS[f.side];
      c.save();
      c.fillStyle = color;
      c.globalAlpha = f.active ? 0.09 + 0.025 * Math.sin(g.time * 3) : 0.045;
      c.fillRect(p.x, p.y, b.w, b.h * 0.72);
      c.globalAlpha = 0.7;
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.setLineDash([14, 11]);
      c.strokeRect(p.x + 4, p.y + 4, b.w - 8, b.h * 0.72 - 8);
      c.setLineDash([]);
      c.globalAlpha = 1;
      const target = DEFENSE_POSTS[f.side],
        label = P(target.x, target.y, FLOOR_HEIGHT);
      c.fillStyle = "#10232be8";
      c.strokeStyle = color;
      c.lineWidth = 1;
      c.beginPath();
      c.roundRect(label.x - 129, label.y - 24, 258, 48, 5);
      c.fill();
      c.stroke();
      c.font = "bold 13px sans-serif";
      c.fillStyle = color;
      c.textAlign = "center";
      c.fillText(
        `${SIDES[f.side].toUpperCase()} · ${f.enemies ? `${f.enemies} ENNEMI${f.enemies > 1 ? "S" : ""}` : f.active ? "EN APPROCHE" : "PROCHAIN ASSAUT"}`,
        label.x,
        label.y - 5,
      );
      c.font = "10px sans-serif";
      c.fillStyle = "#d3d7c2";
      c.fillText(
        `DÉFENDRE ICI · REMPART ${Math.round(f.integrity * 100)} %${f.breaches ? " · BRÈCHE !" : ""}`,
        label.x,
        label.y + 12,
      );
      const a = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][f.side];
      for (const offset of [-210, 210]) {
        const x = target.x + (f.side % 2 === 0 ? offset : 0),
          y = target.y + (f.side % 2 === 1 ? offset : 0),
          q = P(x, y, FLOOR_HEIGHT);
        c.save();
        c.translate(q.x, q.y);
        c.scale(1, 0.72);
        c.rotate(a);
        path(
          c,
          [
            [14, 0],
            [-8, -12],
            [-3, 0],
            [-8, 12],
          ],
          color,
          "#182f39",
          1,
        );
        c.restore();
      }
      c.restore();
    }
    const focus = priorityFront(g, fronts);
    if (focus && insideFort(g.player)) {
      const target = DEFENSE_POSTS[focus.side],
        dist = Math.hypot(target.x - g.player.x, target.y - g.player.y);
      if (dist > 185) {
        const t = Math.min(1, 235 / dist),
          a = P(g.player.x, g.player.y, FLOOR_HEIGHT),
          b = P(
            g.player.x + (target.x - g.player.x) * t,
            g.player.y + (target.y - g.player.y) * t,
            FLOOR_HEIGHT,
          );
        c.save();
        c.strokeStyle = FRONT_COLORS[focus.side];
        c.globalAlpha = 0.55;
        c.lineWidth = 2;
        c.setLineDash([6, 10]);
        line(c, [a.x, a.y], [b.x, b.y], FRONT_COLORS[focus.side], 2);
        c.setLineDash([]);
        c.restore();
      }
    }
  }
  frontPointers(c: Ctx, g: Simulation, fronts: FrontState[]) {
    if (!g.started || g.phase !== "assault") return;
    const pad = Math.min(290, Math.max(170, this.w * 0.215)),
      top = 122,
      bottom = this.h - 150;
    for (const f of fronts)
      if (f.active) {
        const p = this.screen(DEFENSE_POSTS[f.side]);
        if (p.x > pad && p.x < this.w - pad && p.y > top && p.y < bottom)
          continue;
        const x = clamp(p.x, pad, this.w - pad),
          y = clamp(p.y, top, bottom),
          color = FRONT_COLORS[f.side];
        c.save();
        c.fillStyle = "#0c1f2bef";
        c.strokeStyle = color;
        c.lineWidth = 1;
        c.beginPath();
        c.roundRect(x - 83, y - 18, 166, 36, 5);
        c.fill();
        c.stroke();
        c.font = "bold 12px sans-serif";
        c.fillStyle = color;
        c.textAlign = "center";
        c.fillText(
          `${["↑", "→", "↓", "←"][f.side]} ${SIDES[f.side].toUpperCase()} · ${f.enemies || "EN APPROCHE"}${f.breaches ? " !" : ""}`,
          x,
          y + 4,
        );
        c.restore();
      }
  }
  combatEffect(c: Ctx, e: CombatEffect) {
    if (
      !this.visible(
        e,
        elevation(e) + 30,
        e.radius + 120,
        e.radius + 70,
        e.radius + 70,
      )
    )
      return;
    const progress = 1 - e.life / e.total,
      p = P(e.x, e.y, elevation(e));
    c.save();
    c.globalAlpha = Math.min(1, e.life / 0.2);
    if (e.kind === "damage") {
      c.fillStyle = "#101e28";
      c.font = "bold 14px sans-serif";
      c.textAlign = "center";
      c.strokeStyle = "#101e28";
      c.lineWidth = 3;
      c.strokeText(String(e.amount), p.x, p.y - 95 - progress * 35);
      c.fillStyle = e.color;
      c.fillText(String(e.amount), p.x, p.y - 95 - progress * 35);
    } else if (e.kind === "coins") {
      c.translate(p.x, p.y - 65 - progress * 42);
      ellipse(c, -19, 0, 6, 8, "#dab25a", "#715b30", 1.5);
      ellipse(c, -19, 0, 3, 5, "", "#ffe4a0", 1);
      c.font = "bold 13px sans-serif";
      c.fillStyle = "#ffe0a0";
      c.fillText(`+${e.amount} or`, -8, 4);
    } else if (e.kind === "ammo" && e.target) {
      const to = P(e.target.x, e.target.y, FLOOR_HEIGHT + 70);
      for (let i = 0; i < 3; i++) {
        const t = clamp(progress * 1.4 - i * 0.12, 0, 1),
          x = p.x + (to.x - p.x) * t,
          y = p.y - 55 + (to.y - (p.y - 55)) * t - Math.sin(t * Math.PI) * 35;
        c.save();
        c.translate(x, y);
        c.rotate(Math.atan2(to.y - p.y, to.x - p.x));
        line(c, [-12, 0], [9, 0], "#f7dda4", 2);
        path(
          c,
          [
            [13, 0],
            [6, -3],
            [6, 3],
          ],
          "#f4e9c8",
          "",
          0,
        );
        c.restore();
      }
    } else if (e.kind === "lightning" && e.points) {
      c.shadowBlur = 0;
      c.shadowColor = e.color;
      for (let i = 1; i < e.points.length; i++) {
        const a = P(
            e.points[i - 1].x,
            e.points[i - 1].y,
            elevation(e.points[i - 1]) + 38,
          ),
          b = P(e.points[i].x, e.points[i].y, elevation(e.points[i]) + 38);
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo((a.x + b.x) / 2 + 13, (a.y + b.y) / 2 - 20);
        c.lineTo((a.x + b.x) / 2 - 9, (a.y + b.y) / 2 + 8);
        c.lineTo(b.x, b.y);
        c.strokeStyle = e.color;
        c.lineWidth = 3;
        c.stroke();
      }
    } else if (e.kind === "heal") {
      ellipse(c, p.x, p.y - 20 - progress * 40, 23, 9, "", e.color, 2);
      if (e.amount) {
        c.fillStyle = e.color;
        c.font = "bold 12px sans-serif";
        c.fillText(`+${e.amount}`, p.x - 11, p.y - 90 - progress * 20);
      }
    } else {
      const radius = e.radius * (0.25 + 0.75 * progress);
      c.translate(p.x, p.y - 18);
      c.scale(1, 0.72);
      const glow = c.createRadialGradient(0, 0, 1, 0, 0, radius);
      glow.addColorStop(0, e.kind === "explosion" ? "#ffe4aabb" : "#a8eaff55");
      glow.addColorStop(1, e.kind === "explosion" ? "#f9a25100" : "#a8eaff00");
      c.fillStyle = glow;
      c.fillRect(-radius, -radius, radius * 2, radius * 2);
      ellipse(c, 0, 0, radius, radius, "", e.color, 3 * (1 - progress) + 1);
      if (e.kind === "frost")
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          line(
            c,
            [Math.cos(a) * radius * 0.65, Math.sin(a) * radius * 0.65],
            [Math.cos(a) * radius, Math.sin(a) * radius],
            e.color,
            2,
          );
        }
    }
    c.restore();
  }
  wall(c: Ctx, w: Wall, active = false) {
    if (w.hp > 0 && (active || w.hp < w.maxHp * 0.98)) {
      const y = w.y * 0.72 - (w.w > w.h ? 10 : (w.h * 0.72) / 2) - 88,
        bar = w.w > w.h ? 74 : 49;
      c.fillStyle = "#0a1b25";
      c.fillRect(w.x - bar / 2 - 2, y - 2, bar + 4, 9);
      c.fillStyle =
        w.hp < w.maxHp * 0.3
          ? "#ed977d"
          : w.hp < w.maxHp * 0.65
            ? "#dfbd7d"
            : "#91c5ad";
      c.fillRect(w.x - bar / 2, y, (bar * w.hp) / w.maxHp, 5);
      if (w.hp < w.maxHp * 0.98) {
        c.font = "bold 10px sans-serif";
        c.textAlign = "center";
        c.fillStyle = "#e6d6b6";
        c.fillText(`${Math.ceil(w.hp)} / ${w.maxHp}`, w.x, y - 7);
      }
    }
  }
  wallArt(c: Ctx, w: Wall) {
    const p = P(w.x, w.y),
      horizontal = w.w > w.h,
      width = horizontal ? w.w : 28,
      height = horizontal ? 20 : w.h * 0.72;
    if (w.hp <= 0) {
      for (let i = 0; i < 8; i++) {
        const xx = p.x - width / 2 + ((i * 41) % width),
          yy = p.y - height / 2 + ((i * 31) % height);
        path(
          c,
          [
            [xx, yy],
            [xx + 17, yy - 6],
            [xx + 26, yy + 4],
            [xx + 10, yy + 10],
          ],
          "#66767b",
          "#31464c",
        );
      }
      return;
    }
    const top = p.y - height / 2 - 58,
      bottom = p.y + height / 2;
    c.fillStyle = "#273c46";
    c.fillRect(p.x - width / 2 + 7, top + 10, width, bottom - top);
    c.fillStyle = "#586875";
    c.fillRect(p.x - width / 2, top, width, bottom - top);
    if (this.tileReady) {
      c.save();
      c.beginPath();
      c.rect(p.x - width / 2, top, width, bottom - top);
      c.clip();
      const texture = c.createPattern(this.tile, "repeat")!;
      texture.setTransform(new DOMMatrix().scale(0.26, 0.2));
      c.fillStyle = texture;
      c.fillRect(p.x - width / 2, top, width, bottom - top);
      const shade = c.createLinearGradient(0, top, 0, bottom);
      shade.addColorStop(0, "#748f9a44");
      shade.addColorStop(1, "#1a303966");
      c.fillStyle = shade;
      c.fillRect(p.x - width / 2, top, width, bottom - top);
      c.restore();
    }
    for (let y = top; y < bottom; y += 19) {
      const row = Math.floor((y - top) / 19);
      for (let x = p.x - width / 2; x < p.x + width / 2; x += 42) {
        const xx = x + (row % 2) * 16;
        line(
          c,
          [Math.max(p.x - width / 2, xx), y],
          [Math.min(p.x + width / 2, xx + 40), y],
          "#384c59",
          2,
        );
        if (xx < p.x + width / 2) line(c, [xx, y], [xx, y + 19], "#364d59", 2);
      }
    }
    c.fillStyle = "#819092";
    c.fillRect(p.x - width / 2, top, width, 7);
    if (horizontal) {
      for (let x = p.x - width / 2 + 4; x < p.x + width / 2 - 7; x += 38) {
        path(
          c,
          [
            [x, top + 4],
            [x, top - 13],
            [x + 3, top - 17],
            [x + 22, top - 16],
            [x + 25, top - 12],
            [x + 25, top + 4],
          ],
          "#7f9196",
          "#2b424f",
          2,
        );
        line(c, [x + 3, top - 15], [x + 22, top - 14], "#afbab1", 2);
        c.strokeStyle = "#354b58";
        c.strokeRect(x, top - 16, 25, 20);
        line(c, [x + 2, top - 15], [x + 22, top - 15], "#a7afa5", 3);
      }
    } else {
      for (let yy = top; yy < bottom - 20; yy += 40) {
        c.fillStyle = "#879495";
        c.fillRect(p.x - width / 2 - 3, yy, 34, 22);
        c.strokeStyle = "#344a55";
        c.strokeRect(p.x - width / 2 - 3, yy, 34, 22);
      }
    }
    if (w.gate) {
      if (horizontal) {
        const xx = p.x - 43,
          yy = bottom - 63;
        path(
          c,
          [
            [xx, yy + 63],
            [xx, yy + 12],
            [xx + 13, yy],
            [xx + 73, yy],
            [xx + 86, yy + 12],
            [xx + 86, yy + 63],
          ],
          "#553d2e",
          "#26353d",
          4,
        );
        for (let i = 0; i < 6; i++)
          line(
            c,
            [xx + 7 + i * 14, yy + 9],
            [xx + 7 + i * 14, yy + 61],
            "#92704a",
            2,
          );
        for (const off of [24, 49]) {
          line(c, [xx + 2, yy + off], [xx + 84, yy + off], "#273c43", 6);
          for (let i = 0; i < 5; i++)
            ellipse(c, xx + 9 + i * 17, yy + off, 2, 2, "#c1af7c");
        }
      } else {
        c.fillStyle = "#695039";
        c.fillRect(p.x - 15, p.y - 45, 30, 85);
        line(c, [p.x - 13, p.y - 20], [p.x + 13, p.y - 20], "#af8f57", 5);
        line(c, [p.x - 13, p.y + 10], [p.x + 13, p.y + 10], "#263b42", 6);
      }
    }
    if (w.hp < w.maxHp * 0.65) {
      line(c, [p.x - 7, top + 12], [p.x + 4, top + 31], "#243a44", 3);
      line(c, [p.x + 4, top + 31], [p.x - 9, top + 48], "#243a44", 3);
    }
  }

  tower(c: Ctx, x: number, y: number, t: number) {
    const p = P(x, y);
    if (this.propsReady) {
      ellipse(c, p.x + 10, p.y + 5, 83, 33, "#10252c99");
      this.prop(c, 0, p.x, p.y + 8, 205, 205);
      return;
    }
    ellipse(c, p.x + 13, p.y + 8, 80, 41, "#172d36");
    c.fillStyle = "#536979";
    c.fillRect(p.x - 63, p.y - 79, 126, 76);
    ellipse(c, p.x, p.y - 3, 63, 31, "#536979", "#2a4350", 3);
    for (let yy = 0; yy < 4; yy++) {
      c.beginPath();
      c.ellipse(p.x, p.y - yy * 20, 63, 28, 0, 0, Math.PI);
      c.strokeStyle = "#354e5d";
      c.lineWidth = 2;
      c.stroke();
      for (let j = 0; j < 5; j++) {
        const xx = p.x - 50 + j * 24 + (yy % 2 ? 10 : 0);
        line(
          c,
          [xx, p.y - yy * 20 - 13],
          [xx, p.y - yy * 20 + 5],
          "#3a5260",
          2,
        );
      }
    }
    ellipse(c, p.x, p.y - 78, 68, 37, "#859191", "#344e5b", 4);
    ellipse(c, p.x, p.y - 78, 48, 24, "#536974", "#304c58", 3);
    for (let i = 0; i < 9; i++) {
      const a = (i * Math.PI * 2) / 9;
      const xx = p.x + Math.cos(a) * 58,
        yy = p.y - 78 + Math.sin(a) * 29;
      c.fillStyle = "#829292";
      c.fillRect(xx - 11, yy - 22, 23, 25);
      c.strokeStyle = "#385361";
      c.strokeRect(xx - 11, yy - 22, 23, 25);
      line(c, [xx - 9, yy - 22], [xx + 9, yy - 22], "#b2b8a7", 3);
    }
    this.banner(c, p.x, p.y - 1, "#30667f", t);
  }
  banner(c: Ctx, x: number, y: number, color: string, t: number) {
    path(
      c,
      [
        [x - 18, y - 36],
        [x + 18, y - 36],
        [x + 18 + Math.sin(t * 2) * 2, y + 8],
        [x, y + 23],
        [x - 18, y + 8],
      ],
      color,
      "#253e4c",
      3,
    );
    path(
      c,
      [
        [x - 10, y - 18],
        [x - 10, y - 4],
        [x, y + 5],
        [x + 10, y - 4],
        [x + 10, y - 18],
        [x + 3, y - 12],
        [x, y - 17],
        [x - 3, y - 12],
      ],
      "#d8b973",
      "",
      0,
    );
    ellipse(c, x - 4, y - 6, 1.5, 1.5, "#294457");
    ellipse(c, x + 4, y - 6, 1.5, 1.5, "#294457");
  }
  centralAccess(c: Ctx, g: Simulation) {
    const p = P(CENTRAL_STAIR.x, CENTRAL_STAIR.y, FLOOR_HEIGHT),
      open = g.workshop.state === "hidden" ? 0 : g.workshop.emergence;
    c.save();
    c.translate(p.x, p.y);
    ellipse(c, 7, 8, 85, 42, "#0d222b77");
    if (this.floorPropsReady) {
      const image = this.cache.sprite(
        "access",
        this.floorProps,
        this.floorProps.width / 2,
        0,
        this.floorProps.width / 2,
        this.floorProps.height,
        184,
        184,
        "brightness(.86) saturate(.82)",
      );
      c.drawImage(image, -92, -113, 184, 184);
    } else {
      c.fillStyle = "#253c48";
      c.fillRect(-55, -35, 110, 70);
    }
    if (open < 1) {
      c.save();
      c.globalAlpha = (1 - open) * 0.94;
      c.translate(0, -open * 42);
      path(
        c,
        [
          [-49, -15],
          [8, -35],
          [54, -9],
          [-4, 21],
        ],
        "#614a35",
        "#283b42",
        3,
      );
      for (let i = 0; i < 6; i++)
        line(
          c,
          [-42 + i * 10, -15 - i * 3],
          [-1 + i * 10, 15 - i * 3],
          "#ae8b5e",
          2,
        );
      line(c, [-35, -15], [-2, 11], "#283b40", 5);
      line(c, [8, -31], [42, -7], "#283b40", 5);
      c.restore();
    }
    if (open > 0) {
      const glow = c.createRadialGradient(0, -4, 1, 0, -4, 84);
      glow.addColorStop(
        0,
        `rgba(255,179,78,${open * (0.21 + Math.sin(g.time * 5) * 0.025)})`,
      );
      glow.addColorStop(1, "#ffb25300");
      c.globalCompositeOperation = "screen";
      c.fillStyle = glow;
      c.fillRect(-84, -88, 168, 168);
      c.globalCompositeOperation = "source-over";
    }
    c.font = "9px sans-serif";
    c.fillStyle = "#b8b89c";
    c.textAlign = "center";
    c.fillText("ACCÈS DE L’OUVRIER", 0, 86);
    c.restore();
  }
  stock(c: Ctx, stock: Stock, t: number) {
    const p = P(stock.x, stock.y, FLOOR_HEIGHT);
    c.save();
    c.translate(p.x, p.y);
    ellipse(c, 6, 7, 55, 19, "#0c202b88");
    if (stock.pulse > 0) {
      const glow = c.createRadialGradient(0, -20, 3, 0, -20, 80);
      glow.addColorStop(0, `rgba(255,213,136,${stock.pulse * 0.35})`);
      glow.addColorStop(1, "#ffd58800");
      c.fillStyle = glow;
      c.fillRect(-80, -100, 160, 160);
    }
    if (this.floorPropsReady) {
      const image = this.cache.sprite(
        "stock",
        this.floorProps,
        0,
        0,
        this.floorProps.width / 2,
        this.floorProps.height,
        132,
        132,
        "brightness(.9) saturate(.85)",
      );
      c.drawImage(image, -66, -119 - stock.pulse * 2, 132, 132);
    } else {
      c.fillStyle = "#9e784d";
      c.fillRect(-30, -30, 60, 35);
    }
    c.font = "9px sans-serif";
    c.textAlign = "center";
    c.fillStyle = "#e0cfaa";
    c.fillText("RÉSERVE DE FLÈCHES", 0, 31);
    c.restore();
  }
  ballista(c: Ctx, b: Ballista, t: number) {
    const p = P(b.x, b.y, elevation(b));
    c.save();
    c.translate(p.x, p.y);
    if (b.hp <= 0) {
      line(c, [-30, -12], [28, 16], "#8b694b", 13);
      line(c, [30, -18], [-24, 17], "#604b39", 10);
      c.restore();
      return;
    }
    ellipse(c, 5, 10, 48, 21, "#1e3036bb");
    if (this.propsReady) {
      c.save();
      c.translate(
        -Math.cos(b.angle) * b.recoil * 13,
        -Math.sin(b.angle) * b.recoil * 9,
      );

      if (this.ballistaAtlasReady) {
        const direction =
          (Math.round((b.angle + Math.PI / 2) / (Math.PI / 4)) + 8) % 8;
        const image = this.cache.sprite(
          `ballista:${direction}`,
          this.ballistaAtlas,
          ((direction % 4) * this.ballistaAtlas.width) / 4,
          ((direction < 4 ? 160 : 700) * this.ballistaAtlas.height) / 1254,
          this.ballistaAtlas.width / 4,
          (450 * this.ballistaAtlas.height) / 1254,
          124,
          148,
          b.loaded ? "" : "saturate(.6) brightness(.85)",
        );
        c.drawImage(image, -62, -87, 124, 148);
      } else
        c.drawImage(
          this.props,
          this.props.width / 2,
          0,
          this.props.width / 2,
          this.props.height / 2,
          -73,
          -80,
          146,
          146,
        );
      c.restore();
      if (b.reload > 0) {
        c.fillStyle = "#142a32";
        c.fillRect(-33, -72, 66, 6);
        c.fillStyle = "#d8b878";
        c.fillRect(-33, -72, 66 * (1 - b.reload / 3.2), 6);
      }
      if (!b.loaded && b.reload <= 0) {
        c.font = "bold 11px sans-serif";
        c.textAlign = "center";
        c.fillStyle = "#daba85";
        c.fillText("R · RECHARGER", 0, -76);
      }
      c.restore();
      return;
    }
    const a = Math.atan2(Math.sin(b.angle) * 0.72, Math.cos(b.angle));
    c.rotate(a);
    for (const yy of [-26, 26]) {
      ellipse(c, -9, yy, 19, 9, "#574737", "#1a2e34", 4);
      ellipse(c, -9, yy, 11, 5, "#977044", "#2f3836", 2);
      line(c, [-26, yy], [8, yy], "#c0985b", 2);
    }
    path(
      c,
      [
        [-36, -18],
        [20, -18],
        [32, 0],
        [20, 18],
        [-36, 18],
      ],
      "#926a43",
      "#25333a",
      4,
    );
    for (const xx of [-28, -8, 13]) {
      line(c, [xx, -17], [xx, 17], "#bd925c", 3);
      ellipse(c, xx, -11, 2, 2, "#374748");
      ellipse(c, xx, 11, 2, 2, "#374748");
    }
    c.translate(-b.recoil * 14, 0);
    line(c, [-40, 0], [43, 0], "#443629", 18);
    line(c, [-38, -4], [43, -4], "#b68b58", 5);
    line(c, [-34, 5], [38, 5], "#826244", 4);
    c.beginPath();
    c.moveTo(22, -58);
    c.quadraticCurveTo(53, -26, 43, 0);
    c.quadraticCurveTo(53, 26, 22, 58);
    c.strokeStyle = "#20323b";
    c.lineWidth = 12;
    c.stroke();
    c.strokeStyle = "#aa7b45";
    c.lineWidth = 7;
    c.stroke();
    line(c, [22, -57], [b.loaded ? -27 : 36, 0], "#d0bd8e", 2);
    line(c, [b.loaded ? -27 : 36, 0], [22, 57], "#d0bd8e", 2);
    if (b.loaded) {
      line(c, [-32, 0], [66, 0], "#d0c3a0", 4);
      path(
        c,
        [
          [76, 0],
          [59, -7],
          [59, 7],
        ],
        "#bdd3d5",
        "#344a50",
        2,
      );
      line(c, [-30, -6], [-17, 0], "#5c878e", 4);
    }
    ellipse(c, -36, 0, 9, 9, "#5f6257", "#2c3b3c", 3);
    line(c, [-36, -15], [-36, 15], "#b2a17b", 4);
    c.restore();
    if (b.reload > 0) {
      c.fillStyle = "#182e37";
      c.fillRect(p.x - 33, p.y - 63, 66, 6);
      c.fillStyle = "#d8b878";
      c.fillRect(p.x - 33, p.y - 63, 66 * (1 - b.reload / 3.2), 6);
    }
    if (b.hp < b.maxHp * 0.9) {
      c.fillStyle = "#142d34";
      c.fillRect(p.x - 30, p.y + 26, 60, 4);
      c.fillStyle = "#c09a6d";
      c.fillRect(p.x - 30, p.y + 26, (60 * b.hp) / b.maxHp, 4);
    }
  }
  slot(
    c: Ctx,
    site: Vec,
    kind: "ballista" | "stock",
    active: boolean,
    aim: Vec,
  ) {
    const p = P(site.x, site.y, FLOOR_HEIGHT),
      hover = active && Math.hypot(aim.x - site.x, aim.y - site.y) < 95;
    c.save();
    c.globalAlpha = active ? 1 : 0.65;
    c.setLineDash([6, 5]);
    ellipse(
      c,
      p.x,
      p.y,
      43,
      27,
      hover ? "#dbbc7438" : "#132a3630",
      hover ? "#f2d8a0" : active ? "#cdb77b" : "#9aa99a",
      active ? 2 : 1.5,
    );
    c.setLineDash([]);
    line(c, [p.x - 9, p.y], [p.x + 9, p.y], active ? "#e7c486" : "#8b9d95", 2);
    line(c, [p.x, p.y - 7], [p.x, p.y + 7], active ? "#e7c486" : "#8b9d95", 2);
    if (active) {
      c.fillStyle = hover ? "#f5dba5" : "#aabdac";
      c.font = "bold 10px sans-serif";
      c.textAlign = "center";
      c.fillText(
        kind === "ballista" ? "BALISTE · 90 OR" : "RÉSERVE · 40 OR",
        p.x,
        p.y + 46,
      );
    }
    c.restore();
  }
  worker(c: Ctx, w: Workshop) {
    const p = P(w.x, w.y, FLOOR_HEIGHT),
      frame = w.moving ? Math.floor(w.walk) % 4 : 0;
    c.save();
    if (w.emergence < 1) {
      c.beginPath();
      c.rect(p.x - 65, p.y - 170, 130, 179);
      c.clip();
    }
    c.translate(p.x, p.y + (1 - w.emergence) * 60);
    c.globalAlpha = w.emergence;
    ellipse(c, 0, 0, 23, 9, "#10242ba0");
    if (this.workerAtlasReady) {
      c.save();
      if (Math.cos(w.facing) < 0) c.scale(-1, 1);
      const image = this.cache.sprite(
        `worker:${frame}`,
        this.workerAtlas,
        (frame * this.workerAtlas.width) / 4,
        0,
        this.workerAtlas.width / 4,
        this.workerAtlas.height,
        92,
        121,
      );
      c.drawImage(image, -46, -121, 92, 121);
      c.restore();
    } else {
      c.fillStyle = "#b38d5f";
      c.fillRect(-17, -64, 34, 61);
      ellipse(c, 0, -81, 16, 18, "#d2a079", "#213945", 3);
    }
    c.textAlign = "center";
    c.font = "bold 11px sans-serif";
    c.fillStyle = "#edd29b";
    c.fillText("Gaspard · Ouvrier", 0, -139);
    if (w.state === "building" && w.job) {
      c.fillStyle = "#142a32";
      c.fillRect(-35, -132, 70, 5);
      c.fillStyle = "#e0bd7d";
      c.fillRect(-35, -132, 70 * (1 - w.job.build / 1.3), 5);
    }
    if (w.ready && w.speech > 0) {
      c.fillStyle = "#0d202bf2";
      c.strokeStyle = "#d0b47b88";
      c.lineWidth = 1;
      c.beginPath();
      c.roundRect(-175, -208, 350, 55, 7);
      c.fill();
      c.stroke();
      c.fillStyle = "#e5d4b1";
      c.font = "12px sans-serif";
      c.fillText("« Dites-moi de quoi vous avez besoin,", 0, -187);
      c.fillText("je vous prépare ça rapidement ! »", 0, -169);
    }
    c.restore();
  }
  actor(c: Ctx, a: Defender | Enemy, t: number, player: boolean) {
    const ally = "weapon" in a,
      p = P(a.x, a.y, elevation(a));
    c.save();
    c.translate(p.x, p.y);
    if (a.hp <= 0) {
      c.globalAlpha = 0.45;
      c.rotate(Math.PI / 2);
    }
    const bob = ally ? 0 : Math.sin(a.walk * 2) * 2;
    ellipse(c, 2, 2, ally ? 21 : 18, 8, "#102b31aa");
    if (ally) {
      ellipse(
        c,
        0,
        1,
        25,
        11,
        "",
        player ? "#e4c28a" : a.color,
        player ? 2.5 : 1.5,
      );
      if (player) {
        c.globalAlpha = 0.12;
        ellipse(c, 0, 1, 30, 14, "#f2cd86");
        c.globalAlpha = 1;
      }
    }
    if (!ally && (a.burn > 0 || a.poison > 0 || a.slow > 0 || a.stun > 0)) {
      const color =
        a.stun > 0
          ? "#9ef5f2"
          : a.slow > 0
            ? "#99dcf5"
            : a.poison > 0
              ? "#b4d476"
              : "#f8a15f";
      ellipse(c, 0, 0, 25, 11, "", color, 2);
      c.fillStyle = color;
      c.font = "bold 12px sans-serif";
      c.textAlign = "center";
      c.fillText(
        a.stun > 0 ? "ϟ" : a.slow > 0 ? "❄" : a.poison > 0 ? "☠" : "♨",
        0,
        -146,
      );
    }
    const tone = a.hurt > 0 ? "brightness(1.7) sepia(.3)" : "";
    if (ally && this.walkAtlasReady) {
      const state = spriteFrame(a),
        img = state.shooting
          ? this.heroShot[state.group]
          : this.heroWalk[state.group];
      const ready = img.complete && img.naturalWidth > 0;
      const fallback = this.heroWalk[state.group],
        sheet = ready ? img : fallback;
      const row =
        state.shooting && ready
          ? SHOT_ROWS[state.group][state.row]
          : WALK_ROWS[state.group][state.row];
      c.save();
      const facing =
        a.shot || a.releaseFlash > 0
          ? a.facing
          : a.moving
            ? a.moveFacing
            : a.facing;
      if (Math.cos(facing) < -0.05) c.scale(-1, 1);
      if (a.dodge > 0) c.rotate(0.28);
      const image = this.cache.sprite(
        `hero:${a.hero}:${state.shooting}:${state.frame}`,
        sheet,
        (state.frame * sheet.width) / 4,
        (row.y * sheet.height) / 1254,
        sheet.width / 4,
        (row.h * sheet.height) / 1254,
        98,
        128,
        tone,
      );
      c.drawImage(image, -49, -128, 98, 128);
      c.restore();
    } else if (this.atlasReady) {
      const index = ally
        ? a.id
        : { goblin: 3, skeleton: 4, fire: 5, runner: 6, brute: 7 }[a.kind];
      const big = !ally && a.kind === "brute";
      const w = big ? 97 : 80,
        h = big ? 194 : 160;
      c.save();
      c.translate(0, bob);
      if (Math.cos(a.facing) < 0) c.scale(-1, 1);
      if (ally && a.dodge > 0) c.rotate(0.35);
      const image = this.cache.sprite(
        `enemy:${index}`,
        this.atlas,
        ((index % 4) * this.atlas.width) / 4,
        ((index < 4 ? 170 : 660) * this.atlas.height) / 1254,
        this.atlas.width / 4,
        ((index < 4 ? 480 : 510) * this.atlas.height) / 1254,
        w,
        h * 0.79,
        tone,
      );
      c.drawImage(image, -w / 2, -h * 0.79, w, h * 0.79);
      c.restore();
    } else this.fallbackActor(c, a, bob);
    c.filter = "none";
    const labelY = this.atlasReady
      ? !ally && a.kind === "brute"
        ? -154
        : -145
      : -85;
    if (a.hp > 0) {
      c.fillStyle = "#172c35";
      c.fillRect(-23, labelY + 10 + bob, 46, 9);
      c.fillStyle = ally ? (player ? "#ecc38a" : a.color) : "#d77868";
      c.fillRect(-21, labelY + 12 + bob, 42 * clamp(a.hp / a.maxHp, 0, 1), 5);
    }
    if (!ally && a.hp > 0) {
      if (a.hurt > 0 || a.kind === "brute") {
        c.font = "bold 11px sans-serif";
        c.textAlign = "center";
        c.fillStyle = "#efd0bd";
        c.fillText(String(Math.ceil(a.hp)), 0, labelY + 5 + bob);
      }
      if (
        !a.moving &&
        a.stun <= 0 &&
        a.cooldown < 0.55 &&
        a.kind !== "runner" &&
        a.kind !== "brute"
      ) {
        c.fillStyle = "#ffc09b";
        c.font = "bold 20px sans-serif";
        c.textAlign = "center";
        c.fillText("!", 25, -83);
      }
    }
    if (ally) {
      c.font = "600 12px sans-serif";
      c.textAlign = "center";
      c.fillStyle = player ? "#f3d9a6" : "#c9d7d4";
      c.fillText(a.name + (player ? " · VOUS" : ""), 0, labelY + bob);
      if (a.dead > 0) {
        c.fillStyle = "#f7d9ad";
        c.fillText(`À terre · ${Math.ceil(a.dead)} s`, 0, labelY - 15);
      }
    }
    c.restore();
  }
  fallbackActor(c: Ctx, a: Defender | Enemy, bob: number) {
    const ally = "weapon" in a,
      color = ally
        ? a.color
        : a.kind === "skeleton"
          ? "#c7c3aa"
          : a.kind === "fire"
            ? "#a55344"
            : a.kind === "brute"
              ? "#706e5c"
              : "#697b47";
    c.save();
    c.translate(0, bob);
    const step = Math.sin(a.walk * 2) * 5;
    line(c, [-8, -19], [-10, step], "#24343b", 9);
    line(c, [8, -19], [11, -step], "#24343b", 9);
    line(c, [-10, step], [-14, step], "#6b5847", 7);
    line(c, [11, -step], [17, -step], "#6b5847", 7);
    path(
      c,
      [
        [-15, -43],
        [15, -43],
        [19, -14],
        [-17, -14],
      ],
      color,
      "#172f37",
      3,
    );
    path(
      c,
      [
        [-14, -38],
        [0, -25],
        [14, -38],
        [12, -47],
        [-12, -47],
      ],
      "#c3b47c",
      "#263b42",
      2,
    );
    line(c, [-14, -17], [15, -17], "#594a36", 6);
    ellipse(c, 2, -17, 3, 3, "#e0bd76");
    ellipse(
      c,
      0,
      -54,
      16,
      17,
      ally ? "#e7bd8b" : a.kind === "skeleton" ? "#d9d0b5" : "#a0a26b",
      "#25343b",
      3,
    );
    if (ally && a.id === 0) {
      path(
        c,
        [
          [-17, -55],
          [-16, -69],
          [-8, -77],
          [8, -77],
          [17, -68],
          [18, -54],
          [11, -50],
          [10, -62],
          [-10, -62],
          [-10, -50],
        ],
        "#aab8b7",
        "#233f4d",
        3,
      );
      line(c, [0, -77], [0, -63], "#d5e0d7", 3);
    } else {
      path(
        c,
        [
          [-19, -49],
          [-18, -64],
          [0, -77],
          [19, -63],
          [18, -49],
          [11, -57],
          [9, -64],
          [-9, -64],
          [-12, -55],
        ],
        color,
        "#263b3c",
        3,
      );
    }
    ellipse(c, -5, -55, 2, 2, "#28363a");
    ellipse(c, 6, -55, 2, 2, "#28363a");
    line(c, [-2, -47], [5, -47], "#775346", 1.5);
    line(c, [-13, -38], [-25, -24], color, 8);
    line(c, [13, -38], [25, -27], color, 8);
    if (!ally && a.kind === "brute") {
      line(c, [23, -24], [35, -62], "#d6dcce", 5);
      line(c, [20, -34], [32, -31], "#ba915d", 4);
      path(
        c,
        [
          [-31, -30],
          [-15, -36],
          [-12, -20],
          [-23, -7],
          [-32, -18],
        ],
        "#4a697b",
        "#bb9f6c",
        3,
      );
    } else {
      c.beginPath();
      c.arc(18, -36, 24, -1.2, 1.2);
      c.strokeStyle = "#c69b62";
      c.lineWidth = 4;
      c.stroke();
      line(c, [27, -58], [27, -14], "#ded3af", 1.5);
      line(c, [12, -35], [45, -35], "#d0b885", 2);
    }
    c.restore();
  }
  torch(c: Ctx, x: number, y: number, t: number) {
    const p = P(x, y, elevation({ x, y }) + 42);
    c.save();
    c.translate(p.x, p.y);
    const s = 1 + Math.sin(t * 12 + x) * 0.08;
    const glow = this.cache.surface(
      "torch-glow",
      220,
      220,
      (ctx) => {
        const light = ctx.createRadialGradient(110, 110, 3, 110, 110, 105);
        light.addColorStop(0, "#ffbf6948");
        light.addColorStop(0.4, "#ff9e3a20");
        light.addColorStop(1, "#ff9e3a00");
        ctx.fillStyle = light;
        ctx.fillRect(0, 0, 220, 220);
      },
      1,
    );
    c.globalCompositeOperation = "screen";
    c.globalAlpha = 0.92 + 0.08 * Math.sin(t * 7 + x);
    c.drawImage(glow, -110 * s, -11 - 110 * s, 220 * s, 220 * s);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    line(c, [0, 12], [0, -9], "#775841", 7);
    ellipse(c, 0, -10, 10, 5, "#a17d45", "#2f3e3e", 2);
    path(
      c,
      [
        [-8, -13],
        [-10, -24],
        [-4, -32],
        [0, -48 * s],
        [5, -31],
        [10, -22],
        [7, -13],
      ],
      "#f8a34a",
      "",
      0,
    );
    path(
      c,
      [
        [-5, -15],
        [-3, -28],
        [1, -36 * s],
        [5, -22],
        [4, -14],
      ],
      "#ffe0a1",
      "",
      0,
    );
    c.restore();
  }
  prop(c: Ctx, index: number, x: number, y: number, w: number, h: number) {
    const image = this.cache.sprite(
      `prop:${index}`,
      this.props,
      ((index % 2) * this.props.width) / 2,
      (Math.floor(index / 2) * this.props.height) / 2,
      this.props.width / 2,
      this.props.height / 2,
      256,
      256,
    );
    c.drawImage(image, x - w / 2, y - h, w, h);
  }
  drawMinimap(canvas: HTMLCanvasElement, g: Simulation) {
    const c = canvas.getContext("2d")!,
      w = canvas.width,
      h = canvas.height,
      sx = w / WORLD.w,
      sy = h / WORLD.h;
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#152c32";
    c.fillRect(0, 0, w, h);
    if (
      !this.miniTerrain ||
      this.miniTerrain.width !== w ||
      this.miniTerrain.height !== h
    ) {
      this.miniTerrain = document.createElement("canvas");
      this.miniTerrain.width = w;
      this.miniTerrain.height = h;
      this.miniTerrain
        .getContext("2d")!
        .drawImage(
          this.terrain,
          0,
          0,
          this.terrain.width,
          WORLD.h * 0.72,
          0,
          0,
          w,
          h,
        );
    }
    c.drawImage(this.miniTerrain, 0, 0);
    for (const f of frontState(g))
      if (f.active) {
        const b = SECTOR_BANDS[f.side];
        c.fillStyle = "#e6a06c66";
        c.fillRect(b.x * sx, b.y * sy, b.w * sx, b.h * sy);
      }
    for (const wall of g.walls) {
      c.fillStyle =
        wall.hp <= 0
          ? "#f5866c"
          : wall.hp < wall.maxHp * 0.5
            ? "#c58c5d"
            : "#9ba6a1";
      c.fillRect(
        (wall.x - wall.w / 2) * sx,
        (wall.y - wall.h / 2) * sy,
        Math.max(2, wall.w * sx),
        Math.max(2, wall.h * sy),
      );
    }
    for (const e of g.enemies)
      if (e.hp > 0)
        ellipse(
          c,
          e.x * sx,
          e.y * sy,
          e.kind === "brute" ? 3 : 2.3,
          e.kind === "brute" ? 3 : 2.3,
          "#f48373",
        );
    for (const d of g.defenders)
      if (d.dead <= 0)
        ellipse(
          c,
          d.x * sx,
          d.y * sy,
          d.id === 0 ? 4 : 3,
          d.id === 0 ? 4 : 3,
          d.id === 0 ? "#f2d29e" : d.color,
          "#172d35",
          1,
        );
    const viewW = (this.w / this.zoom) * sx,
      viewH = (this.h / this.zoom / 0.72) * sy;
    c.strokeStyle = "#d9d3ad66";
    c.lineWidth = 1;
    c.strokeRect(
      this.camera.x * sx - viewW / 2,
      this.camera.y * sy - viewH / 2,
      viewW,
      viewH,
    );
  }
}
