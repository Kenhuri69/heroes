/**
 * Carte d'aventure : grille CARRÉE 8 directions (doc 02 §2.1 — l'hexagone est
 * réservé au combat). Le moteur reçoit une carte déjà résolue et validée par
 * le pipeline de contenu : il ne connaît ni le format `*.map.json` ni aucune
 * faction — uniquement des IDs et des données (README §1).
 */

export interface GridPos {
  x: number;
  y: number;
}

/** Objets interactifs posés sur la carte (doc 02 §2.2) : ressources, gardiens neutres. */
export interface ResourceObjectDef {
  id: string;
  type: 'resource';
  pos: GridPos;
  /** ID de ressource — validé par le contenu, opaque pour le moteur. */
  resource: string;
  amount: number;
}

/** Gardien neutre : pile unique, déclenche un combat à l'interception (doc 02 §2.2, §5). */
export interface GuardianObjectDef {
  id: string;
  type: 'guardian';
  pos: GridPos;
  unitId: string;
  count: number;
}

export type MapObjectDef = ResourceObjectDef | GuardianObjectDef;

/**
 * Effet déclaratif d'un trigger de carte (doc 02 §2.1 « scripts d'événements
 * simples »). Union **générique** — le moteur applique le `kind`, jamais un nom
 * de faction ni de scénario. Ajouter un effet = une variante ici + son
 * interprétation dans `adventure/triggers.ts` (même idiome que `FactionBonus`).
 */
export type TriggerEffect =
  | { kind: 'grantResource'; resource: string; amount: number }
  | { kind: 'message'; textKey: string };

/**
 * Trigger de carte (doc 02 §2.1) : un effet déclaratif déclenché soit à la
 * visite d'une tuile (`visit`), soit à un jour donné (`day`). One-shot :
 * `fired` passe à `true` au déclenchement et l'effet ne rejoue plus.
 */
export interface MapTriggerDef {
  id: string;
  on: { kind: 'visit'; pos: GridPos } | { kind: 'day'; day: number };
  effect: TriggerEffect;
  fired: boolean;
}

/** Forme résolue de la carte, telle qu'embarquée dans `StartGame` puis l'état. */
export interface AdventureMapDef {
  id: string;
  width: number;
  height: number;
  /** ID de terrain par tuile, row-major (longueur width×height). */
  terrain: string[];
  /** Route par tuile (coût ×roadMultiplier — doc 02 §1.5). */
  road: boolean[];
  objects: MapObjectDef[];
  /** Triggers déclaratifs (doc 02 §2.1) — `[]` si la carte n'en définit aucun. */
  triggers: MapTriggerDef[];
  /** Positions de départ des héros, une par joueur dans l'ordre des joueurs. */
  startPositions: GridPos[];
}

export function inBounds(map: AdventureMapDef, pos: GridPos): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x < map.width && pos.y < map.height;
}

export function tileIndex(map: AdventureMapDef, pos: GridPos): number {
  return pos.y * map.width + pos.x;
}

export function terrainAt(map: AdventureMapDef, pos: GridPos): string {
  const id = map.terrain[tileIndex(map, pos)];
  if (id === undefined) throw new RangeError(`tuile hors carte (${pos.x},${pos.y})`);
  return id;
}

/** Les 8 voisins en grille carrée (doc 02 §2.1), dans un ordre fixe — déterminisme. */
export const DIRECTIONS: readonly GridPos[] = [
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
];

export function isAdjacent(a: GridPos, b: GridPos): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx <= 1 && dy <= 1 && dx + dy > 0;
}

export function isDiagonal(a: GridPos, b: GridPos): boolean {
  return a.x !== b.x && a.y !== b.y;
}

export function samePos(a: GridPos, b: GridPos): boolean {
  return a.x === b.x && a.y === b.y;
}
