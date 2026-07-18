import type { GridPos } from '@heroes/engine';
import { appStore } from './store';
import { dispatch } from './dispatch';
import { commandErrorMessage } from './i18n';
import { pushToast } from '../ui/toasts';

/**
 * Invite de combat coopératif (E4.5, doc 18 E4) — un seul point de sortie, patron
 * `end-turn.ts`. Quand un déplacement va engager un gardien et qu'un héros allié
 * est adjacent, on demande confirmation avant de dispatcher `MoveHero` :
 * Oui ⇒ l'allié rejoint (`allyHeroId`), Non ⇒ combat solo, Annuler ⇒ pas de
 * déplacement. Le moteur revalide l'allié (invite caduque ⇒ solo).
 */
function move(heroId: string, path: GridPos[], allyHeroId?: string): void {
  void dispatch(
    allyHeroId ? { type: 'MoveHero', heroId, path, allyHeroId } : { type: 'MoveHero', heroId, path },
  ).catch((err: unknown) => pushToast(commandErrorMessage(err), 'error'));
}

export function requestCoopInvite(heroId: string, allyHeroId: string, allyName: string, path: GridPos[]): void {
  appStore.setState({ pendingCoopInvite: { heroId, allyHeroId, allyName, path } });
}

/** Oui : l'allié rejoint le combat. */
export function confirmCoopInvite(): void {
  const p = appStore.getState().pendingCoopInvite;
  if (!p) return;
  appStore.setState({ pendingCoopInvite: null });
  move(p.heroId, p.path, p.allyHeroId);
}

/** Non : le héros engage seul (déplacement quand même). */
export function declineCoopInvite(): void {
  const p = appStore.getState().pendingCoopInvite;
  if (!p) return;
  appStore.setState({ pendingCoopInvite: null });
  move(p.heroId, p.path);
}

/** Annuler : abandonne le déplacement (Échap / fond). */
export function cancelCoopInvite(): void {
  appStore.setState({ pendingCoopInvite: null });
}
