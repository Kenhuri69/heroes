import type { HeroProgressionConfig } from './config';
import type { Draft } from '../combat/draft';
import type { GameEvent } from '../core/events';
import { rollRange } from '../core/rng';
import type { HeroAttributes } from '../core/state';

/**
 * Progression du héros (doc 02 §1.2 + décisions plan phase-2.5) : XP gagnée
 * en combat d'aventure, montées de niveau en chaîne (cap `maxLevel`), +1
 * attribut pondéré au RNG de l'état à chaque niveau.
 */

/** Ordre stable de tirage des attributs (déterminisme des replays). */
const ATTRIBUTE_ORDER: readonly (keyof HeroAttributes)[] = [
  'attack',
  'defense',
  'power',
  'knowledge',
];

/** XP cumulée requise pour ATTEINDRE `level` — xp(1) = 0 (niveau de départ). */
export function xpForLevel(config: HeroProgressionConfig, level: number): number {
  if (level <= 1) return 0;
  return Math.round(config.levelCurve.base * level ** config.levelCurve.exponent);
}

/** Tire un attribut au RNG de l'état, pondéré par `weights` (doc 02 §1.2). */
function rollAttribute(
  draft: Draft,
  weights: HeroProgressionConfig['attributeWeights'],
): keyof HeroAttributes {
  const total = ATTRIBUTE_ORDER.reduce((sum, id) => sum + weights[id], 0);
  const roll = rollRange(draft.rng, 0, Math.max(0, total - 1));
  draft.rng = roll.state;
  let acc = 0;
  for (const id of ATTRIBUTE_ORDER) {
    acc += weights[id];
    if (roll.value < acc) return id;
  }
  return ATTRIBUTE_ORDER[ATTRIBUTE_ORDER.length - 1] as keyof HeroAttributes;
}

/**
 * Attribue `amount` XP au héros `heroId` : cumul, montées en chaîne (cap
 * `config.hero.maxLevel`, l'XP continue de s'accumuler au cap sans monter),
 * +1 attribut pondéré par niveau gagné. Émet `XpGained` une fois (montant
 * total + xp cumulée) puis un `HeroLevelUp` par niveau franchi. No-op si le
 * héros est introuvable, `amount` ≤ 0 ou la config d'aventure est absente.
 */
export function grantXp(
  draft: Draft,
  events: GameEvent[],
  heroId: string,
  amount: number,
): void {
  if (amount <= 0) return;
  const config = draft.config?.hero;
  if (!config) return;
  const hero = draft.heroes.find((h) => h.id === heroId);
  if (!hero) return;
  hero.xp += amount;
  events.push({ type: 'XpGained', heroId, amount, xp: hero.xp });
  while (hero.level < config.maxLevel && hero.xp >= xpForLevel(config, hero.level + 1)) {
    hero.level += 1;
    const attribute = rollAttribute(draft, config.attributeWeights);
    hero.attributes[attribute] += 1;
    events.push({ type: 'HeroLevelUp', heroId, level: hero.level, attribute });
  }
}
