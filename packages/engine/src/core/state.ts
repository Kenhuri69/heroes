import type { RngState } from './rng';

/** Les 7 ressources du jeu (doc 02 §3). Les montants vivent dans les données. */
export const RESOURCE_IDS = [
  'gold',
  'wood',
  'ore',
  'crystal',
  'gems',
  'sulfur',
  'mercury',
] as const;

export type ResourceId = (typeof RESOURCE_IDS)[number];
export type Resources = Record<ResourceId, number>;

export interface PlayerState {
  id: string;
  resources: Resources;
}

export interface Calendar {
  /** Jour absolu, commence à 1. Semaine = floor((day-1)/7)+1 (doc 02 §2.3). */
  day: number;
}

/**
 * L'état complet d'une partie — un seul arbre JSON-sérialisable (doc 07 §3) :
 * c'est à la fois le format de sauvegarde et le futur état re-simulable serveur.
 */
export interface GameState {
  saveVersion: 1;
  /** Partie non démarrée tant que `StartGame` n'a pas été appliquée. */
  started: boolean;
  rng: RngState;
  calendar: Calendar;
  players: PlayerState[];
  /** Index du joueur dont c'est le tour. */
  currentPlayer: number;
}

export function createEmptyState(): GameState {
  return {
    saveVersion: 1,
    started: false,
    rng: { hi: 0, lo: 0, incHi: 0, incLo: 0 },
    calendar: { day: 1 },
    players: [],
    currentPlayer: 0,
  };
}

export function weekOf(day: number): number {
  return Math.floor((day - 1) / 7) + 1;
}

export function emptyResources(): Resources {
  return { gold: 0, wood: 0, ore: 0, crystal: 0, gems: 0, sulfur: 0, mercury: 0 };
}
