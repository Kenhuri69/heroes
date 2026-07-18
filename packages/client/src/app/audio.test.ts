import { describe, expect, it } from 'vitest';
import type { AppEvent } from './events';
import { sfxIdForEvent, type SfxContext } from './audio';

/**
 * Mapping événement moteur → SFX (Lot 9b). Fonction pure : le gating au joueur
 * humain et le choix d'id sont testés sans audio ni navigateur.
 */
const ctx: SfxContext = {
  humanId: 'p1',
  townOwner: (id) => (id === 'town-p1' ? 'p1' : 'ai'),
  heroPlayer: (id) => (id === 'hero-p1' ? 'p1' : 'ai'),
};

const ev = (e: Record<string, unknown>): AppEvent => e as unknown as AppEvent;

describe('sfxIdForEvent', () => {
  it('accomplissements du joueur humain ⇒ ui-confirm', () => {
    expect(sfxIdForEvent(ev({ type: 'TownBuilt', townId: 'town-p1', buildingId: 'fort', level: 1 }), ctx)).toBe(
      'ui-confirm',
    );
    expect(sfxIdForEvent(ev({ type: 'UnitsRecruited', townId: 'town-p1', unitId: 'u', count: 3 }), ctx)).toBe(
      'ui-confirm',
    );
    expect(
      sfxIdForEvent(ev({ type: 'UnitsUpgraded', townId: 'town-p1', fromUnitId: 'a', toUnitId: 'b', count: 2 }), ctx),
    ).toBe('ui-confirm');
    expect(sfxIdForEvent(ev({ type: 'HeroRecruited', playerId: 'p1', heroId: 'h', newHeroId: 'n' }), ctx)).toBe(
      'ui-confirm',
    );
    expect(sfxIdForEvent(ev({ type: 'HeroLevelUp', heroId: 'hero-p1', level: 2 }), ctx)).toBe('ui-confirm');
  });

  it('accomplissements d’un adversaire IA ⇒ aucun son', () => {
    expect(sfxIdForEvent(ev({ type: 'TownBuilt', townId: 'town-ai', buildingId: 'fort', level: 1 }), ctx)).toBeNull();
    expect(sfxIdForEvent(ev({ type: 'HeroRecruited', playerId: 'ai', heroId: 'h', newHeroId: 'n' }), ctx)).toBeNull();
    expect(sfxIdForEvent(ev({ type: 'HeroLevelUp', heroId: 'hero-ai', level: 2 }), ctx)).toBeNull();
  });

  it('SFX de combat existants préservés (non gardés au joueur)', () => {
    expect(sfxIdForEvent(ev({ type: 'StackAttacked', attackerId: 'a', targetId: 'b', ranged: true }), ctx)).toBe(
      'combat-shoot',
    );
    expect(sfxIdForEvent(ev({ type: 'StackAttacked', attackerId: 'a', targetId: 'b', ranged: false }), ctx)).toBe(
      'combat-hit',
    );
    expect(sfxIdForEvent(ev({ type: 'StackDied', stackId: 's' }), ctx)).toBe('combat-death');
  });

  it('événement sans SFX ⇒ null', () => {
    expect(sfxIdForEvent(ev({ type: 'WeekStarted', week: 2 }), ctx)).toBeNull();
  });
});
