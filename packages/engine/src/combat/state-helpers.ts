import type { CombatRulesConfig } from '../adventure/config';
import type { GameState } from '../core/state';
import { heroArtifactBonus } from '../hero/artifacts';
import { heroMorale } from '../hero/skills';
import type { CombatSideId, CombatStack, CombatState, CombatUnitDef } from './types';

/**
 * Utilitaires partagés par les règles de combat (placement, ordre de jeu,
 * dégâts, IA) : moral, vitesse effective, bornage, bilan de fin de combat.
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function hasAbility(def: CombatUnitDef, id: string): boolean {
  return def.abilities.some((a) => a.id === id);
}

/** Munitions déclarées par la capacité `shooter(ammo, noMeleePenalty?)`, ou null si non-tireur. */
export function shooterAmmo(def: CombatUnitDef): number | null {
  const shooter = def.abilities.find((a) => a.id === 'shooter');
  if (!shooter) return null;
  const ammo = shooter.params?.ammo;
  return typeof ammo === 'number' ? ammo : 0;
}

/** Tireur forcé en mêlée sans `noMeleePenalty` ⇒ pénalité ×rangedMeleePenalty. */
export function isShooterMeleePenalized(def: CombatUnitDef): boolean {
  const shooter = def.abilities.find((a) => a.id === 'shooter');
  if (!shooter) return false;
  return shooter.params?.noMeleePenalty !== true;
}

/**
 * Vitesse effective = vitesse de base +1 si terrain natif (doc 02 §5.1) + somme
 * des `speedMod` des statuts actifs (Hâte/Lenteur/Entraves, doc 02 §1.4/§5.1 :
 * la vitesse est la portée de déplacement), bornée à ≥ 0. Sert à la fois à
 * l'ordre d'initiative et à la portée de déplacement (`reachableHexes`).
 */
export function effectiveSpeed(
  stack: CombatStack,
  combat: CombatState,
  catalog: Record<string, CombatUnitDef>,
): number {
  const def = catalog[stack.unitId];
  if (!def) return 0;
  const nativeBonus = def.nativeTerrain === combat.terrain ? 1 : 0;
  const speedMod = stack.statuses.reduce((sum, s) => sum + s.speedMod, 0);
  return Math.max(0, def.stats.speed + nativeBonus + speedMod);
}

/** Bonus de moral du héros lié au camp `side` (Commandement + artefacts) — 0 si aucun héros. */
function heroMoraleForSide(state: GameState, combat: CombatState, side: CombatSideId): number {
  const heroId = side === 'attacker' ? combat.attackerHeroId : combat.defenderHeroId;
  const hero = heroId ? state.heroes.find((h) => h.id === heroId) : undefined;
  if (!hero) return 0;
  return heroMorale(hero, state.skillCatalog) + heroArtifactBonus(hero, state.artifactCatalog).morale;
}

/** Une unité neutre au moral : morts-vivants (moral figé 0) ou machine de guerre. */
function isMoraleNeutral(def: CombatUnitDef): boolean {
  return hasAbility(def, 'undead') || hasAbility(def, 'warMachine');
}

/**
 * Moral d'une pile (doc 02 §5.3, décisions plan #4/#17) : +1 si terrain natif,
 * −1 par groupId distinct au-delà du premier, + Commandement/artefacts du héros
 * lié au camp ; morts-vivants ET machines de guerre exclus du calcul (moral 0,
 * hors décompte des groupes — une baliste n'est pas une « faction en plus »).
 * Borné [−3, +3].
 */
export function moraleOf(stack: CombatStack, combat: CombatState, state: GameState): number {
  const catalog = state.unitCatalog;
  const def = catalog[stack.unitId];
  if (!def) return 0;
  if (isMoraleNeutral(def)) return 0;
  const terrainBonus = def.nativeTerrain === combat.terrain ? 1 : 0;
  const groups = new Set<string>();
  for (const s of combat.stacks) {
    if (s.side !== stack.side || s.count <= 0) continue;
    const d = catalog[s.unitId];
    if (d && !isMoraleNeutral(d)) groups.add(d.groupId);
  }
  const malus = Math.max(0, groups.size - 1);
  return clamp(terrainBonus - malus + heroMoraleForSide(state, combat, stack.side), -3, 3);
}

export function otherSide(side: CombatSideId): CombatSideId {
  return side === 'attacker' ? 'defender' : 'attacker';
}

/**
 * Extension runtime PRIVÉE (non déclarée dans `combat/types.ts`, gelé en
 * cadrage) : bilan des pertes cumulées sur tout le combat, indexé
 * `${side}:${unitId}`. Le typage structurel de TS autorise ce champ
 * additionnel sur l'objet réellement construit sans toucher au fichier gelé.
 */
export interface CombatLedger {
  _losses?: Record<string, number>;
}
export type CombatStateInternal = CombatState & CombatLedger;

export function initLedger(combat: CombatState): void {
  (combat as CombatStateInternal)._losses = {};
}

export function recordLoss(
  combat: CombatState,
  side: CombatSideId,
  unitId: string,
  amount: number,
): void {
  if (amount <= 0) return;
  const internal = combat as CombatStateInternal;
  const losses = internal._losses ?? {};
  const key = `${side}:${unitId}`;
  losses[key] = (losses[key] ?? 0) + amount;
  internal._losses = losses;
}

export function collectCasualties(
  combat: CombatState,
): { side: CombatSideId; unitId: string; lost: number }[] {
  const losses = (combat as CombatStateInternal)._losses ?? {};
  return Object.entries(losses).map(([key, lost]) => {
    const sep = key.indexOf(':');
    const side = key.slice(0, sep) as CombatSideId;
    const unitId = key.slice(sep + 1);
    return { side, unitId, lost };
  });
}

export type Rules = CombatRulesConfig;

/** Config de combat non-nulle — le moteur garantit `config` dès `StartGame`. */
export function combatRules(state: GameState): CombatRulesConfig {
  if (!state.config) throw new Error('config absente : la partie n’est pas démarrée');
  return state.config.combat;
}
