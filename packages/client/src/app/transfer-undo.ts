import type { ArmyStack } from '@heroes/engine';

/**
 * Annuler le dernier transfert (LE-UX) : le moteur n'a pas de retour arrière, on
 * rejoue donc la commande INVERSE — seulement quand elle restitue exactement
 * l'état d'avant. Une pile fusionnée à une pile de même unité ne se sépare pas
 * (pas de commande de scission) : pas d'annulation dans ce cas.
 */

/**
 * Pile à renvoyer : `slot` côté destination, et `index` qu'elle occupait à la
 * source (la renvoyer la place en fin d'armée ; `ReorderArmy` la remet en place).
 * `null` si non réversible.
 */
export function reverseArmySlot(
  sourceBefore: readonly ArmyStack[],
  sourceAfter: readonly ArmyStack[],
  destBefore: readonly ArmyStack[],
  destAfter: readonly ArmyStack[],
): { slot: number; index: number } | null {
  if (sourceAfter.length !== sourceBefore.length - 1 || destAfter.length !== destBefore.length + 1) return null;
  const slot = destAfter.length - 1;
  const moved = destAfter[slot]!;
  const index = sourceBefore.findIndex((s, i) => sourceAfter[i]?.unitId !== s.unitId || sourceAfter[i]?.count !== s.count);
  const gone = sourceBefore[index];
  return gone && gone.unitId === moved.unitId && gone.count === moved.count ? { slot, index } : null;
}

/** Emplacement d'artefact apparu chez la destination ; `null` s'il n'y en a pas. */
export function reverseArtifactSlot(
  destBefore: readonly (string | null)[],
  destAfter: readonly (string | null)[],
): number | null {
  const slot = destAfter.findIndex((a, i) => a !== null && destBefore[i] === null);
  return slot === -1 ? null : slot;
}
