import { beforeEach, describe, expect, it } from 'vitest';
import { EngineError } from '@heroes/engine';
import { appStore } from './store';
import { pushToastOnce } from '../ui/toasts';
import { reportArmyCommandError, reportCommandError } from './command-error';

/**
 * Lot R0 — « ne plus jamais échouer en silence » (doc 08 §3). Deux garanties
 * testées ici, sans navigateur (les toasts sont de l'état de store) :
 * 1. **anti-spam** : un même retour répété en rafale ne produit qu'UN toast ;
 * 2. **B6** : un rejet de `ReorderArmy`/`SplitStack` n'est plus avalé en bloc —
 *    seul « pas votre tour » (`notYourHero`) reste silencieux.
 */
beforeEach(() => {
  appStore.setState({ toasts: [] });
});

const toasts = (): { message: string; kind: string }[] =>
  appStore.getState().toasts.map((toast) => ({ message: toast.message, kind: toast.kind }));

describe('pushToastOnce — dédup anti-rafale', () => {
  it('trois appels identiques ⇒ un seul toast affiché', () => {
    pushToastOnce('Destination inaccessible', 'error');
    pushToastOnce('Destination inaccessible', 'error');
    pushToastOnce('Destination inaccessible', 'error');
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]).toEqual({ message: 'Destination inaccessible', kind: 'error' });
  });

  it('messages (ou kinds) différents ⇒ toasts distincts', () => {
    pushToastOnce('Destination inaccessible', 'error');
    pushToastOnce('Tour de l’adversaire en cours…');
    pushToastOnce('Destination inaccessible'); // même message, kind différent
    expect(toasts()).toHaveLength(3);
  });
});

describe('reportCommandError / reportArmyCommandError (B6)', () => {
  it('un rejet quelconque est surfacé en toast d’erreur', () => {
    reportCommandError(new Error('boom'));
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]?.kind).toBe('error');
  });

  it('réorg hors tour (`notYourHero`) ⇒ aucun toast (silence explicite, testé)', () => {
    reportArmyCommandError(
      new EngineError({ code: 'notYourHero', message: 'pas au joueur actif' }),
    );
    expect(toasts()).toHaveLength(0);
  });

  it('tout autre rejet de réorg/split ⇒ toast d’erreur (plus rien d’avalé)', () => {
    reportArmyCommandError(new EngineError({ code: 'invalidReorder', message: 'indices hors armée' }));
    expect(toasts()).toHaveLength(1);
    expect(toasts()[0]?.kind).toBe('error');
    // Erreur opaque (non moteur) : surfacée aussi.
    appStore.setState({ toasts: [] });
    reportArmyCommandError(new TypeError('undefined is not a function'));
    expect(toasts()).toHaveLength(1);
  });
});
