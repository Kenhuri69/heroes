import { appStore } from './store';
import { eventBus, type AppEvent } from './events';
import { humanId } from './game';
import { sfxIdForEvent } from './audio';

/**
 * Retour haptique mobile (I15) : `navigator.vibrate` sur **confirmations** et
 * **kills**, **opt-in** (défaut OFF), persisté. Le mapping événement → motif
 * réutilise le gating humain de `sfxIdForEvent` (audio) : un `combat-death` →
 * vibration de kill, un `ui-confirm` → tick de confirmation. Le son **double**
 * déjà ces événements ⇒ l'haptique n'est jamais le seul canal.
 */
const K_HAPTICS = 'heroes:haptics';
const KILL_PATTERN = [22]; // pulsation nette (mort d'une pile)
const CONFIRM_PATTERN = [12]; // tick discret (construction/recrutement/niveau)

function readEnabled(): boolean {
  try {
    return localStorage.getItem(K_HAPTICS) === '1';
  } catch {
    return false;
  }
}

let enabled = readEnabled();

/** Nombre de vibrations DÉCLENCHÉES (tentatives, indépendant du support navigateur) — hook de test. */
export const hapticStats = { count: 0 };

/**
 * Motif de vibration associé à un événement (`null` = aucun) — **pur**. Dérivé du
 * SFX humain-gardé (`sfxIdForEvent`) : `combat-death` → kill, `ui-confirm` → confirm.
 */
export function hapticForEvent(
  event: AppEvent,
  ctx: Parameters<typeof sfxIdForEvent>[1],
): number[] | null {
  const sfx = sfxIdForEvent(event, ctx);
  if (sfx === 'combat-death') return KILL_PATTERN;
  if (sfx === 'ui-confirm') return CONFIRM_PATTERN;
  return null;
}

/** Active/désactive le retour haptique (opt-in), persisté + miroir store. */
export function setHaptics(v: boolean): void {
  if (enabled === v) return;
  enabled = v;
  try {
    localStorage.setItem(K_HAPTICS, enabled ? '1' : '0');
  } catch {
    /* quota / navigation privée : l'haptique n'est jamais critique */
  }
  appStore.setState({ hapticsEnabled: enabled });
}

/** Déclenche une vibration si activée (compte la tentative ; no-op sans support). */
function triggerHaptic(pattern: number[]): void {
  if (!enabled) return;
  hapticStats.count += 1;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    /* certains navigateurs jettent hors contexte utilisateur — sans gravité */
  }
}

/** Branche l'haptique : miroir store + abonnement au bus d'événements. */
export function initHaptics(): void {
  appStore.setState({ hapticsEnabled: enabled });
  eventBus.on((event) => {
    const game = appStore.getState().game;
    const pattern = hapticForEvent(event, {
      humanId: humanId(game),
      townOwner: (townId) => game.towns.find((tw) => tw.id === townId)?.ownerPlayerId,
      heroPlayer: (heroId) => game.heroes.find((h) => h.id === heroId)?.playerId,
    });
    if (!pattern) return;
    // Le kill ne vibre QUE dans un combat AFFICHÉ (jamais pendant un tour d'IA,
    // qui résout ses combats sans poser `game.combat` côté client).
    if (event.type === 'StackDied' && !game.combat) return;
    triggerHaptic(pattern);
  });
}
