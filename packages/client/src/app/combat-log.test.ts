import { describe, expect, it } from 'vitest';
import type { AppEvent } from './events';
import { combatLogText } from './combat-log';

/**
 * Journal de combat (S2 siège) : ligne dédiée au bombardement du rempart par la
 * catapulte — « frappe » quand le segment tient, « s'effondre » quand il tombe.
 * Le rendu i18n est trivial ; on teste le mapping événement → clé (hit/destroyed).
 */
const ev = (e: Record<string, unknown>): AppEvent => e as unknown as AppEvent;

describe('combatLogText — WallBombarded (S2)', () => {
  // `t()` non initialisé en unitaire ⇒ renvoie la clé : les regex acceptent la clé
  // OU le texte résolu (robustes des deux côtés).
  it('mur touché mais debout ⇒ ligne « frappe »', () => {
    const line = combatLogText(ev({ type: 'WallBombarded', col: 5, row: 4, destroyed: false }));
    expect(line).toBeTruthy();
    expect(line).toMatch(/wallHit|catapulte|catapult|frappe|strike/i);
  });

  it('segment détruit ⇒ ligne « s’effondre » (distincte du simple coup)', () => {
    const hit = combatLogText(ev({ type: 'WallBombarded', col: 5, row: 4, destroyed: false }));
    const gone = combatLogText(ev({ type: 'WallBombarded', col: 5, row: 4, destroyed: true }));
    expect(gone).toBeTruthy();
    expect(gone).not.toBe(hit); // les deux états produisent des lignes différentes
    expect(gone).toMatch(/wallDestroyed|effondre|collapse/i);
  });

  it('événement sans ligne ⇒ null (ex. round non concerné)', () => {
    expect(combatLogText(ev({ type: 'StackTransformed', stackId: 's' }))).toBeNull();
  });
});
