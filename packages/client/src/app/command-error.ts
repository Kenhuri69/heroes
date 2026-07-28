import { EngineError } from '@heroes/engine';
import { pushToastOnce } from '../ui/toasts';
import { commandErrorMessage } from './i18n';

/**
 * Lot R0 (« ne plus jamais échouer en silence », doc 08 §3) : surface un rejet de
 * commande en toast d'erreur **dédupliqué** — pour les chemins déclenchables en
 * rafale (fin de tour re-cliquée, tap répété). Les chemins non répétables gardent
 * le patron direct `pushToast(commandErrorMessage(err), 'error')`.
 */
export function reportCommandError(err: unknown): void {
  pushToastOnce(commandErrorMessage(err), 'error');
}

/**
 * Variante « armée » (B6) pour `ReorderArmy` / `SplitStack` : un rejet
 * `notYourHero` (= ce n'est pas le tour de ce joueur) reste **silencieux** — il
 * est sans conséquence et survient au simple appui pendant un tour adverse. Tout
 * autre rejet (indices invalides, pile introuvable, erreur opaque) est surfacé,
 * au lieu du `catch` fourre-tout qui avalait tout.
 */
export function reportArmyCommandError(err: unknown): void {
  if (err instanceof EngineError && err.detail.code === 'notYourHero') return;
  reportCommandError(err);
}
