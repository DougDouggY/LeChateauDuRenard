import {
  type Defender,
  type Enemy,
  type Ballista,
  type Projectile,
  type Particle,
  type Pickup,
  type Input,
  type Side,
  type EnemyKind,
  type Vec,
  type Upgrade,
  distance,
  toward,
  clamp,
  SIDES,
} from "./types";
import {
  makeWalls,
  move,
  findPath,
  elevation,
  segmentDistance,
  POSTS,
  STOCKS,
} from "./map";
import { updateAllies, updateEnemies } from "./strategy";
export class Simulation {
  time = 0;
  tick = 0;
  nextId = 100;
  walls = makeWalls();
  defenders: Defender[] = [];
  enemies: Enemy[] = [];
  ballistas: Ballista[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  pickups: Pickup[] = [];
  wave = 0;
  phase: "preparation" | "assault" | "defeat" = "preparation";
  remaining = 10;
  spawnLeft = 0;
  spawnTimer = 0;
  fronts: Side[] = [0];
  resources = 110;
  kills = 0;
  paused = false;
  started = false;
  message = "La nuit tombe. Préparez les défenses.";
  messageTime = 6;
  shake = 0;
  repairTimer = 0;
  upgrades: Upgrade[] = [
    {
      id: "power",
      name: "Carreaux lourds",
      description: "+25 % de dégâts aux balistes",
      cost: 55,
      level: 0,
    },
    {
      id: "reload",
      name: "Treuil renforcé",
      description: "Rechargement 18 % plus rapide",
      cost: 50,
      level: 0,
    },
    {
      id: "walls",
      name: "Pierre de taille",
      description: "+150 PV et restaure 150 PV par section",
      cost: 65,
      level: 0,
    },
    {
      id: "arrows",
      name: "Pointes d’acier",
      description: "+10 dégâts à l’arc",
      cost: 45,
      level: 0,
    },
    {
      id: "repair",
      name: "Maître bâtisseur",
      description: "+40 % d’efficacité des réparations",
      cost: 40,
      level: 0,
    },
  ];
  constructor() {
    this.defenders = ["Aëlan", "Brune", "Osric"].map((name, i) => ({
      id: i,
      name,
      color: ["#d79a51", "#6bb6a0", "#9b9bda"][i],
      x: 1200 + (i - 1) * 80,
      y: 1200 + (i ? 45 : 0),
      hp: 160,
      maxHp: 160,
      radius: 17,
      cooldown: 0,
      hurt: 0,
      walk: 0,
      facing: -1.57,
      dead: 0,
      weapon: 2,
      dodge: 0,
      dashX: 0,
      dashY: 0,
      dodgeCooldown: 0,
      order: "auto",
      side: i === 1 ? 0 : 2,
      path: [],
      pathTime: 0,
      mounted: null,
      carried: null,
      ammo: 12,
      attacking: 0,
    }));
    this.ballistas = POSTS.map((p, i) => ({
      ...p,
      id: i,
      hp: 300,
      maxHp: 300,
      angle: [
        -Math.PI / 2,
        -Math.PI / 2,
        0,
        0,
        Math.PI / 2,
        Math.PI / 2,
        Math.PI,
        Math.PI,
      ][i],
      reload: 0,
      loaded: true,
      user: null,
      carrier: null,
      recoil: 0,
    }));
  }
  get player() {
    return this.defenders[0];
  }
  get integrity() {
    return (
      this.walls.reduce((s, w) => s + w.hp, 0) /
      this.walls.reduce((s, w) => s + w.maxHp, 0)
    );
  }
  level(id: string) {
    return this.upgrades.find((u) => u.id === id)!.level;
  }
  notice(message: string) {
    this.message = message;
    this.messageTime = 4;
  }
  particlesAt(p: Vec, color: string, count = 10) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2,
        s = 30 + Math.random() * 130;
      this.particles.push({
        ...p,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.25 + Math.random() * 0.5,
        total: 0.75,
        color,
        size: 2 + Math.random() * 4,
      });
    }
  }
  damageEnemy(e: Enemy, n: number) {
    if (e.hp <= 0) return;
    e.hp -= n;
    e.hurt = 0.18;
    this.particlesAt(e, e.kind === "skeleton" ? "#e7d4a3" : "#b6b64f", 5);
    if (e.hp <= 0) {
      e.dead = 0.7;
      this.kills++;
      this.pickups.push({
        id: this.nextId++,
        ...{ x: e.x, y: e.y },
        amount: e.kind === "brute" ? 16 : 7,
        life: 100,
      });
      this.resources += 3;
    }
  }
  damageDefender(d: Defender, n: number) {
    if (d.dead > 0 || d.dodge > 0) return;
    d.hp -= n;
    d.hurt = 0.3;
    this.particlesAt(d, "#da8c73", 5);
    if (d.id === 0) this.shake = 4;
    if (d.hp <= 0) {
      d.hp = 0;
      d.dead = 12;
      this.release(d);
      this.notice(
        d.id === 0
          ? "Vous êtes à terre. Vos compagnons tiennent la défense…"
          : `${d.name} est à terre — retour dans 12 s.`,
      );
    }
  }
  damageWall(id: number, n: number) {
    const w = this.walls[id];
    if (!w || w.hp <= 0) return;
    w.hp = Math.max(0, w.hp - n);
    this.shake = 3;
    this.particlesAt(w, "#b7b4a4", 10);
    if (w.hp === 0)
      this.notice(
        `Brèche au ${SIDES[w.side].toLowerCase()} ! Réparez la section détruite.`,
      );
  }
  release(d: Defender) {
    if (d.mounted !== null) {
      this.ballistas[d.mounted].user = null;
      d.mounted = null;
    }
    if (d.carried !== null) {
      this.ballistas[d.carried].carrier = null;
      d.carried = null;
    }
  }
  shoot(d: Defender, target: Vec) {
    if (d.dead || d.cooldown > 0) return;
    if (d.mounted !== null) {
      const b = this.ballistas[d.mounted];
      if (!b.loaded || b.reload > 0 || b.hp <= 0) return;
      b.angle = Math.atan2(target.y - b.y, target.x - b.x);
      this.projectile(
        b,
        target,
        170 * (1 + 0.25 * this.level("power")),
        "ally",
        "bolt",
      );
      b.loaded = false;
      b.recoil = 1;
      d.cooldown = 0.25;
      this.shake = 2;
      return;
    }
    d.facing = Math.atan2(target.y - d.y, target.x - d.x);
    d.attacking = 0.25;
    if (d.weapon === 1) {
      d.cooldown = 0.42;
      for (const e of this.enemies)
        if (
          e.hp > 0 &&
          distance(d, e) < 100 &&
          Math.cos(Math.atan2(e.y - d.y, e.x - d.x) - d.facing) > 0.1
        )
          this.damageEnemy(e, 48);
      this.particlesAt(
        { x: d.x + Math.cos(d.facing) * 45, y: d.y + Math.sin(d.facing) * 45 },
        "#f0dda4",
        4,
      );
    } else {
      if (d.ammo <= 0) {
        this.notice(
          "Plus de flèches : E près d’une réserve pour remplir le carquois.",
        );
        return;
      }
      d.ammo--;
      d.cooldown = 0.62;
      this.projectile(
        d,
        target,
        28 + 10 * this.level("arrows"),
        "ally",
        "arrow",
      );
    }
  }
  projectile(
    from: Vec,
    to: Vec,
    damage: number,
    team: "ally" | "enemy",
    kind: "arrow" | "bolt" | "fire",
    wallId: number | null = null,
  ) {
    const dir = toward(from, to),
      speed =
        kind === "bolt"
          ? 750
          : kind === "fire"
            ? 235
            : team === "enemy"
              ? 310
              : 630;
    const life = team === "enemy" ? distance(from, to) / speed : 1.9;
    this.projectiles.push({
      id: this.nextId++,
      x: from.x + dir.x * 25,
      y: from.y + dir.y * 25,
      px: from.x,
      py: from.y,
      vx: dir.x * speed,
      vy: dir.y * speed,
      life,
      total: life,
      damage,
      team,
      kind,
      startZ: elevation(from) + 25,
      endZ: team === "enemy" && wallId !== null ? 32 : elevation(to) + 18,
      wallId,
      pierce: kind === "bolt" ? 3 : 1,
      hit: new Set(),
    });
  }
  interact() {
    const p = this.player;
    if (p.dead) return;
    if (p.carried !== null) {
      this.release(p);
      this.notice("Baliste déposée. E pour la servir.");
      return;
    }
    if (p.mounted !== null) {
      this.release(p);
      this.notice("Vous quittez la baliste.");
      return;
    }
    const stock = STOCKS.find((s) => distance(s, p) < 90);
    if (stock) {
      p.ammo = 24;
      this.notice("Carquois rempli : 24 flèches.");
      return;
    }
    const b = this.ballistas
      .filter(
        (b) =>
          b.hp > 0 &&
          b.user === null &&
          b.carrier === null &&
          distance(b, p) < 85,
      )
      .sort((a, b) => distance(a, p) - distance(b, p))[0];
    if (b) {
      p.mounted = b.id;
      b.user = p.id;
      this.notice(
        "Baliste : clic pour tirer · R pour recharger · F pour déplacer · E pour quitter.",
      );
      return;
    }
    const drop = this.pickups.find((q) => distance(q, p) < 85);
    if (drop) {
      this.resources += drop.amount;
      this.pickups = this.pickups.filter((q) => q !== drop);
      return;
    }
    this.notice(
      "Approchez une baliste ou une réserve. Maintenez R près d’une structure pour réparer.",
    );
  }
  reload(d: Defender) {
    if (d.mounted === null) return;
    const b = this.ballistas[d.mounted];
    if (!b.loaded && b.reload <= 0 && this.resources >= 2) {
      this.resources -= 2;
      b.reload = 3.2 * Math.pow(0.82, this.level("reload"));
    }
  }
  carry() {
    const p = this.player;
    if (p.mounted === null) return;
    const b = this.ballistas[p.mounted];
    p.x = b.x;
    p.y = b.y;
    b.user = null;
    b.carrier = p.id;
    p.mounted = null;
    p.carried = b.id;
    this.notice(
      "Déplacez la baliste avec vous. E : déposer. Escaliers larges à l’est et à l’ouest.",
    );
  }
  repair(d: Defender, dt: number) {
    if (this.resources <= 0) return false;
    const targets = [...this.walls, ...this.ballistas]
      .filter((w) => w.hp < w.maxHp && distance(w, d) < 105)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    const w = targets[0];
    if (!w) return false;
    const rate = 28 * (1 + 0.4 * this.level("repair"));
    const amount = Math.min(w.maxHp - w.hp, rate * dt, this.resources * 8);
    w.hp += amount;
    this.resources -= amount / 8;
    d.attacking = 0.15;
    if (Math.random() < dt * 15) this.particlesAt(d, "#f3c875", 2);
    return true;
  }
  buy(id: string) {
    const u = this.upgrades.find((u) => u.id === id);
    if (
      !u ||
      this.phase !== "preparation" ||
      this.resources < u.cost ||
      u.level >= 3
    )
      return false;
    this.resources -= u.cost;
    u.level++;
    if (id === "walls")
      for (const w of this.walls) {
        w.maxHp += 150;
        w.hp = Math.min(w.maxHp, w.hp + 150);
      }
    u.cost = Math.ceil(u.cost * 1.5);
    this.notice(`${u.name} — niveau ${u.level}`);
    return true;
  }
  startWave() {
    if (this.phase === "defeat") return;
    this.wave++;
    this.phase = "assault";
    this.spawnLeft = 9 + this.wave * 4;
    this.spawnTimer = 0.4;
    this.fronts =
      this.wave === 1
        ? [0]
        : this.wave === 2
          ? [1, 3]
          : this.wave % 2
            ? [0, 2]
            : [0, 1, 2, 3];
    this.notice(
      `Vague ${this.wave} — attaque : ${this.fronts.map((s) => SIDES[s]).join(" · ")}`,
    );
  }
  spawn(kind?: EnemyKind, side?: Side) {
    const s =
      side ?? this.fronts[Math.floor(Math.random() * this.fronts.length)];
    const k =
      kind ??
      (
        [
          "goblin",
          "skeleton",
          "runner",
          ...(this.wave >= 2 ? ["fire", "brute"] : []),
        ] as EnemyKind[]
      )[Math.floor(Math.random() * (this.wave >= 2 ? 5 : 3))];
    const pos =
      s === 0
        ? { x: 690 + Math.random() * 1020, y: 100 }
        : s === 1
          ? { x: 2290, y: 650 + Math.random() * 900 }
          : s === 2
            ? { x: 690 + Math.random() * 1020, y: 2100 }
            : { x: 100, y: 650 + Math.random() * 900 };
    const hp =
      (k === "brute" ? 210 : k === "runner" ? 45 : 75) *
      (1 + 0.08 * (this.wave - 1));
    this.enemies.push({
      ...pos,
      id: this.nextId++,
      kind: k,
      side: s,
      hp,
      maxHp: hp,
      radius: k === "brute" ? 25 : 17,
      cooldown: 1 + Math.random(),
      hurt: 0,
      walk: 0,
      facing: 0,
      dead: 0,
      think: 0,
      path: [],
      pathTime: 0,
    });
  }
  navigate(d: Defender | Enemy, target: Vec, dt: number, speed: number) {
    d.pathTime -= dt;
    if (d.pathTime <= 0 || !d.path.length) {
      d.path = findPath(d, target, this.walls, d.radius);
      d.pathTime = 0.9 + Math.random() * 0.3;
    }
    while (d.path.length && distance(d, d.path[0]) < 14) d.path.shift();
    const point = d.path[0];
    if (!point) return;
    const dir = toward(d, point);
    const moved = move(
      d,
      dir.x * speed * dt,
      dir.y * speed * dt,
      d.radius,
      this.walls,
    );
    if (moved) {
      d.walk += (dt * speed) / 25;
      d.facing = Math.atan2(dir.y, dir.x);
    } else d.pathTime = 0;
  }
  update(dt: number, input: Input, aim: Vec) {
    if (!this.started || this.paused || this.phase === "defeat") return;
    dt = Math.min(dt, 0.04);
    this.time += dt;
    this.tick++;
    this.messageTime -= dt;
    this.shake = Math.max(0, this.shake - dt * 20);
    const p = this.player;
    for (const d of this.defenders) {
      d.cooldown = Math.max(0, d.cooldown - dt);
      d.hurt = Math.max(0, d.hurt - dt);
      d.attacking = Math.max(0, d.attacking - dt);
      d.dodge = Math.max(0, d.dodge - dt);
      d.dodgeCooldown = Math.max(0, d.dodgeCooldown - dt);
      if (d.dead > 0) {
        d.dead -= dt;
        if (d.dead <= 0) {
          d.hp = d.maxHp * 0.7;
          d.x = 1200;
          d.y = 1100;
          d.dead = 0;
        }
      }
    }
    if (p.dead <= 0) {
      if (input.pressed.has("e")) this.interact();
      if (input.pressed.has("f")) this.carry();
      if (input.pressed.has("1")) p.weapon = 1;
      if (input.pressed.has("2")) p.weapon = 2;
      let dx =
        Number(input.keys.has("d") || input.keys.has("arrowright")) -
        Number(
          input.keys.has("a") ||
            input.keys.has("q") ||
            input.keys.has("arrowleft"),
        );
      let dy =
        Number(input.keys.has("s") || input.keys.has("arrowdown")) -
        Number(
          input.keys.has("w") ||
            input.keys.has("z") ||
            input.keys.has("arrowup"),
        );
      if (
        input.pressed.has(" ") &&
        p.dodgeCooldown <= 0 &&
        p.carried === null &&
        p.mounted === null
      ) {
        p.dodge = 0.22;
        p.dodgeCooldown = 1.5;
        const len = Math.hypot(dx, dy);
        p.dashX = len ? dx / len : Math.cos(p.facing);
        p.dashY = len ? dy / len : Math.sin(p.facing);
      }
      if (p.dodge > 0) {
        dx = p.dashX;
        dy = p.dashY;
      }
      if (p.mounted === null) {
        const len = Math.hypot(dx, dy) || 1,
          speed = p.carried !== null ? 112 : p.dodge > 0 ? 650 : 225;
        const old = { x: p.x, y: p.y };
        move(
          p,
          (dx / len) * speed * dt,
          (dy / len) * speed * dt,
          p.carried !== null ? 35 : p.radius,
          this.walls,
          p.carried !== null,
        );
        if (dx || dy) p.walk += (dt * speed) / 25;
        if (p.carried !== null) {
          const b = this.ballistas[p.carried];
          b.x = p.x;
          b.y = p.y;
          if (distance(p, old) > 0.1) b.angle = Math.atan2(dy, dx);
        }
      }
      p.facing = Math.atan2(aim.y - p.y, aim.x - p.x);
      if (p.mounted !== null) this.ballistas[p.mounted].angle = p.facing;
      if (input.down || input.clicked) this.shoot(p, aim);
      if (input.keys.has("r") || input.pressed.has("r")) {
        if (p.mounted !== null) this.reload(p);
        else this.repair(p, dt);
      }
    }
    for (const b of this.ballistas) {
      b.recoil = Math.max(0, b.recoil - dt * 4);
      if (b.reload > 0) {
        b.reload -= dt;
        if (b.reload <= 0) {
          b.loaded = true;
          b.reload = 0;
        }
      }
      if (b.hp <= 0 && b.user !== null) this.release(this.defenders[b.user]);
    }
    updateAllies(this, dt);
    updateEnemies(this, dt);
    for (const e of this.enemies) {
      e.cooldown -= dt;
      e.hurt = Math.max(0, e.hurt - dt);
      if (e.hp <= 0) e.dead -= dt;
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0 || e.dead > 0);
    for (const q of this.projectiles) {
      q.px = q.x;
      q.py = q.y;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.life -= dt;
      if (q.team === "ally") {
        const progress = clamp(1 - q.life / q.total, 0, 1),
          z =
            q.startZ * (1 - progress) +
            q.endZ * progress +
            Math.sin(progress * Math.PI) * 28;
        if (
          z < 58 &&
          this.walls.some(
            (w) =>
              w.hp > 0 &&
              Math.abs(q.x - w.x) < w.w / 2 + 3 &&
              Math.abs(q.y - w.y) < w.h / 2 + 3,
          )
        ) {
          q.life = -1;
          this.particlesAt(q, "#b5c0ba", 3);
          continue;
        }
        for (const e of this.enemies)
          if (
            e.hp > 0 &&
            !q.hit.has(e.id) &&
            segmentDistance({ x: q.px, y: q.py }, q, e) < e.radius + 6
          ) {
            this.damageEnemy(e, q.damage);
            q.hit.add(e.id);
            q.pierce--;
            if (q.pierce <= 0) {
              q.life = -1;
              break;
            }
          }
      } else {
        for (const d of this.defenders)
          if (
            d.dead <= 0 &&
            segmentDistance({ x: q.px, y: q.py }, q, d) < d.radius + 8
          ) {
            this.damageDefender(d, q.damage);
            q.life = -1;
            q.wallId = null;
            break;
          }
        for (const b of this.ballistas)
          if (b.hp > 0 && segmentDistance({ x: q.px, y: q.py }, q, b) < 26) {
            b.hp = Math.max(0, b.hp - q.damage * 0.7);
            q.life = -1;
            q.wallId = null;
            break;
          }
        if (q.life <= 0 && q.wallId !== null && !q.hit.has(-1)) {
          this.damageWall(q.wallId, q.damage);
          q.hit.add(-1);
        }
      }
      if (q.life <= 0)
        this.particlesAt(q, q.kind === "fire" ? "#ff9b4a" : "#d1bd81", 5);
    }
    this.projectiles = this.projectiles.filter((q) => q.life > 0);
    for (const q of this.particles) {
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 0.94;
      q.vy *= 0.94;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    for (const q of this.pickups) {
      q.life -= dt;
      for (const d of this.defenders)
        if (d.dead <= 0 && distance(q, d) < 54) {
          this.resources += q.amount;
          q.life = 0;
          break;
        }
    }
    this.pickups = this.pickups.filter((q) => q.life > 0);
    if (this.phase === "preparation") {
      this.remaining -= dt;
      if (this.remaining <= 0) this.startWave();
    } else {
      this.spawnTimer -= dt;
      if (this.spawnLeft > 0 && this.spawnTimer <= 0) {
        this.spawn();
        this.spawnLeft--;
        this.spawnTimer = Math.max(0.65, 1.8 - this.wave * 0.1);
      }
      if (this.spawnLeft === 0 && !this.enemies.some((e) => e.hp > 0)) {
        this.phase = "preparation";
        this.remaining = 24;
        this.resources += 45;
        for (const d of this.defenders) {
          d.hp = Math.min(d.maxHp, d.hp + 40);
          d.ammo = 24;
        }
        this.notice(
          `Vague ${this.wave} repoussée ! +45 bois · Améliorez vos défenses.`,
        );
      }
    }
    if (this.integrity < 0.12 || this.defenders.every((d) => d.dead > 0)) {
      this.phase = "defeat";
      this.notice("Le château est tombé.");
    }
  }
}
