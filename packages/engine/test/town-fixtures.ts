import type { CombatUnitDef } from '../src/combat/types';
import type { BuildingDef, TownState } from '../src/town/types';
import { testCatalog } from './fixtures';

/**
 * Fixtures propres au lot H (town building) — ne modifient pas `fixtures.ts`
 * (fichier partagé, hors périmètre). Catalogue de bâtiments couvrant les
 * effets interprétés en 3.1 : `townHall` (revenu gradué), `fort` (bonus de
 * croissance gradué, avec un prérequis croisé sur `townHall` pour exercer
 * `requirementsNotMet`), `dwelling1` (débloque le recrutement de `red-grunt`).
 */
export function testBuildingCatalog(): Record<string, BuildingDef> {
  return {
    townHall: {
      id: 'townHall',
      maxLevel: 4,
      levels: [
        { cost: {}, requires: [], effect: { type: 'income', resource: 'gold', amount: 500 } },
        {
          cost: { gold: 2500 },
          requires: [],
          effect: { type: 'income', resource: 'gold', amount: 1000 },
        },
        {
          cost: { gold: 5000, gems: 5 },
          requires: [],
          effect: { type: 'income', resource: 'gold', amount: 2000 },
        },
        {
          cost: { gold: 10000, gems: 10, crystal: 10 },
          requires: [],
          effect: { type: 'income', resource: 'gold', amount: 4000 },
        },
      ],
    },
    fort: {
      id: 'fort',
      maxLevel: 3,
      levels: [
        { cost: { gold: 5000, ore: 20 }, requires: [], effect: { type: 'growthBonus', percent: 0 } },
        {
          cost: { gold: 10000, ore: 20 },
          // Prérequis croisé (pas d'auto-référence sur son propre niveau précédent,
          // déjà garanti par `currentLevel < maxLevel`) — exerce `requirementsNotMet`.
          requires: [{ building: 'townHall', level: 2 }],
          effect: { type: 'growthBonus', percent: 50 },
        },
        {
          cost: { gold: 20000, ore: 40 },
          requires: [{ building: 'townHall', level: 3 }],
          effect: { type: 'growthBonus', percent: 100 },
        },
      ],
    },
    dwelling1: {
      id: 'dwelling1',
      maxLevel: 1,
      levels: [
        {
          cost: { wood: 500 },
          requires: [],
          effect: { type: 'dwelling', tier: 1, unitId: 'red-grunt' },
        },
      ],
    },
  };
}

/**
 * Catalogue d'unités de test étendu avec les champs d'économie de ville
 * (`recruitCost`, `growthPerWeek`) — ABSENTS de `CombatUnitDef` figé (voir
 * `src/town/unit-economy.ts`). Ajoutés ici via un objet littéral additionnel,
 * lus par le moteur uniquement s'ils sont présents.
 */
export function testUnitCatalogWithEconomy(): Record<string, CombatUnitDef> {
  const base = testCatalog();
  const grunt = base['red-grunt'];
  if (!grunt) throw new Error('fixture red-grunt absente de testCatalog()');
  return {
    ...base,
    'red-grunt': {
      ...grunt,
      recruitCost: { gold: 50 },
      growthPerWeek: 6,
    } as CombatUnitDef,
  };
}

/** Ville de départ du joueur 'p1' : townHall niveau 1, fort niveau 1, dwelling1 construits. */
export function testTown(overrides: Partial<TownState> = {}): TownState {
  return {
    id: 'town-1',
    ownerPlayerId: 'p1',
    pos: { x: 5, y: 5 },
    factionId: 'fixture-faction',
    buildings: { townHall: 1, fort: 1, dwelling1: 1 },
    builtToday: false,
    garrison: [],
    stock: { 'red-grunt': 10 },
    ...overrides,
  };
}
