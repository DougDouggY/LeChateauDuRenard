import type { PowerId } from "./types";
export interface Hero {
  id: number;
  name: string;
  title: string;
  colorName: string;
  color: string;
  power: PowerId;
  powerName: string;
  description: string;
  cooldown: number;
  ammoCost: number;
  group: 0 | 1;
  row: number;
  symbol: string;
}
export const HEROES: Hero[] = [
  {
    id: 0,
    name: "Aëlan",
    title: "Le Renard d’ambre",
    colorName: "ambre",
    color: "#dca44f",
    power: "explosive",
    powerName: "Flèche explosive",
    description:
      "Une flèche qui explose à l’impact et frappe tous les ennemis proches.",
    cooldown: 10,
    ammoCost: 1,
    group: 0,
    row: 0,
    symbol: "✹",
  },
  {
    id: 1,
    name: "Brune",
    title: "La Sentinelle verte",
    colorName: "verte",
    color: "#79b58b",
    power: "multishot",
    powerName: "Tir multiple",
    description: "Cinq flèches en éventail pour trois flèches du carquois.",
    cooldown: 8,
    ammoCost: 3,
    group: 0,
    row: 1,
    symbol: "⋙",
  },
  {
    id: 2,
    name: "Nivéa",
    title: "La Veille de givre",
    colorName: "bleue",
    color: "#8ecbed",
    power: "frost",
    powerName: "Flèche de givre",
    description:
      "Un éclat de glace ralentit fortement les ennemis pendant quatre secondes.",
    cooldown: 9,
    ammoCost: 1,
    group: 0,
    row: 2,
    symbol: "❄",
  },
  {
    id: 3,
    name: "Kaël",
    title: "La Braise écarlate",
    colorName: "rouge",
    color: "#df8464",
    power: "fire",
    powerName: "Flèche de feu",
    description:
      "Enflamme sa cible et lui inflige des dégâts pendant cinq secondes.",
    cooldown: 9,
    ammoCost: 1,
    group: 0,
    row: 3,
    symbol: "♨",
  },
  {
    id: 4,
    name: "Osric",
    title: "L’Ombre pourpre",
    colorName: "violette",
    color: "#b59bdb",
    power: "piercing",
    powerName: "Trait perforant",
    description: "Un trait puissant qui peut traverser jusqu’à six ennemis.",
    cooldown: 8,
    ammoCost: 1,
    group: 1,
    row: 0,
    symbol: "➴",
  },
  {
    id: 5,
    name: "Sélène",
    title: "L’Éclat lunaire",
    colorName: "ivoire",
    color: "#e6dec1",
    power: "moon",
    powerName: "Flèche lunaire",
    description:
      "Un impact lumineux qui soigne le tireur et les alliés proches de 18 PV.",
    cooldown: 10,
    ammoCost: 1,
    group: 1,
    row: 1,
    symbol: "☾",
  },
  {
    id: 6,
    name: "Ronce",
    title: "Le Venin silencieux",
    colorName: "noire",
    color: "#a7bd72",
    power: "poison",
    powerName: "Flèche empoisonnée",
    description:
      "Empoisonne sa cible pendant six secondes ; les dégâts continuent après le tir.",
    cooldown: 9,
    ammoCost: 1,
    group: 1,
    row: 2,
    symbol: "☠",
  },
  {
    id: 7,
    name: "Ilyas",
    title: "La Voix de l’orage",
    colorName: "turquoise",
    color: "#78d1ce",
    power: "lightning",
    powerName: "Flèche de foudre",
    description:
      "La foudre rebondit entre quatre ennemis et les étourdit brièvement.",
    cooldown: 11,
    ammoCost: 1,
    group: 1,
    row: 3,
    symbol: "ϟ",
  },
];
export const DEFAULT_ROSTER = [0, 1, 4];
export const WALK_SHEETS = ["assets/hood-walk-a.png", "assets/hood-walk-b.png"];
export const SHOT_SHEETS = ["assets/hood-shot-a.png", "assets/hood-shot-b.png"];
export function hero(id: number): Hero {
  return HEROES[id] ?? HEROES[0];
}
