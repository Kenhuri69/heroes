import { describe, expect, it } from 'vitest';
import type { AppEvent } from './events';
import { hapticForEvent } from './haptics';
import type { SfxContext } from './audio';

/**
 * Mapping événement → motif de vibration (I15). Pur, réutilise le gating humain
 * de `sfxIdForEvent` : kill (`combat-death`) et confirmation (`ui-confirm`) seuls
 * vibrent, jamais un événement d'IA ni un événement neutre.
 */
const ctx: SfxContext = {
  humanId: 'p1',
  townOwner: (id) => (id === 'town-p1' ? 'p1' : 'ai'),
  heroPlayer: (id) => (id === 'hero-p1' ? 'p1' : 'ai'),
};

const ev = (e: Record<string, unknown>): AppEvent => e as unknown as AppEvent;

describe('hapticForEvent', () => {
  it('kill de pile ⇒ motif de vibration', () => {
    expect(hapticForEvent(ev({ type: 'StackDied', stackId: 's' }), ctx)).not.toBeNull();
  });

  it('confirmation du joueur humain ⇒ motif de vibration', () => {
    expect(
      hapticForEvent(ev({ type: 'TownBuilt', townId: 'town-p1', buildingId: 'fort', level: 1 }), ctx),
    ).not.toBeNull();
    expect(hapticForEvent(ev({ type: 'HeroLevelUp', heroId: 'hero-p1', level: 2 }), ctx)).not.toBeNull();
  });

  it('confirmation d’une IA ⇒ aucune vibration', () => {
    expect(
      hapticForEvent(ev({ type: 'TownBuilt', townId: 'town-ai', buildingId: 'fort', level: 1 }), ctx),
    ).toBeNull();
  });

  it('événement neutre (déplacement, semaine) ⇒ aucune vibration', () => {
    expect(hapticForEvent(ev({ type: 'MoveStepped', heroId: 'hero-p1', from: {}, to: {} }), ctx)).toBeNull();
    expect(hapticForEvent(ev({ type: 'WeekStarted', week: 2 }), ctx)).toBeNull();
  });
});
