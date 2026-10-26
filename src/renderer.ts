import type { Simulation } from "./simulation";
import {
  type Vec,
  type Defender,
  type Enemy,
  type Ballista,
  type Wall,
  clamp,
} from "./types";
import { WORLD, FORT, POSTS, STOCKS, elevation } from "./map";
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
    this.resize();
  }
  resize() {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
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
    // Courtyard base and raised walkways.
    polyWorld(
      c,
      [
        [530, 490],
        [1870, 490],
        [1870, 1710],
        [530, 1710],
      ],
      "#4d5558",
      "#17282e",
    );
    if (this.tileReady) {
      const pattern = c.createPattern(this.tile, "repeat")!;
      pattern.setTransform(new DOMMatrix().scale(0.5, 0.36));
      c.fillStyle = pattern;
      c.fillRect(530, 490 * 0.72, 1340, 1220 * 0.72);
      c.fillStyle = "#47647618";
      c.fillRect(530, 490 * 0.72, 1340, 1220 * 0.72);
    } else
      for (let y = 500; y < 1720; y += 44)
        for (let x = 530; x < 1870; x += 60) {
          const offset = (Math.floor(y / 44) % 2) * 30;
          const xx = x + offset;
          if (xx > 1860) continue;
          const v = Math.floor(75 + r() * 20);
          polyWorld(
            c,
            [
              [xx + 2, y + 2],
              [xx + 56, y + 1],
              [xx + 57, y + 40],
              [xx + 2, y + 41],
            ],
            `rgb(${v},${v + 5},${v + 5})`,
            "#38464b",
          );
          if (r() < 0.22) {
            const p = P(xx + 20, y + 15);
            line(c, [p.x, p.y], [p.x + 13, p.y + 9], "#39484b", 1);
          }
        }
    // Interior garden islands leave wide combat routes.
    for (const [x, y] of [
      [900, 1030],
      [1510, 1220],
    ]) {
      const p = P(x, y);
      ellipse(c, p.x, p.y, 65, 42, "#283e3c", "#73796a", 5);
      for (let j = 0; j < 22; j++) {
        const a = r() * 6.28,
          d = r() * 45;
        ellipse(
          c,
          p.x + Math.cos(a) * d,
          p.y + Math.sin(a) * d * 0.6,
          9,
          6,
          ["#426253", "#354d41", "#50654c"][j % 3],
          "#243c36",
        );
      }
    }
    // Broad, traversable stairs (east/west) and narrow stairs (north/south).
    for (const s of [
      { x: 1200, y: 640, vertical: true },
      { x: 1200, y: 1560, vertical: true },
      { x: 680, y: 1100, vertical: false },
      { x: 1720, y: 1100, vertical: false },
    ]) {
      for (let i = 0; i < 9; i++) {
        const z = i * 6,
          x = s.vertical ? s.x - 66 : s.x - 44 + i * 10,
          y = s.vertical ? s.y - 44 + i * 10 : s.y - 93;
        polyWorld(
          c,
          [
            [x, y],
            [x + (s.vertical ? 132 : 11), y],
            [x + (s.vertical ? 132 : 11), y + (s.vertical ? 11 : 186)],
            [x, y + (s.vertical ? 11 : 186)],
          ],
          i % 2 ? "#788286" : "#8b9290",
          "#3d5056",
          z,
        );
      }
    }
    // Retaining walls along inner paths, respecting stair gaps.
    const edges = [
      [
        [656, 616],
        [1114, 616],
      ],
      [
        [1286, 616],
        [1744, 616],
      ],
      [
        [656, 1584],
        [1114, 1584],
      ],
      [
        [1286, 1584],
        [1744, 1584],
      ],
      [
        [656, 616],
        [656, 984],
      ],
      [
        [656, 1216],
        [656, 1584],
      ],
      [
        [1744, 616],
        [1744, 984],
      ],
      [
        [1744, 1216],
        [1744, 1584],
      ],
    ];
    for (const [a, b] of edges) {
      const pa = P(a[0], a[1]),
        pb = P(b[0], b[1]);
      path(
        c,
        [
          [pa.x, pa.y],
          [pb.x, pb.y],
          [pb.x, pb.y - 24],
          [pa.x, pa.y - 24],
        ],
        "#586973",
        "#273e48",
      );
      line(c, [pa.x, pa.y - 24], [pb.x, pb.y - 24], "#99a3a1", 8);
    }
    // Perimeter raised floor.
    for (const rect of [
      [530, 490, 1340, 126],
      [530, 1584, 1340, 126],
      [530, 616, 126, 968],
      [1744, 616, 126, 968],
    ]) {
      const [x, y, w, h] = rect;
      polyWorld(
        c,
        [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
        ],
        "#657477",
        "#30454d",
        52,
      );
      if (this.tileReady) {
        const pattern = c.createPattern(this.tile, "repeat")!;
        pattern.setTransform(new DOMMatrix().scale(0.4, 0.288));
        c.fillStyle = pattern;
        c.fillRect(x, y * 0.72 - 52, w, h * 0.72);
        c.fillStyle = "#8c9d9722";
        c.fillRect(x, y * 0.72 - 52, w, h * 0.72);
      } else
        for (let yy = y; yy < y + h; yy += 38)
          for (let xx = x; xx < x + w; xx += 55) {
            const p = P(xx, yy, 52);
            line(c, [p.x, p.y], [Math.min(x + w, xx + 52), p.y], "#85918e", 1);
            line(c, [p.x, p.y], [p.x, p.y + 24], "#43575e", 1);
          }
    }
    // Flags mark each cardinal entrance.
    for (const [x, y, label] of [
      [1200, 780, "N"],
      [1560, 1100, "E"],
      [1200, 1420, "S"],
      [840, 1100, "O"],
    ] as const) {
      const p = P(x, y);
      c.save();
      c.translate(p.x, p.y);
      c.fillStyle = "#708080";
      c.font = "bold 28px Georgia";
      c.textAlign = "center";
      c.globalAlpha = 0.38;
      c.fillText(label, 0, 0);
      c.restore();
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
  render(g: Simulation, dt: number, aim: Vec) {
    const c = this.ctx,
      p = g.player;
    if (g.started) {
      this.camera.x += (p.x - this.camera.x) * (1 - Math.exp(-dt * 5));
      this.camera.y += (p.y - 90 - this.camera.y) * (1 - Math.exp(-dt * 5));
    } else {
      this.camera.x = 1200;
      this.camera.y = 1100;
    }
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
    c.drawImage(this.terrain, 0, 0);
    const objects: { depth: number; draw: () => void }[] = [];
    for (const w of g.walls)
      objects.push({ depth: w.y * 0.72 + 6, draw: () => this.wall(c, w) });
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
    // Two courtyard buildings, kept outside the navigation corridors.
    objects.push({
      depth: 810 * 0.72,
      draw: () => this.building(c, 1450, 790, g.time),
    });
    objects.push({ depth: 825 * 0.72, draw: () => this.well(c, 1000, 800) });
    for (const s of STOCKS)
      objects.push({
        depth: s.y * 0.72,
        draw: () => this.stock(c, s.x, s.y, g.time),
      });
    for (const b of g.ballistas)
      objects.push({
        depth: b.y * 0.72,
        draw: () => this.ballista(c, b, g.time),
      });
    for (const a of [...g.defenders, ...g.enemies])
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
    for (const o of objects) o.draw();
    // Ballistic arcs are independent of wall collision, so bolts clear the parapets.
    for (const q of g.projectiles) {
      const progress = clamp(1 - q.life / q.total, 0, 1),
        z =
          q.startZ * (1 - progress) +
          q.endZ * progress +
          Math.sin(progress * Math.PI) * (q.kind === "fire" ? 90 : 28),
        pp = P(q.x, q.y, z),
        dir = Math.atan2(q.vy * 0.72, q.vx);
      c.save();
      c.translate(pp.x, pp.y);
      c.rotate(dir);
      if (q.kind === "fire") {
        const grad = c.createRadialGradient(0, 0, 1, 0, 0, 23);
        grad.addColorStop(0, "#ffca6e");
        grad.addColorStop(1, "#f77d2200");
        c.fillStyle = grad;
        c.fillRect(-23, -23, 46, 46);
        ellipse(c, 0, 0, 7, 6, "#ffc763", "#e3693d");
      } else {
        line(
          c,
          [-(q.kind === "bolt" ? 40 : 22), 0],
          [8, 0],
          q.team === "ally" ? "#cfdce1" : "#d4a57e",
          q.kind === "bolt" ? 5 : 2,
        );
        path(
          c,
          [
            [11, 0],
            [1, -5],
            [1, 5],
          ],
          q.team === "ally" ? "#b1e5ee" : "#dfb192",
          "",
          0,
        );
        line(c, [-25, -4], [-18, 0], "#8bacb4", 3);
      }
      c.restore();
    }
    for (const q of g.particles) {
      const pp = P(q.x, q.y, elevation(q) + 14);
      c.globalAlpha = clamp(q.life / 0.4, 0, 1);
      c.fillStyle = q.color;
      c.fillRect(pp.x, pp.y, q.size, q.size);
    }
    c.globalAlpha = 1;
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
    const vignette = c.createRadialGradient(
      this.w / 2,
      this.h / 2,
      this.h * 0.22,
      this.w / 2,
      this.h / 2,
      this.w * 0.7,
    );
    vignette.addColorStop(0, "#07151c00");
    vignette.addColorStop(1, "#05131a99");
    c.fillStyle = vignette;
    c.fillRect(0, 0, this.w, this.h);
  }
  wall(c: Ctx, w: Wall) {
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
    if (w.hp < w.maxHp * 0.95) {
      c.fillStyle = "#132a31";
      c.fillRect(p.x - 37, top - 30, 74, 5);
      c.fillStyle = w.hp < w.maxHp * 0.3 ? "#e07458" : "#c2b184";
      c.fillRect(p.x - 37, top - 30, (74 * w.hp) / w.maxHp, 5);
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
  building(c: Ctx, x: number, y: number, t: number) {
    const p = P(x, y);
    if (this.propsReady) {
      this.prop(c, 2, p.x, p.y + 12, 232, 232);
      return;
    }
    ellipse(c, p.x, p.y, 110, 42, "#243a3e");
    path(
      c,
      [
        [p.x - 85, p.y - 100],
        [p.x + 75, p.y - 100],
        [p.x + 75, p.y],
        [p.x - 85, p.y],
      ],
      "#6e7168",
      "#2c4148",
      3,
    );
    for (let j = 0; j < 5; j++)
      line(c, [p.x - 83, p.y - j * 20], [p.x + 72, p.y - j * 20], "#4c5c60", 2);
    path(
      c,
      [
        [p.x - 103, p.y - 98],
        [p.x - 10, p.y - 174],
        [p.x + 96, p.y - 100],
      ],
      "#2e4e63",
      "#203744",
      4,
    );
    for (let i = 0; i < 5; i++)
      line(
        c,
        [p.x - 83 + i * 18, p.y - 110 - i * 13],
        [p.x + 74 - i * 17, p.y - 110 - i * 13],
        "#4a6b7c",
        3,
      );
    c.fillStyle = "#3d332b";
    c.fillRect(p.x - 18, p.y - 60, 42, 60);
    for (let j = 0; j < 4; j++)
      line(
        c,
        [p.x - 12 + j * 10, p.y - 57],
        [p.x - 12 + j * 10, p.y],
        "#85664a",
        2,
      );
    for (const xx of [-59, 48]) {
      c.fillStyle = "#f6b965";
      c.fillRect(p.x + xx - 10, p.y - 65, 21, 31);
      line(c, [p.x + xx, p.y - 65], [p.x + xx, p.y - 34], "#3c4441", 3);
      line(
        c,
        [p.x + xx - 10, p.y - 50],
        [p.x + xx + 11, p.y - 50],
        "#3c4441",
        3,
      );
      const glow = c.createRadialGradient(
        p.x + xx,
        p.y - 50,
        2,
        p.x + xx,
        p.y - 50,
        53,
      );
      glow.addColorStop(0, "#ffb75140");
      glow.addColorStop(1, "#ffb75100");
      c.fillStyle = glow;
      c.fillRect(p.x + xx - 53, p.y - 103, 106, 106);
    }
    this.banner(c, p.x + 82, p.y - 40, "#44716e", t);
  }
  well(c: Ctx, x: number, y: number) {
    const p = P(x, y);
    ellipse(c, p.x, p.y, 50, 23, "#283e43");
    c.fillStyle = "#788382";
    c.fillRect(p.x - 40, p.y - 27, 80, 27);
    ellipse(c, p.x, p.y - 2, 40, 18, "#788382", "#40545a", 3);
    ellipse(c, p.x, p.y - 27, 44, 22, "#a1a698", "#3c535b", 3);
    ellipse(c, p.x, p.y - 27, 31, 14, "#203d4b", "#5f767b", 3);
    for (let i = 0; i < 5; i++)
      line(
        c,
        [p.x - 35 + i * 17, p.y - 15],
        [p.x - 35 + i * 17, p.y + 5],
        "#4c6269",
        2,
      );
  }
  stock(c: Ctx, x: number, y: number, t: number) {
    const p = P(x, y);
    c.save();
    c.translate(p.x, p.y);
    ellipse(c, 4, 8, 43, 17, "#263c3d");
    path(
      c,
      [
        [-36, -8],
        [-25, -20],
        [35, -20],
        [42, -9],
        [42, 18],
        [-36, 18],
      ],
      "#846346",
      "#293b3c",
      3,
    );
    for (let i = 0; i < 5; i++)
      line(c, [-32, -4 + i * 5], [38, -4 + i * 5], "#ae8656", 1.4);
    for (const xx of [-24, 24]) line(c, [xx, -17], [xx, 18], "#3c4844", 5);
    for (let i = 0; i < 7; i++) {
      line(
        c,
        [-22 + i * 7, -19],
        [-24 + i * 7, -62 - (i % 3) * 5],
        "#c3a475",
        3,
      );
      path(
        c,
        [
          [-24 + i * 7, -66 - (i % 3) * 5],
          [-28 + i * 7, -54 - (i % 3) * 5],
          [-20 + i * 7, -54 - (i % 3) * 5],
        ],
        "#a0b5bb",
        "#344d56",
        1,
      );
    }
    c.font = "bold 13px sans-serif";
    c.textAlign = "center";
    c.fillStyle = "#d7c6a0";
    c.fillText("FLÈCHES", 0, 38);
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
      if (!b.loaded) c.filter = "saturate(.6) brightness(.85)";
      if (this.ballistaAtlasReady) {
        const direction =
          (Math.round((b.angle + Math.PI / 2) / (Math.PI / 4)) + 8) % 8;
        c.drawImage(
          this.ballistaAtlas,
          ((direction % 4) * this.ballistaAtlas.width) / 4,
          ((direction < 4 ? 160 : 700) * this.ballistaAtlas.height) / 1254,
          this.ballistaAtlas.width / 4,
          (450 * this.ballistaAtlas.height) / 1254,
          -62,
          -87,
          124,
          148,
        );
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
  actor(c: Ctx, a: Defender | Enemy, t: number, player: boolean) {
    const ally = "weapon" in a,
      p = P(a.x, a.y, elevation(a));
    c.save();
    c.translate(p.x, p.y);
    if (a.hp <= 0) {
      c.globalAlpha = 0.45;
      c.rotate(Math.PI / 2);
    }
    const bob = Math.sin(a.walk * 2) * 2;
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
    if (a.hurt > 0) c.filter = "brightness(1.7) sepia(.3)";
    if (this.atlasReady) {
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
      c.drawImage(
        this.atlas,
        (index % 4) * (this.atlas.width / 4),
        ((index < 4 ? 170 : 660) * this.atlas.height) / 1254,
        this.atlas.width / 4,
        ((index < 4 ? 480 : 510) * this.atlas.height) / 1254,
        -w / 2,
        -h * 0.79,
        w,
        h * 0.79,
      );
      c.restore();
    } else this.fallbackActor(c, a, bob);
    c.filter = "none";
    if (ally && a.attacking > 0 && a.weapon === 1) {
      c.save();
      c.scale(1, 0.72);
      c.rotate(a.facing);
      c.beginPath();
      c.arc(0, 0, 76, -0.8, 0.8);
      c.strokeStyle = "#f5dfb5";
      c.lineWidth = 5;
      c.globalAlpha = a.attacking / 0.25;
      c.stroke();
      c.restore();
    }
    const labelY = this.atlasReady
      ? !ally && a.kind === "brute"
        ? -154
        : -134
      : -85;
    if (a.hp < a.maxHp || ally) {
      c.fillStyle = "#172c35";
      c.fillRect(-21, labelY + 12 + bob, 42, 5);
      c.fillStyle = ally ? (player ? "#ecc38a" : a.color) : "#d77868";
      c.fillRect(-21, labelY + 12 + bob, 42 * clamp(a.hp / a.maxHp, 0, 1), 5);
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
    if ((ally && a.weapon === 1) || (!ally && a.kind === "brute")) {
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
    const glow = c.createRadialGradient(0, -11, 3, 0, -11, 105 * s);
    glow.addColorStop(0, "#ffbf6948");
    glow.addColorStop(0.4, "#ff9e3a20");
    glow.addColorStop(1, "#ff9e3a00");
    c.globalCompositeOperation = "screen";
    c.fillStyle = glow;
    c.fillRect(-110, -121, 220, 220);
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
    c.drawImage(
      this.props,
      ((index % 2) * this.props.width) / 2,
      (Math.floor(index / 2) * this.props.height) / 2,
      this.props.width / 2,
      this.props.height / 2,
      x - w / 2,
      y - h,
      w,
      h,
    );
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
    c.drawImage(
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
