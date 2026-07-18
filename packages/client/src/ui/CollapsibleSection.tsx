import { useState } from 'preact/hooks';
import './CollapsibleSection.css';

/**
 * Sections repliables du tiroir héros (lot 4c, E7 ; doc 08 §2.5). Chaque section
 * (armée / équipement / compétences / grimoire / quêtes) persiste son état
 * plié/déplié en `localStorage` sous `heroes.section.<id>`. **Présentation pure**
 * — hors `GameState`, pas de bump de save. Ouvertes par défaut (aucune perte de
 * contenu à la 1ʳᵉ ouverture ; le choix du joueur persiste).
 */
const KEY_PREFIX = 'heroes.section.';

function read(id: string, defaultCollapsed: boolean): boolean {
  try {
    const v = localStorage.getItem(KEY_PREFIX + id);
    return v === null ? defaultCollapsed : v === '1';
  } catch {
    return defaultCollapsed;
  }
}

function write(id: string, collapsed: boolean): void {
  try {
    localStorage.setItem(KEY_PREFIX + id, collapsed ? '1' : '0');
  } catch {
    /* stockage indisponible (navigation privée) — préférence en mémoire seule */
  }
}

/** État plié/déplié persisté d'une section. Renvoie `[collapsed, toggle]`. */
export function useCollapsed(id: string, defaultCollapsed = false): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => read(id, defaultCollapsed));
  const toggle = (): void => {
    setCollapsed((c) => {
      const next = !c;
      write(id, next);
      return next;
    });
  };
  return [collapsed, toggle];
}

/** En-tête cliquable d'une section repliable (titre + chevron, cible ≥ 44 px). */
export function SectionToggle({
  title,
  collapsed,
  onToggle,
  testId,
}: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      class="hero-section-toggle"
      data-testid={testId}
      aria-expanded={!collapsed}
      onClick={onToggle}
    >
      <span class="hero-section-toggle-label">{title}</span>
      <span class="hero-section-toggle-chevron" aria-hidden="true">
        {collapsed ? '▸' : '▾'}
      </span>
    </button>
  );
}
