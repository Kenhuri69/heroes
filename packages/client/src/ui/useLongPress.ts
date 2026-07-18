import { useRef } from 'preact/hooks';

const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE = 10;

/**
 * Appui long DOM (parité tactile doc 08 §1.1) : un pointeur maintenu ~450 ms sans
 * bouger déclenche `onLong` — l'équivalent tactile du survol souris. Annulé par un
 * déplacement (scroll/pan) ou une relâche anticipée (qui redevient un tap normal).
 * Après un appui long, le clic suivant est neutralisé (`onClickCapture`) pour ne
 * pas déclencher aussi l'action de tap. Renvoie des gestionnaires à étaler sur
 * l'élément (souris ET tactile via Pointer Events). Partagé (TownScreen, TurnBar…).
 */
export function useLongPress(onLong: () => void): {
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onClickCapture: (e: Event) => void;
  /** Lit-et-consomme « un appui long vient de se produire » — à appeler EN TÊTE du
   *  `onClick` d'action pour l'ignorer (robuste quel que soit l'ordre des listeners,
   *  contrairement à `onClickCapture` sur le même élément). */
  wasLongPress: () => boolean;
} {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const clear = (): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    onPointerDown: (e) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = setTimeout(() => {
        timer.current = null;
        fired.current = true;
        onLong();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e) => {
      if (
        timer.current !== null &&
        Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > LONG_PRESS_MOVE
      )
        clear();
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onClickCapture: (e) => {
      if (fired.current) {
        e.preventDefault();
        e.stopPropagation();
        fired.current = false;
      }
    },
    wasLongPress: () => {
      const f = fired.current;
      fired.current = false;
      return f;
    },
  };
}
