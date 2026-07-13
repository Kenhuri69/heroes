import type { CombatRulesConfig } from '../adventure/config';
import type { GameState, HeroState } from '../core/state';
import { heroArtifactBonus } from '../hero/artifacts';
import { heroMorale } from '../hero/skills';
import { townBuildingAura, townEliteDamageBonus } from '../town/economy';
import type { CombatSideId, CombatStack, CombatState, CombatUnitDef } from './types';

/**
 * Utilitaires partagés par les règles de combat (placement, ordre de jeu,
 * dégâts, IA) : moral, vitesse effective, bornage, bilan de fin de combat.
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Hexes STATIQUEMENT bloqués d'un combat (C-SIEGE2) : obstacles + murs de siège
 * intacts. Clés `col,row`. Partagé par le déplacement (`reachableHexes`), la
 * ligne de vue (`hasLineOfSight`) et le ciblage de téléportation
 * (`teleportDestinations`) — un mur bloque exactement comme un obstacle.
 */
export function staticBlockedKeys(combat: CombatState): Set<string> {
  const set = new Set<string>();
  for (const o of combat.obstacles) set.add(`${o.col},${o.row}`);
  for (const w of combat.siegeWalls ?? []) set.add(`${w.col},${w.row}`);
  return set;
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

/**
 * Pile silenciée (F-SCHOOLS.4, doc 05 §6 « Silence Scellé ») : porte un statut
 * `silenced` actif ⇒ ne peut plus lancer son sort d'unité (`spellcaster`). Les
 * statuts expirés sont retirés au round ⇒ présence = actif.
 */
export function isSilenced(stack: CombatStack): boolean {
  return stack.statuses.some((s) => s.silenced);
}

/**
 * Paramètres de la capacité `performer` (F-RESON.2, doc 16 §3.2) : ressource de
 * faction générée en combat et montant par round, ou null si non-performeur.
 */
export function performerParams(def: CombatUnitDef): { resource: string; amount: number } | null {
  const perf = def.abilities.find((a) => a.id === 'performer');
  if (!perf) return null;
  const resource = perf.params?.resource;
  const amount = perf.params?.amount;
  if (typeof resource !== 'string' || typeof amount !== 'number') return null;
  return { resource, amount };
}

/** Tireur forcé en mêlée sans `noMeleePenalty` ⇒ pénalité ×rangedMeleePenalty. */
export function isShooterMeleePenalized(def: CombatUnitDef): boolean {
  const shooter = def.abilities.find((a) => a.id === 'shooter');
  if (!shooter) return false;
  return shooter.params?.noMeleePenalty !== true;
}

/**
 * Bonus de spécialité CONDITIONNEL (H-COND, doc 04 §5 / 05 §7 / 14 §5) porté par
 * le héros du camp `side` et ciblé sur une UNITÉ (`unitId`) : attaque/défense/
 * vitesse, mis à l'échelle par niveau (`perLevels` ⇒ ×`ceil(level/perLevels)`,
 * sinon ×1). Lit `specialtyEffects`/`houseEffects` (mêmes effets déclaratifs).
 * Générique : le moteur ne lit que des ids opaques. 0 sans héros ou hors cible.
 */
export function conditionalUnitBonus(
  state: GameState,
  combat: CombatState,
  side: CombatSideId,
  unitId: string,
  key: 'attack' | 'defense' | 'speed',
): number {
  const heroId = side === 'attacker' ? combat.attackerHeroId : combat.defenderHeroId;
  const hero = heroId ? state.heroes.find((h) => h.id === heroId) : undefined;
  if (!hero) return 0;
  let total = 0;
  for (const eff of [...hero.specialtyEffects, ...hero.houseEffects]) {
    const c = eff.conditional;
    if (!c) continue;
    if (c.unitId && c.unitId !== unitId) continue;
    const amount = c[key] ?? 0;
    if (!amount) continue;
    const scale = c.perLevels && c.perLevels > 0 ? Math.max(1, Math.ceil(hero.level / c.perLevels)) : 1;
    total += amount * scale;
  }
  return total;
}

/**
 * Vitesse effective = vitesse de base +1 si terrain natif (doc 02 §5.1) + bonus de
 * spécialité conditionnelle de vitesse (H-COND) quand `state` est fourni (chemins
 * de correction : initiative, portée) ; omis dans les approximations d'IA.
 */
export function effectiveSpeed(
  stack: CombatStack,
  combat: CombatState,
  catalog: Record<string, CombatUnitDef>,
  state?: GameState,
): number {
  const def = catalog[stack.unitId];
  if (!def) return 0;
  const base = def.stats.speed + (def.nativeTerrain === combat.terrain ? 1 : 0);
  return base + (state ? conditionalUnitBonus(state, combat, stack.side, stack.unitId, 'speed') : 0);
}

/**
 * Portée de DÉPLACEMENT (doc 02 §1.4/5.1, A4) : vitesse effective + somme des
 * `speedMod` des statuts actifs (Hâte/Lenteur/Entraves), bornée ≥ 0. La vitesse
 * EST la portée en hexes — l'initiative utilise la même somme (non bornée) dans
 * `turns.ts`. Consommée par `reachableHexes` (et donc l'UI et l'IA).
 */
export function moveRange(
  stack: CombatStack,
  combat: CombatState,
  catalog: Record<string, CombatUnitDef>,
  state?: GameState,
): number {
  const mods = stack.statuses.reduce((sum, s) => sum + s.speedMod, 0);
  return Math.max(0, effectiveSpeed(stack, combat, catalog, state) + mods);
}

/**
 * Vitesse d'INITIATIVE (doc 02 §5.2) : vitesse effective + somme des `speedMod`
 * des statuts actifs, NON bornée (contrairement à `moveRange`) — c'est la somme
 * qu'utilise l'ordre de jeu par vagues (`turns.ts`) et sa projection UI.
 */
export function initiativeSpeed(
  stack: CombatStack,
  combat: CombatState,
  catalog: Record<string, CombatUnitDef>,
  state?: GameState,
): number {
  return effectiveSpeed(stack, combat, catalog, state) + stack.statuses.reduce((sum, s) => sum + s.speedMod, 0);
}

/** Ordre de passage projeté d'un round (lot UX M1) : piles restantes + round suivant. */
export interface RoundActionOrder {
  /** Piles qui doivent encore jouer ce round, dans l'ordre où elles joueront. */
  current: CombatStack[];
  /** Projection du round suivant (toutes les piles vivantes, vague normale). */
  next: CombatStack[];
}

/**
 * Projette l'ordre de passage (doc 08 §2.4 « ordre du round ») : vague normale
 * par vitesse décroissante puis piles en attente par vitesse croissante, mêmes
 * départages que `pickNext` (`turns.ts`) — la 1ʳᵉ entrée de `current` est donc
 * la pile active. Projection nominale : les aléas résolus au moment du tour
 * (saut de moral négatif, immobilisation) ne sont pas anticipés.
 */
/**
 * Départage d'initiative PARTAGÉ (doc 02 §5.2) entre `pickNext` (turns.ts) et
 * `roundActionOrder` — source unique pour éviter toute divergence ordre réel /
 * projection UI. Critères : vitesse d'initiative (sens `direction`), puis
 * `firstStrike` (A2g : priorité à vitesse égale, indépendante du camp), puis
 * camp attaquant, puis slot.
 */
export function compareInitiative(
  a: CombatStack,
  b: CombatStack,
  combat: CombatState,
  catalog: Record<string, CombatUnitDef>,
  direction: 'asc' | 'desc',
  state?: GameState,
): number {
  const sa = initiativeSpeed(a, combat, catalog, state);
  const sb = initiativeSpeed(b, combat, catalog, state);
  if (sa !== sb) return direction === 'desc' ? sb - sa : sa - sb;
  const defA = catalog[a.unitId];
  const defB = catalog[b.unitId];
  const fa = defA ? hasAbility(defA, 'firstStrike') : false;
  const fb = defB ? hasAbility(defB, 'firstStrike') : false;
  if (fa !== fb) return fa ? -1 : 1;
  if (a.side !== b.side) return a.side === 'attacker' ? -1 : 1;
  return a.slot - b.slot;
}

export function roundActionOrder(
  combat: CombatState,
  catalog: Record<string, CombatUnitDef>,
  state?: GameState,
): RoundActionOrder {
  if (combat.finished) return { current: [], next: [] };
  const bySpeed =
    (direction: 'asc' | 'desc') =>
    (a: CombatStack, b: CombatStack): number =>
      compareInitiative(a, b, combat, catalog, direction, state);
  const alive = combat.stacks.filter((s) => s.count > 0);
  const main = alive.filter((s) => !s.acted && !s.waited).sort(bySpeed('desc'));
  const wait = alive.filter((s) => !s.acted && s.waited).sort(bySpeed('asc'));
  return { current: [...main, ...wait], next: [...alive].sort(bySpeed('desc')) };
}

/**
 * Bonus de moral du héros lié au camp `side` : compétence Commandement +
 * moral d'artefacts (B7 — `bonus.morale` était sommé mais jamais branché).
 * 0 si aucun héros.
 */
function heroMoraleForSide(state: GameState, combat: CombatState, side: CombatSideId): number {
  const heroId = side === 'attacker' ? combat.attackerHeroId : combat.defenderHeroId;
  const hero = heroId ? state.heroes.find((h) => h.id === heroId) : undefined;
  if (!hero) return 0;
  return (
    heroMorale(hero, state.skillCatalog) +
    heroArtifactBonus(hero, state.artifactCatalog).morale +
    factionCombatBonus(state, combat, side).morale
  );
}

/**
 * Bonus de combat PASSIFS de la faction du héros lié au camp (F-BONUS, doc 03 §2 /
 * doc 06 §4) : somme les variantes `combatBonus` de `factionCatalog[factionId]
 * .bonuses`. Générique — le moteur ne connaît aucun nom de faction. {0,0,0} si
 * aucun héros / aucune faction / aucun bonus de combat déclaré. Consommé par le
 * moral (ici) et par l'attaque/défense de camp (`damage.ts`).
 */
export function factionCombatBonus(
  state: GameState,
  combat: CombatState,
  side: CombatSideId,
): { attack: number; defense: number; morale: number } {
  const heroId = side === 'attacker' ? combat.attackerHeroId : combat.defenderHeroId;
  const hero = heroId ? state.heroes.find((h) => h.id === heroId) : undefined;
  const bonuses = hero ? state.factionCatalog[hero.factionId]?.bonuses ?? [] : [];
  let attack = 0;
  let defense = 0;
  let morale = 0;
  for (const b of bonuses) {
    if (b.type === 'combatBonus') {
      attack += b.attack ?? 0;
      defense += b.defense ?? 0;
      morale += b.morale ?? 0;
    }
  }
  return { attack, defense, morale };
}

/**
 * Fléau persistant (F-BONUS, doc 04 §2) : somme des `curseDurationBonus.rounds`
 * de la faction du héros — rounds ajoutés à la durée d'un sort de malédiction
 * (`debuff`) qu'il lance. 0 sans héros / faction / bonus. Générique (aucun nom de
 * faction) ; consommé par `castHeroSpell` uniquement pour un sort `debuff`.
 */
export function factionCurseDurationBonus(state: GameState, hero: HeroState | undefined): number {
  const bonuses = hero ? state.factionCatalog[hero.factionId]?.bonuses ?? [] : [];
  let rounds = 0;
  for (const b of bonuses) if (b.type === 'curseDurationBonus') rounds += b.rounds;
  return rounds;
}

/**
 * Moral d'une pile (doc 02 §5.3, décisions plan #4/#17) : +1 si terrain natif,
 * −1 par groupId distinct au-delà du premier, + Commandement du héros lié au
 * camp (compétence, remédiation R5 CO4) ; morts-vivants exclus du calcul et
 * toujours à moral 0. **A3a** : les capacités `aura` (une pile ennemie module le
 * moral, ex. Dragon d'os `moraleMod:-1`) et `moraleImmune` (le moral ne descend
 * jamais sous 0, ex. Ange) sont interprétées ici. **F-SCHOOLS** : les statuts de
 * sort à `moraleMod` (École de la Scène) s'y ajoutent aussi. Borné [−3, +3].
 */
export function moraleOf(stack: CombatStack, combat: CombatState, state: GameState): number {
  const catalog = state.unitCatalog;
  const def = catalog[stack.unitId];
  if (!def) return 0;
  // Morts-vivants ET machines de guerre (B6, marqueur de données `warMachine`) :
  // hors du système de moral — ni n'en subissent, ni n'en donnent (pas comptés
  // comme une « faction » distincte dans l'armée).
  if (hasAbility(def, 'undead') || hasAbility(def, 'warMachine')) return 0;
  const terrainBonus = def.nativeTerrain === combat.terrain ? 1 : 0;
  const groups = new Set<string>();
  let auraMod = 0;
  for (const s of combat.stacks) {
    const d = catalog[s.unitId];
    if (!d || s.count <= 0) continue;
    if (s.side === stack.side) {
      if (!hasAbility(d, 'undead') && !hasAbility(d, 'warMachine')) groups.add(d.groupId);
    } else {
      // Aura d'une pile ENNEMIE (A3a, ex. Dragon d'os −1 moral aux vivants adverses).
      const aura = d.abilities.find((a) => a.id === 'aura');
      if (aura) auraMod += Number(aura.params?.['moraleMod'] ?? 0);
    }
  }
  const malus = Math.max(0, groups.size - 1);
  // Aura de bâtiment en siège (F-BUILDEFF.2, doc 03 §4 — Statue du Jugement) :
  // le camp défenseur (garnison) d'un combat de ville gagne le `combatMoraleBonus`
  // des bâtiments construits de la ville assiégée. Générique via `townBuildingAura`.
  let townMoraleAura = 0;
  if (stack.side === 'defender' && combat.townId) {
    const town = state.towns.find((t) => t.id === combat.townId);
    if (town?.ownerPlayerId)
      townMoraleAura = townBuildingAura(state, town.ownerPlayerId, town.pos, 'combatMoraleBonus');
  }
  // F-SCHOOLS (École de la Scène) : statuts de sort portant un moral ± (Chant de
  // Courage / Dissonance). Somme des statuts actifs de la pile — générique.
  const statusMoraleMod = stack.statuses.reduce((sum, s) => sum + (s.moraleMod ?? 0), 0);
  const raw =
    terrainBonus -
    malus +
    auraMod +
    statusMoraleMod +
    townMoraleAura +
    heroMoraleForSide(state, combat, stack.side);
  // `moraleImmune` (A3a, Ange) : immunité au moral NÉGATIF ⇒ plancher à 0.
  const floor = hasAbility(def, 'moraleImmune') ? 0 : -3;
  return clamp(raw, floor, 3);
}

export function otherSide(side: CombatSideId): CombatSideId {
  return side === 'attacker' ? 'defender' : 'attacker';
}

/**
 * Bonus de dégâts « élite » en combat de siège (F-BUILDEFF.5, doc 05 §3.2 —
 * Cercle Abîme) : le camp DÉFENSEUR (garnison du propriétaire de la ville
 * assiégée) voit ses piles de tier ≥ seuil frapper plus fort, via l'aura de
 * bâtiment `eliteDamagePct`. 0 hors siège / camp attaquant / tier sous le seuil.
 * Générique — aucune faction.
 */
export function siegeEliteDamage(
  state: GameState,
  combat: CombatState,
  side: CombatSideId,
  def: CombatUnitDef,
): number {
  if (side !== 'defender' || !combat.townId) return 0;
  const town = state.towns.find((t) => t.id === combat.townId);
  if (!town?.ownerPlayerId) return 0;
  return townEliteDamageBonus(state, town.ownerPlayerId, town.pos, def.tier ?? 0);
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

/**
 * Survivants d'un combat (retour de jeu 2026-07, écran de bilan) : effectifs
 * restants par camp et unité (piles `count > 0` agrégées par `unitId`). Permet à
 * l'UI d'afficher morts ET survivants ; combiné aux pertes, l'effectif initial se
 * reconstitue (`initial = survivants + pertes`). Aucun état persistant (lu à la
 * fin, comme `collectCasualties`).
 */
export function collectSurvivors(
  combat: CombatState,
): { side: CombatSideId; unitId: string; count: number }[] {
  const byKey: Record<string, number> = {};
  for (const s of combat.stacks) {
    if (s.count <= 0) continue;
    const key = `${s.side}:${s.unitId}`;
    byKey[key] = (byKey[key] ?? 0) + s.count;
  }
  return Object.entries(byKey).map(([key, count]) => {
    const sep = key.indexOf(':');
    return { side: key.slice(0, sep) as CombatSideId, unitId: key.slice(sep + 1), count };
  });
}

export type Rules = CombatRulesConfig;

/** Config de combat non-nulle — le moteur garantit `config` dès `StartGame`. */
export function combatRules(state: GameState): CombatRulesConfig {
  if (!state.config) throw new Error('config absente : la partie n’est pas démarrée');
  return state.config.combat;
}
