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
  type EquipmentKind,
  type PurchaseKind,
  type PowerId,
  type BowShot,
  type CombatEffect,
  type WaveAlert,
  type Stock,
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
  SUPPLY_POSTS,
  sideOf,
  FORT,
} from "./map";
import { updateAllies, updateEnemies } from "./strategy";
import { Workshop } from "./workshop";
import { projectileHeight } from "./combat";
import { HEROES, DEFAULT_ROSTER, hero } from "./heroes";
import { powerImpact, effect } from "./powers";
export class Simulation {
  time = 0;
  tick = 0;
  navigationSearches = 0;
  nextId = 100;
  walls = makeWalls();
  defenders: Defender[] = [];
  enemies: Enemy[] = [];
  ballistas: Ballista[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  pickups: Pickup[] = [];
  effects: CombatEffect[] = [];
  waveAlert: WaveAlert | null = null;
  wave = 0;
  phase: "preparation" | "assault" | "defeat" = "preparation";
  remaining = 10;
  spawnLeft = 0;
  spawnTimer = 0;
  fronts: Side[] = [0];
  coins = 0;
  stocks: Stock[] = [{ id: 0, x: 1320, y: 1130, pulse: 0 }];
  workshop = new Workshop(this);
  placement: EquipmentKind | null = null;
  shopRequested = false;
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
  constructor(roster: number[] = DEFAULT_ROSTER) {
    const selected: number[] = [];
    for (let slot = 0; slot < 3; slot++) {
      const requested = roster[slot];
      selected.push(
        Number.isInteger(requested) &&
          requested >= 0 &&
          requested < HEROES.length &&
          !selected.includes(requested)
          ? requested
          : HEROES.find((h) => !selected.includes(h.id))!.id,
      );
    }
    this.defenders = selected.map((heroId, i) => ({
      hero: heroId,
      abilityCooldown: 0,
      shot: null,
      releaseFlash: 0,
      repairCredit: 0,
      id: i,
      name: hero(heroId).name,
      color: hero(heroId).color,
      x: 1200 + (i - 1) * 80,
      y: 1200 + (i ? 45 : 0),
      hp: 160,
      maxHp: 160,
      radius: 17,
      cooldown: 0,
      hurt: 0,
      walk: 0,
      moving: false,
      moveFacing: 0,
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
      pathGoal: null,
      mounted: null,
      carried: null,
      ammo: 24,
      attacking: 0,
    }));
  }
  selectHero(slot: number, heroId: number): boolean {
    if (
      this.started ||
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot > 2 ||
      !Number.isInteger(heroId) ||
      !HEROES[heroId]
    )
      return false;
    const current = this.defenders[slot],
      other = this.defenders.find((d) => d.id !== slot && d.hero === heroId),
      old = current.hero;
    const assign = (d: Defender, id: number) => {
      d.hero = id;
      d.name = hero(id).name;
      d.color = hero(id).color;
      d.abilityCooldown = 0;
      d.shot = null;
    };
    if (other) assign(other, old);
    assign(current, heroId);
    return true;
  }
  refill(d: Defender, stock: Stock): boolean {
    if (d.dead > 0 || distance(d, stock) > 90 || d.ammo >= 24) return false;
    const amount = 24 - d.ammo;
    d.ammo = 24;
    stock.pulse = 1;
    effect(this, "ammo", stock, "#eddaa0", 40, 0.55, {
      target: { x: d.x, y: d.y },
      amount,
    });
    this.particlesAt(stock, "#e5cca0", 7);
    return true;
  }
  installBallista(p: Vec) {
    const side = sideOf(p);
    const b: Ballista = {
      ...p,
      id: this.ballistas.length,
      hp: 300,
      maxHp: 300,
      angle: [-Math.PI / 2, 0, Math.PI / 2, Math.PI][side],
      reload: 0,
      loaded: true,
      user: null,
      carrier: null,
      recoil: 0,
    };
    this.ballistas.push(b);
    return b;
  }
  availableSites(kind: EquipmentKind): Vec[] {
    const occupied = kind === "ballista" ? this.ballistas : this.stocks;
    return (kind === "ballista" ? POSTS : SUPPLY_POSTS).filter(
      (p) => !occupied.some((o) => distance(p, o) < 90),
    );
  }
  requestPlacement(kind: EquipmentKind): boolean {
    if (
      !this.workshop.ready ||
      this.coins < this.workshop.cost(kind) ||
      !this.availableSites(kind).length
    )
      return false;
    this.placement = kind;
    this.notice(
      "Choisissez un emplacement éclairé. Clic pour commander · Échap pour annuler.",
    );
    return true;
  }
  placeOrder(target: Vec): boolean {
    if (!this.placement) return false;
    const spot = this.availableSites(this.placement)
      .filter((p) => distance(p, target) < 95)
      .sort((a, b) => distance(a, target) - distance(b, target))[0];
    return !!spot && this.workshop.order(this.placement, spot);
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
    for (
      let i = 0;
      i < Math.min(count, Math.max(0, 450 - this.particles.length));
      i++
    ) {
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
    if (n >= 1 && this.effects.filter((f) => f.kind === "damage").length < 36)
      effect(this, "damage", e, "#eedbc1", 12, 0.55, { amount: Math.round(n) });
    this.particlesAt(e, e.kind === "skeleton" ? "#e7d4a3" : "#b6b64f", 5);
    if (e.hp <= 0) {
      e.dead = 0.7;
      this.kills++;
      const amount = e.kind === "brute" ? 20 : 10;
      this.coins += amount;
      effect(this, "coins", e, "#eac66f", 20, 1.25, { amount });
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
    if (d.dead > 0) {
      d.shot = null;
      d.releaseFlash = 0;
    }
    if (d.mounted !== null) {
      this.ballistas[d.mounted].user = null;
      d.mounted = null;
    }
    if (d.carried !== null) {
      this.ballistas[d.carried].carrier = null;
      d.carried = null;
    }
  }
  shoot(d: Defender, target: Vec, manualAim = false) {
    if (d.dead || d.cooldown > 0 || d.shot || d.carried !== null) return;
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
        null,
        null,
        d.id,
        manualAim,
      );
      b.loaded = false;
      b.recoil = 1;
      d.cooldown = 0.25;
      this.shake = 2;
      return;
    }
    if (d.ammo <= 0) {
      if (d.id === 0)
        this.notice(
          "Carquois vide : E près d’une réserve pour reprendre 24 flèches.",
        );
      return;
    }
    this.drawBow(d, target, null, 1, manualAim);
  }
  drawBow(
    d: Defender,
    target: Vec,
    power: PowerId | null,
    cost: number,
    manualAim = false,
  ) {
    d.ammo -= cost;
    d.cooldown = 0.62;
    d.attacking = 0.45;
    d.releaseFlash = 0;
    d.facing = Math.atan2(target.y - d.y, target.x - d.x);
    const lock = manualAim
      ? undefined
      : this.enemies.find((e) => e.hp > 0 && distance(e, target) < 24);
    d.shot = {
      manualAim,
      target: { ...target },
      lockId: lock?.id ?? null,
      power,
      remaining: 0.24,
      duration: 0.24,
      ammoCost: cost,
    };
  }
  cancelCharge() {
    const p = this.player;
    if (!p.shot?.held) return;
    p.ammo = Math.min(24, p.ammo + p.shot.ammoCost);
    p.shot = null;
    p.cooldown = 0;
  }
  useAbility(d: Defender, target: Vec, manualAim = false): boolean {
    if (!this.started || this.phase === "defeat") return false;
    const h = hero(d.hero);
    if (
      d.dead > 0 ||
      d.mounted !== null ||
      d.carried !== null ||
      this.placement ||
      d.abilityCooldown > 0
    )
      return false;
    const available = d.ammo + (d.shot && !d.shot.power ? d.shot.ammoCost : 0);
    if (available < h.ammoCost) {
      if (d.id === 0)
        this.notice(
          `Il faut ${h.ammoCost} flèche(s) pour ${h.powerName.toLowerCase()}.`,
        );
      return false;
    }
    if (d.shot) {
      if (d.shot.power) return false;
      d.ammo = Math.min(24, d.ammo + d.shot.ammoCost);
      d.shot = null;
    }
    this.drawBow(d, target, h.power, h.ammoCost, manualAim);
    d.abilityCooldown = h.cooldown;
    return true;
  }
  releaseArrow(d: Defender, shot: BowShot) {
    let target = shot.target;
    const lock = this.enemies.find((e) => e.id === shot.lockId && e.hp > 0);
    if (lock && !shot.manualAim) target = { x: lock.x, y: lock.y };
    d.facing = Math.atan2(target.y - d.y, target.x - d.x);
    d.releaseFlash = 0.16;
    d.attacking = 0.16;
    const bonus = 10 * this.level("arrows"),
      power = shot.power;
    if (power === "multishot") {
      const a = d.facing,
        dist = Math.max(400, distance(d, target));
      for (const angle of [-0.22, -0.11, 0, 0.11, 0.22])
        this.projectile(
          d,
          {
            x: d.x + Math.cos(a + angle) * dist,
            y: d.y + Math.sin(a + angle) * dist,
          },
          24 + bonus,
          "ally",
          "arrow",
          null,
          power,
          d.id,
          shot.manualAim,
        );
    } else {
      const damage =
        power === "piercing"
          ? 95
          : power === "moon"
            ? 60
            : power === "lightning"
              ? 45
              : power === "explosive"
                ? 23
                : power
                  ? 35
                  : 28;
      this.projectile(
        d,
        target,
        (shot.charge !== undefined ? 18 + 38 * shot.charge : damage) + bonus,
        "ally",
        "arrow",
        null,
        power,
        d.id,
        shot.manualAim,
        shot.charge ?? null,
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
    power: PowerId | null = null,
    ownerId = -1,
    manualAim = false,
    charge: number | null = null,
  ) {
    const dir = toward(from, to),
      speed =
        charge !== null
          ? 480 + charge * 360
          : kind === "bolt"
            ? 750
            : kind === "fire"
              ? 235
              : team === "enemy"
                ? 310
                : 630;
    const life =
      charge !== null
        ? (250 + charge * 1050 - 25) / speed
        : team === "enemy"
          ? distance(from, to) / speed
          : power === "explosive" || power === "frost"
            ? Math.max(0.08, (distance(from, to) - 25) / speed)
            : 2.6;
    this.projectiles.push({
      manualAim,
      id: this.nextId++,
      power,
      ownerId,
      effectDone: false,
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
      endZ: manualAim
        ? elevation(from) + 25
        : team === "enemy" && wallId !== null
          ? 32
          : elevation(to) + 18,
      wallId,
      pierce: power === "piercing" ? 6 : kind === "bolt" ? 3 : 1,
      hit: new Set(),
    });
  }
  interact() {
    const p = this.player;
    if (p.dead) return;
    if (p.shot) {
      this.notice("Terminez votre tir avant d’interagir.");
      return;
    }
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
    if (this.workshop.ready && distance(p, this.workshop) < 105) {
      this.shopRequested = true;
      return;
    }
    const stock = this.stocks.find((s) => distance(s, p) < 90);
    if (stock) {
      this.refill(p, stock);
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
      this.coins += drop.amount;
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
    if (!b.loaded && b.reload <= 0 && this.coins >= 2) {
      this.coins -= 2;
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
      "Déplacez la baliste avec vous. E : déposer. Toute la plateforme est au même niveau.",
    );
  }
  repair(d: Defender, dt: number) {
    if (this.coins < 1 && d.repairCredit <= 0) return false;
    const targets = [...this.walls, ...this.ballistas]
      .filter((w) => w.hp < w.maxHp && distance(w, d) < 105)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    const w = targets[0];
    if (!w) return false;
    const rate = 28 * (1 + 0.4 * this.level("repair"));
    const needed = Math.min(w.maxHp - w.hp, rate * dt);
    const spend = Math.min(
      this.coins,
      Math.max(0, Math.ceil((needed - d.repairCredit) / 8)),
    );
    this.coins -= spend;
    d.repairCredit += spend * 8;
    const amount = Math.min(needed, d.repairCredit);
    d.repairCredit -= amount;
    w.hp += amount;
    d.attacking = 0.15;
    if (Math.random() < dt * 15) this.particlesAt(d, "#f3c875", 2);
    return true;
  }
  buy(id: string) {
    if (!this.upgrades.some((u) => u.id === id)) return false;
    return this.workshop.order(id as PurchaseKind);
  }
  applyUpgrade(id: string) {
    const u = this.upgrades.find((u) => u.id === id);
    if (!u) return;
    u.level++;
    if (id === "walls")
      for (const w of this.walls) {
        w.maxHp += 150;
        w.hp = Math.min(w.maxHp, w.hp + 150);
      }
    u.cost = Math.ceil(u.cost * 1.5);
  }
  startWave() {
    if (this.phase !== "preparation" || this.workshop.busy || this.placement)
      return;
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
    const labels = ["du nord", "de l’est", "du sud", "de l’ouest"];
    const text =
      this.fronts.length === 4
        ? "Des monstres arrivent de tous les côtés !"
        : `Des monstres arrivent ${this.fronts.map((s) => labels[s]).join(" et ")} !`;
    this.waveAlert = { text, fronts: [...this.fronts], life: 4.5, total: 4.5 };
    this.messageTime = 0;
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
      burn: 0,
      poison: 0,
      slow: 0,
      stun: 0,
      dotTick: 0,
      side: s,
      hp,
      maxHp: hp,
      radius: k === "brute" ? 25 : 17,
      cooldown: 1 + Math.random(),
      hurt: 0,
      walk: 0,
      moving: false,
      moveFacing: 0,
      facing: 0,
      dead: 0,
      think: 0,
      path: [],
      pathTime: 0,
      pathGoal: null,
    });
  }
  navigate(d: Defender | Enemy, target: Vec, dt: number, speed: number) {
    d.pathTime -= dt;
    const inside = (p: Vec) =>
      p.x > FORT.left + 32 &&
      p.x < FORT.right - 32 &&
      p.y > FORT.top + 32 &&
      p.y < FORT.bottom - 32;
    // The raised deck is convex and has no internal obstacles. Walk directly
    // instead of repeatedly building a grid path for ordinary patrols.
    if (inside(d) && inside(target)) {
      d.path = [];
      d.pathGoal = { ...target };
      const dist = distance(d, target);
      if (dist < 8) return;
      const dir = toward(d, target),
        step = Math.min(dist, speed * dt);
      if (move(d, dir.x * step, dir.y * step, d.radius, this.walls)) {
        d.walk += step / 25;
        d.moving = true;
        d.moveFacing = Math.atan2(dir.y, dir.x);
        d.facing = d.moveFacing;
      }
      return;
    }
    const changed = !d.pathGoal || distance(d.pathGoal, target) > 60;
    if (d.pathTime <= 0 || (changed && d.pathTime < 0.65)) {
      this.navigationSearches++;
      d.path = findPath(d, target, this.walls, d.radius);
      d.pathGoal = { ...target };
      d.pathTime = 0.9;
    }
    while (d.path.length && distance(d, d.path[0]) < 14) d.path.shift();
    const point = d.path[0];
    if (!point) return;
    const dir = toward(d, point),
      step = Math.min(distance(d, point), speed * dt);
    if (move(d, dir.x * step, dir.y * step, d.radius, this.walls)) {
      d.walk += step / 25;
      d.moving = true;
      d.moveFacing = Math.atan2(dir.y, dir.x);
      d.facing = d.moveFacing;
    } else d.pathTime = Math.min(d.pathTime, 0.15);
  }
  update(dt: number, input: Input, aim: Vec) {
    if (!this.started || this.paused || this.phase === "defeat") return;
    dt = Math.min(dt, 0.04);
    this.time += dt;
    this.tick++;
    this.messageTime -= dt;
    if (this.waveAlert) {
      this.waveAlert.life -= dt;
      if (this.waveAlert.life <= 0) this.waveAlert = null;
    }
    for (const stock of this.stocks)
      stock.pulse = Math.max(0, stock.pulse - dt * 2);
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter((e) => e.life > 0);
    this.shake = Math.max(0, this.shake - dt * 20);
    const p = this.player;
    for (const d of this.defenders) {
      d.moving = false;
      d.cooldown = Math.max(0, d.cooldown - dt);
      d.abilityCooldown = Math.max(0, d.abilityCooldown - dt);
      d.releaseFlash = Math.max(0, d.releaseFlash - dt);
      if (d.shot && d.dead <= 0 && !d.shot.held) {
        d.shot.remaining -= dt;
        if (d.shot.remaining <= 0) {
          const shot = d.shot;
          d.shot = null;
          this.releaseArrow(d, shot);
        }
      }
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
        (input.pressed.has("shift") || input.pressed.has(" ")) &&
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
        const traveled = distance(p, old);
        if (traveled > 0.01) {
          p.walk += traveled / 25;
          p.moving = true;
          p.moveFacing = Math.atan2(p.y - old.y, p.x - old.x);
        }
        if (p.carried !== null) {
          const b = this.ballistas[p.carried];
          b.x = p.x;
          b.y = p.y;
          if (distance(p, old) > 0.1) b.angle = Math.atan2(dy, dx);
        }
      }
      const bowAim = input.aimRay ?? aim;
      p.facing = Math.atan2(bowAim.y - p.y, bowAim.x - p.x);
      p.side = sideOf(p);
      if (p.mounted !== null) this.ballistas[p.mounted].angle = p.facing;
      const placing = this.placement !== null;
      if (placing && input.clicked) this.placeOrder(aim);
      if (!placing && input.abilityPressed)
        this.useAbility(p, bowAim, !!input.aimRay);
      if (!placing && !input.abilityPressed) {
        if (p.mounted !== null) {
          if (input.down || input.clicked)
            this.shoot(p, bowAim, !!input.aimRay);
        } else {
          if (input.clicked && !p.shot) {
            this.shoot(p, bowAim, !!input.aimRay);
            const drawn = p.shot as BowShot | null;
            if (drawn) {
              drawn.held = true;
              drawn.charge = 0;
            }
          }
          if (p.shot?.held) {
            p.shot.target = { ...bowAim };
            p.shot.charge = Math.min(1, (p.shot.charge ?? 0) + dt / 0.95);
            p.facing = Math.atan2(bowAim.y - p.y, bowAim.x - p.x);
            if (!input.down) {
              const shot = p.shot;
              p.shot = null;
              p.cooldown = 0.22;
              this.releaseArrow(p, shot);
            }
          }
        }
      }
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
    for (const e of this.enemies)
      if (e.hp > 0) {
        e.dotTick += dt;
        if (e.dotTick >= 0.5) {
          e.dotTick -= 0.5;
          const damage = (e.burn > 0 ? 8 : 0) + (e.poison > 0 ? 6 : 0);
          if (damage) this.damageEnemy(e, damage);
        }
        e.burn = Math.max(0, e.burn - dt);
        e.poison = Math.max(0, e.poison - dt);
        e.slow = Math.max(0, e.slow - dt);
        e.stun = Math.max(0, e.stun - dt);
      }
    this.workshop.update(dt);
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
        const z = projectileHeight(q);
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
            (q.manualAim
              ? segmentDistance(
                  { x: q.px, y: q.py * 0.72 - q.startZ },
                  { x: q.x, y: q.y * 0.72 - q.startZ },
                  { x: e.x, y: e.y * 0.72 - elevation(e) - 48 },
                ) <
                e.radius + 24
              : segmentDistance({ x: q.px, y: q.py }, q, e) < e.radius + 6)
          ) {
            this.damageEnemy(e, q.damage);
            q.hit.add(e.id);
            powerImpact(this, q, e);
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
      if (
        q.life <= 0 &&
        q.team === "ally" &&
        (q.power === "explosive" || q.power === "frost")
      )
        powerImpact(this, q, null);
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
          this.coins += q.amount;
          q.life = 0;
          break;
        }
    }
    this.pickups = this.pickups.filter((q) => q.life > 0);
    if (this.phase === "preparation") {
      this.remaining -= dt;
      if (this.remaining <= 0 && !this.workshop.busy && !this.placement)
        this.startWave();
    } else {
      this.spawnTimer -= dt;
      if (this.spawnLeft > 0 && this.spawnTimer <= 0) {
        this.spawn();
        this.spawnLeft--;
        this.spawnTimer = Math.max(0.65, 1.8 - this.wave * 0.1);
      }
      if (this.spawnLeft === 0 && !this.enemies.some((e) => e.hp > 0)) {
        this.phase = "preparation";
        this.remaining = 60;
        this.workshop.arrive();
        this.coins += 45;
        for (const d of this.defenders) {
          d.hp = Math.min(d.maxHp, d.hp + 40);
        }
        this.notice(
          `Manche ${this.wave} repoussée ! +45 pièces d’or · Retrouvez l’ouvrier au centre.`,
        );
      }
    }
    if (this.integrity < 0.12 || this.defenders.every((d) => d.dead > 0)) {
      this.phase = "defeat";
      this.notice("Le château est tombé.");
    }
  }
}
