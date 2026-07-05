import { describe, expect, it } from 'vitest';
import {
  buildStatus,
  builtDwellings,
  exclusiveRivalId,
  missingRequirements,
  scaleCost,
} from '../src/town';
import type { BuildingDef, TownState } from '../src/town/types';
import { testBuildingCatalog, testTown } from './town-fixtures';

// Helpers purs exposés au client (remédiation CL9) : testés directement, sans
// passer par une commande. Ils encodent les mêmes règles que
// `validateBuildStructure` (prérequis, choix exclusif) et le catalogue.

describe('town helpers (CL9)', () => {
  const catalog = testBuildingCatalog();
  const town = testTown(); // townHall:1, fort:1, dwelling1:1

  describe('buildStatus', () => {
    it('« built » quand le bâtiment est à son niveau max', () => {
      expect(buildStatus(town, catalog, 'dwelling1')).toBe('built'); // maxLevel 1
    });

    it('« available » quand le niveau suivant est constructible', () => {
      expect(buildStatus(town, catalog, 'townHall')).toBe('available'); // 1 < 4, sans prérequis
    });

    it('« locked » quand un prérequis manque', () => {
      // fort niveau 2 exige townHall@2, la ville n'a townHall qu'au niveau 1.
      expect(buildStatus(town, catalog, 'fort')).toBe('locked');
    });

    it('« built » pour un bâtiment inconnu du catalogue', () => {
      expect(buildStatus(town, catalog, 'inconnu')).toBe('built');
    });

    it('« locked » quand un rival exclusif est déjà bâti', () => {
      const exclusiveCatalog: Record<string, BuildingDef> = {
        circleA: {
          id: 'circleA',
          maxLevel: 1,
          exclusiveGroup: 'circles',
          levels: [{ cost: {}, requires: [], effect: { type: 'growthBonus', percent: 0 } }],
        },
        circleB: {
          id: 'circleB',
          maxLevel: 1,
          exclusiveGroup: 'circles',
          levels: [{ cost: {}, requires: [], effect: { type: 'growthBonus', percent: 0 } }],
        },
      };
      const withCircleA: TownState = testTown({ buildings: { circleA: 1 } });
      expect(buildStatus(withCircleA, exclusiveCatalog, 'circleB')).toBe('locked');
      expect(exclusiveRivalId(withCircleA, exclusiveCatalog, 'circleB')).toBe('circleA');
    });
  });

  describe('missingRequirements', () => {
    it('liste les prérequis non satisfaits', () => {
      expect(missingRequirements(town, catalog, 'fort')).toEqual([{ building: 'townHall', level: 2 }]);
    });

    it('vide quand tous les prérequis sont satisfaits', () => {
      expect(missingRequirements(town, catalog, 'townHall')).toEqual([]);
    });

    it('vide pour un bâtiment au niveau max', () => {
      expect(missingRequirements(town, catalog, 'dwelling1')).toEqual([]);
    });
  });

  describe('builtDwellings', () => {
    it('renvoie les unitId débloqués par les dwellings construits', () => {
      expect(builtDwellings(town, catalog)).toEqual(['red-grunt']);
    });

    it('vide si aucun dwelling construit', () => {
      const noDwelling = testTown({ buildings: { townHall: 1 } });
      expect(builtDwellings(noDwelling, catalog)).toEqual([]);
    });
  });

  describe('scaleCost', () => {
    it('multiplie chaque coût par l’effectif', () => {
      expect(scaleCost({ gold: 50, wood: 2 }, 3)).toEqual({ gold: 150, wood: 6 });
    });

    it('omet les montants nuls (pas de clé à 0)', () => {
      expect(scaleCost({ gold: 50, wood: 0 }, 2)).toEqual({ gold: 100 });
    });
  });
});
