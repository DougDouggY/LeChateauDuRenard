import { RenderCache } from "./render-cache";
import { elevation } from "./map";
import {
  clamp,
  type CombatEffect,
  type Enemy,
  type PowerId,
  type Projectile,
} from "./types";
type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
const random = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const colors: Record<PowerId, string> = {
  explosive: "#ffba67",
  multishot: "#c7e2a6",
  frost: "#adebff",
  fire: "#ff8747",
  piercing: "#c5a7ff",
  moon: "#fff0b8",
  poison: "#b7d779",
  lightning: "#b4fcff",
};
function stroke(c: Ctx, points: number[][], color: string, width: number) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
function stone(
  c: Ctx,
  x: number,
  y: number,
  size: number,
  angle: number,
  color = "#87918b",
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.beginPath();
  c.moveTo(-size, -size * 0.55);
  c.lineTo(size * 0.5, -size * 0.8);
  c.lineTo(size, size * 0.35);
  c.lineTo(-size * 0.3, size * 0.7);
  c.closePath();
  c.fillStyle = color;
  c.fill();
  stroke(
    c,
    [
      [-size, -size * 0.55],
      [size * 0.5, -size * 0.8],
      [size, size * 0.35],
    ],
    "#c1bba577",
    1,
  );
  c.restore();
}
/** Deterministic ballistic debris and cached soft sprites: no live blur/filter. */
export class Vfx {
  constructor(private cache: RenderCache) {}
  puff(
    c: Ctx,
    x: number,
    y: number,
    r: number,
    color: string,
    alpha: number,
    soft = true,
  ) {
    if (r <= 0 || alpha <= 0) return;
    const sprite = this.cache.surface(
      `vfx:${color}:${soft}`,
      96,
      96,
      (ctx) => {
        const g = ctx.createRadialGradient(48, 48, 0, 48, 48, 47);
        g.addColorStop(0, color + (soft ? "a0" : "ff"));
        g.addColorStop(0.3, color + (soft ? "60" : "bc"));
        g.addColorStop(1, color + "00");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 96, 96);
      },
      1,
    );
    c.save();
    c.globalAlpha *= clamp(alpha, 0, 1);
    c.drawImage(sprite, x - r, y - r, r * 2, r * 2);
    c.restore();
  }
  sparks(
    c: Ctx,
    e: CombatEffect,
    count: number,
    color: string,
    speed = 180,
    gravity = 230,
  ) {
    const age = e.total - e.life;
    for (let i = 0; i < count; i++) {
      const seed = e.id * 37 + i * 13,
        a = random(seed) * TAU,
        v = speed * (0.25 + random(seed + 1) * 0.75),
        life = 0.3 + random(seed + 2) * 0.65;
      if (age > life) continue;
      const vx = Math.cos(a) * v,
        vy = Math.sin(a) * v * 0.6 - 70;
      const t = age,
        old = Math.max(0, t - 0.035),
        drag = 1 - Math.exp(-t * 2),
        back = 1 - Math.exp(-old * 2);
      c.globalAlpha = clamp((life - age) / 0.2, 0, 1);
      stroke(
        c,
        [
          [(vx * back) / 2, vy * old + (gravity * old * old) / 2],
          [(vx * drag) / 2, vy * t + (gravity * t * t) / 2],
        ],
        color,
        1 + random(seed + 3) * 1.8,
      );
    }
    c.globalAlpha = 1;
  }
  smoke(c: Ctx, e: CombatEffect, color: string, count = 9) {
    const age = e.total - e.life;
    for (let i = 0; i < count; i++) {
      const seed = e.id * 17 + i * 9,
        delay = random(seed) * 0.18,
        t = age - delay;
      if (t < 0) continue;
      const life = 0.65 + random(seed + 1) * 0.6;
      if (t > life) continue;
      const x = (random(seed + 2) - 0.5) * e.radius * (0.2 + t),
        y = -t * (30 + random(seed + 3) * 65);
      this.puff(
        c,
        x,
        y,
        12 + t * (25 + random(seed + 4) * 25),
        color,
        Math.min(1, t * 8) * (1 - t / life) * 0.65,
      );
    }
  }
  flame(c: Ctx, x: number, y: number, t: number, size: number, seed: number) {
    const sway = Math.sin(t * 14 + seed) * size * 0.16;
    c.save();
    c.translate(x, y);
    c.beginPath();
    c.moveTo(-size * 0.35, 0);
    c.bezierCurveTo(
      -size * 0.55,
      -size * 0.45,
      sway - size * 0.15,
      -size * 0.6,
      sway,
      -size,
    );
    c.bezierCurveTo(
      sway + size * 0.2,
      -size * 0.45,
      size * 0.65,
      -size * 0.22,
      size * 0.35,
      0,
    );
    c.closePath();
    c.fillStyle = "#e96932cc";
    c.fill();
    c.beginPath();
    c.moveTo(-size * 0.2, 0);
    c.quadraticCurveTo(-size * 0.2, -size * 0.25, sway * 0.5, -size * 0.7);
    c.quadraticCurveTo(size * 0.3, -size * 0.23, size * 0.2, 0);
    c.fillStyle = "#ffce73ed";
    c.fill();
    c.restore();
  }
  effect(c: Ctx, e: CombatEffect): boolean {
    if (["coins", "damage", "ammo"].includes(e.kind)) return false;
    const age = e.total - e.life,
      t = clamp(age / e.total, 0, 1),
      z = e.z ?? elevation(e);
    c.save();
    c.translate(e.x, e.y * 0.72 - z);
    c.lineCap = "round";
    if (e.kind === "explosion" || e.kind === "fire-impact") {
      const explosive = e.kind === "explosion",
        blast = explosive ? e.radius : 65;
      this.puff(
        c,
        0,
        -25,
        blast * (0.25 + Math.min(1, age * 5)),
        "#ff9f46",
        Math.max(0, 1 - age * 2.8),
        false,
      );
      this.smoke(c, e, "#586164", explosive ? 14 : 7);
      if (age < 0.45) {
        c.globalAlpha = (1 - age / 0.45) * 0.55;
        c.beginPath();
        c.ellipse(
          0,
          -4,
          blast * (1 - Math.exp(-age * 12)),
          blast * 0.34 * (1 - Math.exp(-age * 12)),
          0,
          0,
          TAU,
        );
        c.strokeStyle = "#ecd6b0";
        c.lineWidth = 5 * (1 - age / 0.45);
        c.stroke();
        c.globalAlpha = 1;
      }
      for (let i = 0; i < (explosive ? 9 : 6); i++) {
        const seed = e.id + i * 19,
          life = 0.35 + random(seed) * 0.35;
        if (age < life)
          this.flame(
            c,
            (random(seed + 1) - 0.5) * blast * 0.6,
            -8 - age * 18,
            age,
            Math.sin((Math.PI * age) / life) * (35 + random(seed + 2) * 50),
            seed,
          );
      }
      this.sparks(c, e, explosive ? 28 : 15, "#ffdc94", explosive ? 260 : 150);
    } else if (e.kind === "frost") {
      this.puff(c, 0, -8, e.radius, "#94dfff", Math.max(0, 1 - t) * 0.55);
      this.smoke(c, { ...e, radius: e.radius * 0.5 }, "#b8e4e9", 6);
      for (let i = 0; i < 13; i++) {
        const seed = e.id * 11 + i * 7,
          a = random(seed) * TAU,
          r = (18 + random(seed + 1) * e.radius * 0.75) * Math.min(1, age * 7),
          x = Math.cos(a) * r,
          y = Math.sin(a) * r * 0.35;
        const grow = clamp((age - (r / e.radius) * 0.12) * 9, 0, 1),
          h = (22 + random(seed + 2) * 52) * grow;
        c.globalAlpha = clamp(e.life / 0.45, 0, 1);
        c.beginPath();
        c.moveTo(x - 8, y);
        c.lineTo(x + Math.sin(a) * 9, y - h);
        c.lineTo(x + 10, y - 3);
        c.closePath();
        c.fillStyle = i % 2 ? "#91cce1cc" : "#d0f3f0e8";
        c.fill();
        stroke(
          c,
          [
            [x, y],
            [x + Math.sin(a) * 9, y - h],
          ],
          "#f1ffff",
          1.5,
        );
        if (t > 0.65)
          stone(
            c,
            x + (t - 0.65) * Math.cos(a) * 50,
            y - h + (t - 0.65) ** 2 * 300,
            3,
            t * 5,
            "#b8e5ed",
          );
      }
      c.globalAlpha = 1;
    } else if (e.kind === "poison-impact") {
      this.smoke(c, e, "#73954f", 12);
      for (let i = 0; i < 12; i++) {
        const seed = e.id + i * 11,
          life = 0.4 + random(seed) * 0.65;
        if (age > life) continue;
        const x = (random(seed + 1) - 0.5) * e.radius,
          y = -age * (35 + random(seed + 2) * 50) - 10;
        c.globalAlpha = clamp((life - age) / 0.25, 0, 1) * 0.65;
        c.beginPath();
        c.ellipse(
          x,
          y,
          3 + random(seed + 3) * 4,
          4 + random(seed + 3) * 5,
          0,
          0,
          TAU,
        );
        c.strokeStyle = "#c5e78f";
        c.lineWidth = 1;
        c.stroke();
      }
      c.globalAlpha = 1;
    } else if (e.kind === "lightning" && e.points) {
      // Three independent discharge paths, flickering branches, white-hot core.
      for (let j = 1; j < e.points.length; j++) {
        const a = e.points[j - 1],
          b = e.points[j];
        const ax = a.x - e.x,
          ay = (a.y - e.y) * 0.72 - elevation(a) + z - 48,
          bx = b.x - e.x,
          by = (b.y - e.y) * 0.72 - elevation(b) + z - 48;
        for (let pulse = 0; pulse < 2; pulse++) {
          const points: number[][] = [];
          for (let k = 0; k <= 9; k++) {
            const f = k / 9,
              noise =
                (random(
                  e.id +
                    j * 100 +
                    k * 19 +
                    Math.floor(age * 28) * 17 +
                    pulse * 41,
                ) -
                  0.5) *
                24 *
                Math.sin(f * Math.PI);
            points.push([
              ax + (bx - ax) * f + noise,
              ay + (by - ay) * f + noise * 0.6,
            ]);
          }
          c.globalAlpha = clamp(e.life / 0.15, 0, 1) * (pulse ? 0.45 : 1);
          stroke(c, points, "#68becb77", 9);
          stroke(c, points, "#a4f5ff", 3);
          stroke(c, points, "#f0ffff", 1);
          for (const k of [3, 6])
            stroke(
              c,
              [
                points[k],
                [points[k][0] + (k === 3 ? -20 : 20), points[k][1] - 21],
                [points[k][0] + (k === 3 ? -12 : 32), points[k][1] - 36],
              ],
              "#c4faff",
              1,
            );
        }
        this.puff(c, bx, by, 35, "#b9f6ff", Math.max(0, 1 - t));
      }
      this.sparks(c, e, 13, "#d9ffff", 150, 90);
    } else if (e.kind === "heal") {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + age * 2,
          r = 22 + Math.sin(age * 4 + i) * 5,
          x = Math.cos(a) * r,
          y = Math.sin(a) * r * 0.38 - 10 - age * (26 + i * 2);
        this.puff(c, x, y, 6, "#f4e4a9", Math.sin(t * Math.PI) * 0.8, false);
      }
      c.globalAlpha = Math.sin(t * Math.PI) * 0.65;
      c.strokeStyle = "#e8deb0";
      c.lineWidth = 1.5;
      c.beginPath();
      c.ellipse(0, 0, 27 + Math.sin(t * Math.PI) * 6, 11, 0, 0, TAU);
      c.stroke();
      if (e.amount) {
        c.globalAlpha = clamp(e.life / 0.2, 0, 1);
        c.font = "bold 12px sans-serif";
        c.textAlign = "center";
        c.fillStyle = "#f8efc5";
        c.fillText(`+${e.amount}`, 0, -85 - age * 22);
      }
    } else if (e.kind === "cast") {
      const color = colors[e.power ?? "moon"];
      c.rotate(
        Math.atan2(Math.sin(e.angle ?? 0) * 0.72, Math.cos(e.angle ?? 0)),
      );
      this.puff(c, 20, 0, 28 * (1 - t) + 8, color, (1 - t) * 0.8, false);
      if (e.power === "multishot")
        for (let i = -2; i <= 2; i++) {
          c.globalAlpha = (1 - t) * 0.55;
          stroke(
            c,
            [
              [15, 0],
              [20 + age * 160, i * age * 90],
            ],
            color,
            1.5,
          );
        }
      if (e.power === "piercing")
        stroke(
          c,
          [
            [0, 0],
            [70 * (1 - t), 0],
          ],
          "#efddff",
          3 * (1 - t),
        );
    } else if (e.kind === "pierce-impact" || e.kind === "bolt-impact") {
      this.puff(c, 0, -35, 35, "#d6c8ac", Math.max(0, 1 - age * 5));
      c.translate(0, -35);
      c.rotate(e.angle ?? 0);
      this.sparks(
        c,
        e,
        e.kind === "bolt-impact" ? 18 : 12,
        e.kind === "bolt-impact" ? "#e6d2a9" : "#d6beff",
        210,
      );
      if (e.kind === "bolt-impact" && e.amount === 1) {
        // Shaft stays embedded and flexes as the impact settles.
        c.globalAlpha = clamp(e.life / 0.3, 0, 1);
        const bend = Math.sin(age * 65) * Math.exp(-age * 13) * 5;
        stroke(
          c,
          [
            [-62, -bend],
            [-28, bend * 0.5],
            [4, 0],
          ],
          "#493a2b",
          6,
        );
        stroke(
          c,
          [
            [-62, -bend],
            [-28, bend * 0.5],
            [4, 0],
          ],
          "#c0ab7e",
          2.5,
        );
        stroke(
          c,
          [
            [-57, -bend],
            [-66, -bend - 7],
          ],
          "#6b7d80",
          3,
        );
        stroke(
          c,
          [
            [-57, -bend],
            [-66, -bend + 7],
          ],
          "#6b7d80",
          3,
        );
      }
    } else if (e.kind === "bolt-launch") {
      c.rotate(
        Math.atan2(Math.sin(e.angle ?? 0) * 0.72, Math.cos(e.angle ?? 0)),
      );
      // Dust from the carriage, fibers and string snap. No gunpowder flash.
      for (let i = 0; i < 5; i++)
        this.puff(
          c,
          -20 - age * 50,
          (i - 2) * 6,
          8 + age * 24,
          "#b6ac90",
          (1 - t) * 0.3,
        );
      c.globalAlpha = (1 - t) * 0.4;
      stroke(
        c,
        [
          [15, -32],
          [35 + age * 70, 0],
          [15, 32],
        ],
        "#dbd1b4",
        1,
      );
    } else if (e.kind === "wall-hit" || e.kind === "wall-collapse") {
      const collapse = e.kind === "wall-collapse",
        count = collapse ? 30 : 9,
        width = e.width ?? 50;
      this.smoke(
        c,
        { ...e, radius: collapse ? width * 0.8 : 40 },
        "#a8a493",
        collapse ? 18 : 6,
      );
      for (let i = 0; i < count; i++) {
        const seed = e.id * 31 + i * 17,
          life = (collapse ? 1.25 : 0.65) + random(seed) * 0.35;
        if (age > life) continue;
        const ox = (random(seed + 1) - 0.5) * width,
          oy = (random(seed + 2) - 0.5) * (e.height ?? 15);
        const vx = (random(seed + 3) - 0.5) * (collapse ? 135 : 190),
          vy = -(collapse ? 55 : 90) - random(seed + 4) * 100;
        const ground = 18 + random(seed + 5) * 12,
          fall = vy * age + 330 * age * age;
        const y =
          fall > ground
            ? ground - (fall - ground) * 0.1 * Math.exp(-(fall - ground) / 30)
            : fall;
        c.globalAlpha = clamp((life - age) / 0.3, 0, 1);
        stone(
          c,
          ox + vx * age,
          oy + y,
          collapse ? 5 + random(seed + 6) * 9 : 2 + random(seed + 6) * 4,
          age * (random(seed + 7) - 0.5) * 12,
        );
      }
    }
    c.restore();
    return true;
  }
  trail(c: Ctx, q: Projectile, time: number) {
    if (!q.power && q.kind !== "bolt") return;
    const age = q.total - q.life,
      color = q.power ? colors[q.power] : "#d2c4a5";
    c.save();
    if (q.kind === "bolt") {
      // The heavy shaft and iron head stay readable at speed.
      stroke(
        c,
        [
          [-97, 0],
          [-12, 0],
        ],
        "#493a2d",
        6,
      );
      stroke(
        c,
        [
          [-95, -1],
          [-12, -1],
        ],
        "#d5bc87",
        2,
      );
      c.fillStyle = "#c4d4d4";
      c.beginPath();
      c.moveTo(5, 0);
      c.lineTo(-13, -5);
      c.lineTo(-13, 5);
      c.closePath();
      c.fill();
      for (const y of [-1, 1])
        stroke(
          c,
          [
            [-76, 0],
            [-93, y * 7],
            [-88, 0],
          ],
          "#789394",
          2,
        );
      c.globalAlpha = 0.18;
      stroke(
        c,
        [
          [-150, 0],
          [-98, 0],
        ],
        "#c9c8b1",
        2,
      );
    } else {
      const count = q.power === "fire" || q.power === "explosive" ? 9 : 6;
      for (let i = 0; i < count; i++) {
        const seed = q.id + i * 13,
          t = (age * 3 + random(seed)) % 1,
          x = -30 - t * 90,
          y = Math.sin(time * 16 + i) * t * 6;
        c.globalAlpha = (1 - t) * 0.7;
        if (q.power === "fire" || q.power === "explosive") {
          c.save();
          c.translate(x, y);
          c.rotate(-Math.PI / 2);
          this.flame(c, 0, 0, time, 8 + (1 - t) * 13, seed);
          c.restore();
          this.puff(c, x - 10, y - 3, 9 + t * 13, "#727474", (1 - t) * 0.4);
        } else if (q.power === "frost")
          stone(c, x, y, 2 + (1 - t) * 3, time * 4 + i, "#d6f5ff");
        else if (q.power === "poison")
          this.puff(c, x, y, 5 + t * 13, "#90b95f", (1 - t) * 0.6);
        else if (q.power === "lightning")
          stroke(
            c,
            [
              [x, 0],
              [x - 8, y - 5],
              [x - 14, y + 4],
              [x - 20, 0],
            ],
            "#c2faff",
            1,
          );
        else this.puff(c, x, y, 3 + (1 - t) * 4, color, (1 - t) * 0.8, false);
      }
      c.globalAlpha = 0.65;
      stroke(
        c,
        [
          [-88, 0],
          [-25, 0],
        ],
        color,
        q.power === "piercing" ? 3 : 1,
      );
    }
    c.restore();
  }
  status(c: Ctx, e: Enemy, time: number) {
    c.save();
    if (e.burn > 0)
      for (let i = 0; i < 5; i++) {
        const phase = (time * 1.6 + i * 0.21) % 1;
        this.flame(
          c,
          (i - 2) * 8,
          -12 - phase * 35,
          time,
          14 + Math.sin(phase * Math.PI) * 17,
          e.id + i,
        );
      }
    if (e.poison > 0)
      for (let i = 0; i < 4; i++) {
        const phase = (time * 0.6 + i * 0.27) % 1;
        this.puff(
          c,
          Math.sin(time * 2 + i) * 17,
          -15 - phase * 70,
          5 + phase * 13,
          "#9aba63",
          Math.sin(phase * Math.PI) * 0.48,
        );
      }
    if (e.slow > 0) {
      c.globalAlpha = 0.6;
      for (let i = 0; i < 4; i++)
        stone(c, (i - 1.5) * 11, -8, 5, Math.PI / 4, "#b6e6ef");
    }
    c.restore();
  }
}
