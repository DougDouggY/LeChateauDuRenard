import type { Simulation } from "./simulation";
import { CENTRAL_STAIR, WORKSHOP_COUNTER, move } from "./map";
import {
  distance,
  toward,
  type Vec,
  type Delivery,
  type PurchaseKind,
} from "./types";

export const EQUIPMENT = [
  {
    id: "ballista" as const,
    name: "Baliste mobile",
    description: "L’ouvrier l’apporte sur l’emplacement choisi.",
    cost: 90,
  },
  {
    id: "stock" as const,
    name: "Réserve de flèches",
    description: "Un nouveau point pour remplir les carquois.",
    cost: 40,
  },
];
export class Workshop {
  x = CENTRAL_STAIR.x;
  y = CENTRAL_STAIR.y;
  state:
    | "hidden"
    | "arriving"
    | "ready"
    | "fetching"
    | "delivering"
    | "building"
    | "leaving" = "hidden";
  walk = 0;
  moving = false;
  facing = 0;
  job: Delivery | null = null;
  speech = 0;
  emergence = 0;
  constructor(private g: Simulation) {}
  get ready() {
    return (
      this.state === "ready" &&
      this.g.phase === "preparation" &&
      this.g.wave > 0
    );
  }
  get busy() {
    return this.job !== null || this.state === "arriving";
  }
  arrive() {
    this.x = CENTRAL_STAIR.x;
    this.y = CENTRAL_STAIR.y;
    this.emergence = 0;
    this.state = "arriving";
    this.job = null;
    this.g.notice("Manche terminée ! L’ouvrier monte par l’escalier central.");
  }
  cost(kind: PurchaseKind) {
    return (
      EQUIPMENT.find((u) => u.id === kind)?.cost ??
      this.g.upgrades.find((u) => u.id === kind)?.cost ??
      Infinity
    );
  }
  order(kind: PurchaseKind, target?: Vec): boolean {
    if (!this.ready) {
      this.g.notice(
        this.job
          ? "L’ouvrier termine votre livraison."
          : "Retrouvez l’ouvrier entre deux manches.",
      );
      return false;
    }
    const upgrade = this.g.upgrades.find((u) => u.id === kind);
    if (upgrade && upgrade.level >= 3) return false;
    if (
      (kind === "ballista" || kind === "stock") &&
      (!target ||
        !this.g.availableSites(kind).some((p) => distance(p, target) < 1))
    )
      return false;
    const cost = this.cost(kind);
    if (this.g.coins < cost) {
      this.g.notice("Pas assez de pièces.");
      return false;
    }
    this.g.coins -= cost;
    this.job = {
      kind,
      target: target
        ? { ...target }
        : { ...WORKSHOP_COUNTER, x: WORKSHOP_COUNTER.x + 75 },
      cost,
      build: 1.3,
    };
    this.state = "fetching";
    this.g.placement = null;
    this.speech = 0;
    this.g.notice("Commande reçue ! Je vous prépare ça rapidement.");
    return true;
  }
  travel(target: Vec, dt: number) {
    const dist = distance(this, target);
    if (dist < 6) {
      this.x = target.x;
      this.y = target.y;
      return true;
    }
    const dir = toward(this, target),
      step = Math.min(dist, 190 * dt);
    if (move(this, dir.x * step, dir.y * step, 15, this.g.walls)) {
      this.walk += step / 23;
      this.moving = true;
      this.facing = Math.atan2(dir.y, dir.x);
    }
    return false;
  }
  update(dt: number) {
    this.moving = false;
    this.speech = Math.max(0, this.speech - dt);
    if (this.state === "hidden") return;
    if (this.state === "arriving") {
      this.emergence = Math.min(1, this.emergence + dt * 1.8);
      if (this.emergence === 1 && this.travel(WORKSHOP_COUNTER, dt)) {
        this.state = "ready";
        this.speech = 14;
        this.g.notice(
          "« Dites-moi de quoi vous avez besoin, je vous prépare ça rapidement ! » — E près de l’ouvrier.",
        );
      }
    } else if (this.state === "ready") {
      if (this.g.phase !== "preparation") {
        this.state = "leaving";
        this.speech = 0;
      }
    } else if (this.state === "fetching") {
      if (this.travel(CENTRAL_STAIR, dt)) this.state = "delivering";
    } else if (this.state === "delivering" && this.job) {
      if (this.travel(this.job.target, dt)) this.state = "building";
    } else if (this.state === "building" && this.job) {
      this.job.build -= dt;
      if (this.job.build <= 0) {
        const job = this.job;
        this.job = null;
        if (job.kind === "ballista") this.g.installBallista(job.target);
        else if (job.kind === "stock")
          this.g.stocks.push({
            ...job.target,
            id: this.g.stocks.length,
            pulse: 0,
          });
        else this.g.applyUpgrade(job.kind);
        this.g.particlesAt(this, "#e5c080", 18);
        this.g.notice(
          job.kind === "ballista"
            ? "Baliste livrée et installée. E pour la servir."
            : job.kind === "stock"
              ? "Réserve installée. E pour remplir le carquois."
              : "Amélioration livrée !",
        );
        this.state = "arriving";
        this.emergence = 1;
      }
    } else if (this.state === "leaving") {
      if (this.travel(CENTRAL_STAIR, dt)) {
        this.emergence = Math.max(0, this.emergence - dt * 2);
        if (this.emergence === 0) this.state = "hidden";
      }
    }
  }
}
