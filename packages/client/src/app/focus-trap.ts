/**
 * Piège de focus des modales (LE-UX, doc 08 §4) — un seul module global au lieu
 * d'un hook dans chacune des ~25 modales :
 *  - Tab / Maj+Tab bouclent dans la modale du DESSUS (dernière
 *    `[role=dialog][aria-modal=true]` du DOM) ; le focus ne s'échappe plus dans
 *    le HUD derrière ;
 *  - à l'ouverture, le focus entre dans la modale (1ᵉʳ élément focalisable) ;
 *  - à la fermeture, il revient à l'élément qui l'avait avant.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function topDialog(): HTMLElement | null {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]');
  return dialogs.length > 0 ? dialogs[dialogs.length - 1]! : null;
}

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key !== 'Tab') return;
  const dialog = topDialog();
  if (!dialog) return;
  const items = focusables(dialog);
  if (items.length === 0) {
    e.preventDefault();
    return;
  }
  const first = items[0]!;
  const last = items[items.length - 1]!;
  const active = document.activeElement;
  const inside = active instanceof HTMLElement && dialog.contains(active);
  if (e.shiftKey && (!inside || active === first)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (!inside || active === last)) {
    e.preventDefault();
    first.focus();
  }
}

export function installFocusTrap(): void {
  document.addEventListener('keydown', onKeyDown, true);
  // Suit la modale du dessus : entrée du focus à l'ouverture, retour à la fermeture.
  const returnTo = new Map<HTMLElement, Element | null>();
  let current: HTMLElement | null = null;
  let scheduled = false;
  const sync = (): void => {
    scheduled = false;
    const dialog = topDialog();
    if (dialog === current) return;
    if (current && !current.isConnected) {
      const back = returnTo.get(current);
      returnTo.delete(current);
      if (back instanceof HTMLElement && back.isConnected && (!dialog || dialog.contains(back))) back.focus();
    }
    current = dialog;
    if (dialog && !returnTo.has(dialog)) {
      returnTo.set(dialog, document.activeElement);
      if (!dialog.contains(document.activeElement)) focusables(dialog)[0]?.focus();
    }
  };
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  }).observe(document.body, { childList: true, subtree: true });
}
