import { describe, expect, it } from 'vitest';
import { CURRENT_SAVE_VERSION, createEmptyState, type HeroState } from '../src/core/state';
import type { CombatStack } from '../src/combat/types';

/**
 * B8 — garde de FORME de l'état sauvegardé (plan de remédiation §2). La garde de
 * version a déjà été contournée deux fois (champ requis ajouté sans bump ⇒ NaN
 * démontrable sur une vieille save). Ce test verrouille la forme :
 *
 *   TOUTE modification de la forme de `GameState` / `HeroState` / `CombatStack`
 *   (champ ajouté, retiré, renommé) casse ce test. Le corriger EXIGE de :
 *     1. bumper `CURRENT_SAVE_VERSION` (`core/state.ts`) si la forme sérialisée
 *        change réellement (et de mettre à jour la doc 07 §4) ;
 *     2. mettre à jour les listes de clés ci-dessous.
 *
 * Top-level : vérifié au runtime (clés de `createEmptyState`). Types imbriqués
 * (Hero/CombatStack, tous deux déjà contournés) : vérifiés à la COMPILATION via
 * un `Exact<keyof …>` — un champ ajouté fait échouer `tsc`.
 */

type Exact<A extends string, B extends string> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;

// Unions attendues des clés des types imbriqués. Un champ ajouté/retiré fait
// diverger `keyof …` de ces unions.
type HeroKey =
  | 'id'
  | 'playerId'
  | 'pos'
  | 'movementPoints'
  | 'army'
  | 'xp'
  | 'level'
  | 'attributes'
  | 'mana'
  | 'manaMax'
  | 'skills'
  | 'visitLuck'
  | 'visitMorale'
  | 'spells'
  | 'artifacts'
  | 'backpack'
  | 'pendingSkillChoices'
  | 'pendingAttributeChoices'
  | 'name'
  | 'factionId'
  | 'houseId'
  | 'houseEffects'
  | 'specialtyId'
  | 'specialtyEffects'
  | 'warMachines'
  | 'rosterId'
  | 'archetypeEffects';

type StackKey =
  | 'id'
  | 'side'
  | 'slot'
  | 'unitId'
  | 'count'
  | 'firstHp'
  | 'pos'
  | 'retaliationsLeft'
  | 'waited'
  | 'defending'
  | 'ammo'
  | 'spellCharges'
  | 'marks'
  | 'immobilizedRounds'
  | 'transformed'
  | 'symbiosisStacks'
  | 'acted'
  | 'stealthed'
  | 'statuses';

// Gardes à la COMPILATION : `true` seulement si l'union des clés du type est
// EXACTEMENT celle listée. Un champ ajouté à HeroState/CombatStack ⇒ `false` ⇒
// `tsc` échoue ici (rappel : bumper CURRENT_SAVE_VERSION).
const _heroExact: Exact<keyof HeroState, HeroKey> = true;
const _stackExact: Exact<keyof CombatStack, StackKey> = true;
void _heroExact;
void _stackExact;

describe('B8 — forme de sauvegarde verrouillée', () => {
  it('CURRENT_SAVE_VERSION correspond à la forme documentée (doc 07 §4)', () => {
    expect(CURRENT_SAVE_VERSION).toBe(33);
  });

  it('clés top-level de GameState (createEmptyState) inchangées', () => {
    expect(Object.keys(createEmptyState()).sort()).toEqual(
      [
        'saveVersion',
        'started',
        'rng',
        'calendar',
        'players',
        'currentPlayer',
        'config',
        'map',
        'heroes',
        'unitCatalog',
        'buildingCatalog',
        'spellCatalog',
        'skillCatalog',
        'artifactCatalog',
        'towns',
        'caravans',
        'combat',
        'factionCatalog',
        'houseCatalog',
        'heroRoster',
        'growthGroups',
        'scenario',
        'outcome',
        'pendingTreasure',
        'quests',
      ].sort(),
    );
  });
});
