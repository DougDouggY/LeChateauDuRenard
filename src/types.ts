export type Vec = { x: number; y: number };
export type Side = 0 | 1 | 2 | 3;
export type Order = "auto" | "follow" | "defend" | "repair" | "ballista";
export type EnemyKind = "goblin" | "skeleton" | "fire" | "runner" | "brute";
export interface Actor extends Vec {
  id: number;
  hp: number;
  maxHp: number;
  radius: number;
  cooldown: number;
  hurt: number;
  walk: number;
  moving: boolean;
  moveFacing: number;
  facing: number;
  dead: number;
}
export type PowerId =
  | "explosive"
  | "multishot"
  | "frost"
  | "fire"
  | "piercing"
  | "moon"
  | "poison"
  | "lightning";
export interface BowShot {
  held?: boolean;
  charge?: number;
  manualAim?: boolean;
  target: Vec;
  lockId: number | null;
  power: PowerId | null;
  remaining: number;
  duration: number;
  ammoCost: number;
}
export interface Defender extends Actor {
  hero: number;
  abilityCooldown: number;
  shot: BowShot | null;
  releaseFlash: number;
  repairCredit: number;
  name: string;
  color: string;
  weapon: 2;
  dodge: number;
  dashX: number;
  dashY: number;
  dodgeCooldown: number;
  order: Order;
  side: Side;
  path: Vec[];
  pathTime: number;
  pathGoal: Vec | null;
  mounted: number | null;
  carried: number | null;
  ammo: number;
  attacking: number;
}
export interface Enemy extends Actor {
  burn: number;
  poison: number;
  slow: number;
  stun: number;
  dotTick: number;
  kind: EnemyKind;
  side: Side;
  think: number;
  path: Vec[];
  pathTime: number;
  pathGoal: Vec | null;
}
export interface Wall extends Vec {
  id: number;
  side: Side;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  gate: boolean;
}
export interface Ballista extends Vec {
  id: number;
  hp: number;
  maxHp: number;
  angle: number;
  reload: number;
  loaded: boolean;
  user: number | null;
  carrier: number | null;
  recoil: number;
}
export interface Projectile extends Vec {
  manualAim?: boolean;
  power: PowerId | null;
  ownerId: number;
  effectDone: boolean;
  id: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  total: number;
  damage: number;
  team: "ally" | "enemy";
  kind: "arrow" | "bolt" | "fire";
  startZ: number;
  endZ: number;
  wallId: number | null;
  pierce: number;
  hit: Set<number>;
}
export interface Particle extends Vec {
  vx: number;
  vy: number;
  life: number;
  total: number;
  color: string;
  size: number;
}
export interface Pickup extends Vec {
  id: number;
  amount: number;
  life: number;
}
export interface Input {
  aimRay?: Vec;
  keys: Set<string>;
  pressed: Set<string>;
  mouse: Vec;
  down: boolean;
  clicked: boolean;
  abilityPressed?: boolean;
}
export interface Upgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
  level: number;
}
export const SIDES = ["Nord", "Est", "Sud", "Ouest"];
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
export const toward = (a: Vec, b: Vec) => {
  const d = distance(a, b) || 1;
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
};

export interface Stock extends Vec {
  pulse: number;
  id: number;
}
export type EquipmentKind = "ballista" | "stock";
export type PurchaseKind =
  EquipmentKind | "power" | "reload" | "walls" | "arrows" | "repair";
export interface Delivery {
  kind: PurchaseKind;
  target: Vec;
  cost: number;
  build: number;
}

export interface CombatEffect extends Vec {
  id: number;
  kind:
    "explosion" | "frost" | "lightning" | "heal" | "coins" | "ammo" | "damage";
  life: number;
  total: number;
  color: string;
  radius: number;
  amount?: number;
  points?: Vec[];
  target?: Vec;
}
export interface WaveAlert {
  text: string;
  fronts: Side[];
  life: number;
  total: number;
}
