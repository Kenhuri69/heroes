/**
 * Mini-store scène → UI (doc 08 §2.4) : la scène de combat écrit la
 * prévisualisation de dégâts OBLIGATOIRE courante, `CombatUi` la lit via
 * `useSyncExternalStore` (même pattern que `app/events.ts`).
 */
export interface DamagePreview {
  attackerId: string;
  targetId: string;
  damageMin: number;
  damageMax: number;
  killsMin: number;
  killsMax: number;
  /** Riposte estimée après la frappe — null si la cible ne ripostera pas. */
  retaliation: { damageMin: number; damageMax: number } | null;
}

type Listener = () => void;

let current: DamagePreview | null = null;
const listeners = new Set<Listener>();

export const combatPreview = {
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  set(p: DamagePreview | null): void {
    current = p;
    for (const l of listeners) l();
  },
  get(): DamagePreview | null {
    return current;
  },
};
