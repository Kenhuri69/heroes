import { appStore, useApp } from './store';

/**
 * Routeur d'écrans (doc 08 §3, lot UX U2) — source UNIQUE de navigation, lue par
 * le DOM (`shell.tsx`) et les scènes Pixi (`main.ts`). Remplace les bascules ad
 * hoc réparties entre `screen: 'menu'|'game'`, `townScreenOpen` et des
 * `useState` locaux (cause racine de CL1/CL2).
 *
 * Modèle : une route de BASE navigable (`menu`/`adventure`) + une pile de
 * modales typée. La scène de COMBAT n'est pas une route : elle est **dérivée**
 * de l'état moteur (`game.combat !== null`) pour rester en phase avec
 * l'auto-combat et le déterminisme — aucune désync route/état possible.
 *
 * Les overlays FORCÉS non annulables (`SkillChoice` à la montée de niveau,
 * `OutcomeOverlay` de fin de partie) restent dérivés de l'état moteur et vivent
 * HORS de cette pile : on ne peut pas les « fermer » par un retour arrière.
 */

export type Screen = 'menu' | 'adventure';

/** Modale empilable (doc 08 §3). */
export type Modal =
  | { kind: 'town'; townId: string }
  | { kind: 'options' }
  | { kind: 'journal' };

/** Plafond de profondeur de la pile de modales (doc 08 §3). */
export const MAX_MODAL_DEPTH = 2;

// --- Réducteurs purs (le cœur testable de la navigation) -------------------

/**
 * Empile une modale : un même `kind` ne s'empile jamais deux fois (ré-ouvre au
 * sommet), et la pile est plafonnée à `MAX_MODAL_DEPTH` (on abandonne la plus
 * ancienne au-delà).
 */
export function pushModal(stack: readonly Modal[], modal: Modal): Modal[] {
  const withoutSameKind = stack.filter((m) => m.kind !== modal.kind);
  return [...withoutSameKind, modal].slice(-MAX_MODAL_DEPTH);
}

/** Dépile la modale du sommet (no-op sur pile vide). */
export function popModal(stack: readonly Modal[]): Modal[] {
  return stack.slice(0, -1);
}

// --- API impérative (mute le store) ----------------------------------------

/** Change la route de base ; toute modale ouverte est refermée (nouvel écran). */
export function navigate(screen: Screen): void {
  appStore.setState({ screen, modals: [] });
}

/** Ouvre (ou ré-ouvre au sommet) une modale. */
export function openModal(modal: Modal): void {
  appStore.setState((s) => ({ modals: pushModal(s.modals, modal) }));
}

/** Ferme la modale du sommet. */
export function closeModal(): void {
  appStore.setState((s) => ({ modals: popModal(s.modals) }));
}

/** Ferme la modale d'un type donné où qu'elle soit dans la pile. */
export function closeModalKind(kind: Modal['kind']): void {
  appStore.setState((s) => ({ modals: s.modals.filter((m) => m.kind !== kind) }));
}

/**
 * Bouton retour Android / geste / Échap (doc 08 §3) : ferme la modale du dessus.
 * Retourne `true` si une modale a été fermée, `false` si la pile était vide
 * (le handler global peut alors laisser filer le geste).
 */
export function back(): boolean {
  const { modals } = appStore.getState();
  if (modals.length === 0) return false;
  appStore.setState({ modals: popModal(modals) });
  return true;
}

// --- Sélecteurs Preact ------------------------------------------------------

export function useScreen(): Screen {
  return useApp((s) => s.screen);
}

export function useModals(): readonly Modal[] {
  return useApp((s) => s.modals);
}

export function useTopModal(): Modal | null {
  return useApp((s) => s.modals[s.modals.length - 1] ?? null);
}
