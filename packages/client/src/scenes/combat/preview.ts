/**
 * Mini-store scène → UI (doc 08 §2.4) : la scène de combat écrit la
 * prévisualisation de dégâts OBLIGATOIRE courante, `CombatUi` la lit via
 * `useSyncExternalStore` (même pattern que `app/events.ts`).
 */
export interface DamagePreview {
  kind?: 'attack';
  attackerId: string;
  targetId: string;
  damageMin: number;
  damageMax: number;
  killsMin: number;
  killsMax: number;
  /** Riposte estimée après la frappe — null si la cible ne ripostera pas. */
  retaliation: { damageMin: number; damageMax: number } | null;
}

/**
 * S3.3 : prévisualisation d'un déplacement DANS la douve — annonce les dégâts de
 * fossé (`combat.moatDamage`) avant que le joueur ne confirme la destination.
 * Aucune règle nouvelle : simple lecture de l'état.
 */
export interface MoatMovePreview {
  kind: 'moat';
  damage: number;
}

export type CombatPreview = DamagePreview | MoatMovePreview;

type Listener = () => void;

let current: CombatPreview | null = null;
const listeners = new Set<Listener>();

export const combatPreview = {
  subscribe(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  set(p: CombatPreview | null): void {
    current = p;
    for (const l of listeners) l();
  },
  get(): CombatPreview | null {
    return current;
  },
};
