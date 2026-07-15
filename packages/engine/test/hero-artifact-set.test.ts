import { describe, expect, it } from 'vitest';
import { heroArtifactBonus } from '../src/hero/artifacts';
import type { ArtifactDef } from '../src/hero/types';
import type { HeroState } from '../src/core/state';

/**
 * H-ARTEQUIP — panoplies (sets à seuils) : équiper `pieces` membres d'une même
 * panoplie accorde `set.bonus` UNE fois, en plus des bonus individuels. Générique
 * (chaque membre porte le même descripteur), zéro faction, dérivé de l'équipement.
 */

const SET = { id: 'panoplie-test', pieces: 2, bonus: { attack: 1, defense: 1, morale: 1 } };
const CAT: Record<string, ArtifactDef> = {
  lame: { id: 'lame', bonus: { attack: 2 }, slot: 'weapon', set: SET },
  egide: { id: 'egide', bonus: { defense: 2 }, slot: 'shield', set: SET },
  orbe: { id: 'orbe', bonus: { knowledge: 2 }, slot: 'neck' }, // hors panoplie
};

function heroWith(equipped: (string | null)[]): HeroState {
  const arts = Array.from({ length: 10 }, () => null) as (string | null)[];
  equipped.forEach((id, i) => (arts[i] = id));
  return {
    id: 'h', playerId: 'p1', pos: { x: 0, y: 0 }, movementPoints: 0, army: [], xp: 0, level: 1,
    attributes: { attack: 0, defense: 0, power: 0, knowledge: 0 }, mana: 0, manaMax: 0, skills: {},
    visitLuck: 0, visitMorale: 0, spells: [], artifacts: arts, backpack: [], pendingSkillChoices: [],
    pendingAttributeChoices: [], factionId: '', houseId: '', houseEffects: [], name: '', specialtyId: '',
    specialtyEffects: [], warMachines: [], rosterId: '',
  };
}

describe('H-ARTEQUIP — panoplies (set bonus)', () => {
  it('accorde le bonus de panoplie au seuil atteint (en plus des bonus individuels)', () => {
    const b = heroArtifactBonus(heroWith(['lame', 'egide']), CAT);
    expect(b.attack).toBe(3); // 2 (lame) + 1 (panoplie)
    expect(b.defense).toBe(3); // 2 (égide) + 1 (panoplie)
    expect(b.morale).toBe(1); // 1 (panoplie)
  });

  it('n’accorde PAS le bonus de panoplie sous le seuil', () => {
    const b = heroArtifactBonus(heroWith(['lame']), CAT);
    expect(b.attack).toBe(2); // 2 (lame) seul, pas de bonus de panoplie
    expect(b.defense).toBe(0);
    expect(b.morale).toBe(0);
  });

  it('n’accorde le bonus de panoplie qu’UNE fois même avec des pièces en surplus', () => {
    // 3ᵉ copie de la lame (même panoplie) : effectif 3 ≥ seuil 2, bonus toujours ×1.
    const b = heroArtifactBonus(heroWith(['lame', 'egide', 'lame']), CAT);
    expect(b.morale).toBe(1); // panoplie comptée une seule fois
  });
});
