import type { PlayerState } from '@heroes/engine';
import { appStore } from '../app/store';

/**
 * Couleur de bannière PAR JOUEUR (doc 08 §5) — dérivée de l'index du joueur
 * dans `players` (stable toute la partie). Sert au drapeau des mines
 * capturées ; jamais utilisée SEULE pour porter une information
 * (accessibilité A5) : le drapeau est toujours présent, gris quand neutre.
 */
export const PLAYER_COLORS: readonly number[] = [
  0xc0392b, // rouge — joueur 1
  0x2980b9, // bleu — joueur 2
  0x27ae60, // vert
  0x8e44ad, // violet
  0xd68910, // orange
  0x16a085, // sarcelle
  0xaf7ac5, // lilas
  0x5d6d7e, // ardoise
];

/**
 * Suffixes de clé i18n des NOMS de couleur (`newgame.colorName.<suffixe>`), dans
 * le même ordre que `PLAYER_COLORS`. Sert de 2ᵉ canal (A5, doc 08 §4) au choix de
 * couleur : une pastille est toujours nommée, jamais « la couleur seule ».
 */
export const PLAYER_COLOR_NAMES: readonly string[] = [
  'red',
  'blue',
  'green',
  'purple',
  'orange',
  'teal',
  'lilac',
  'slate',
];

/** Gris des objets neutres (même teinte que le fanion de gardien). */
export const NEUTRAL_COLOR = 0x8a8f98;

export function playerColor(
  players: readonly Pick<PlayerState, 'id'>[],
  playerId: string | null,
): number {
  if (playerId === null) return NEUTRAL_COLOR;
  // Couleur choisie à « Nouvelle partie » (lot 6.4) prioritaire ; sinon la palette
  // d'index (défaut historique, et repli des autres modes qui ne choisissent pas).
  const chosen = appStore.getState().playerColors[playerId];
  if (chosen !== undefined) return chosen;
  const index = players.findIndex((p) => p.id === playerId);
  if (index === -1) return NEUTRAL_COLOR;
  return PLAYER_COLORS[index % PLAYER_COLORS.length] as number;
}
