import { useMemo } from 'preact/hooks';
import { t } from '../app/i18n';
import './FactionBadge.css';

/**
 * Motifs/emblèmes de bannière de faction (doc 08 §4, plan phase-3.6 lot V) :
 * distinction NON chromatique (daltoniens) — chaque faction porte un motif
 * géométrique en plus de sa couleur. Dérivés déterministes de `factionId`
 * par hachage, aucun asset externe, aucune faction connue en dur ici (le
 * moteur/contenu ne sont jamais consultés).
 */
const PATTERNS = ['stripes', 'checker', 'diamonds', 'dots'] as const;
type FactionPattern = (typeof PATTERNS)[number];

/** Petite palette de couleurs lisibles sur fond sombre — la couleur ne fait
 * que compléter le motif, jamais le seul signal (doc 08 §4). */
const COLORS = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#c9971f', '#16a085', '#d35400', '#546e7a'];

/** FNV-1a — hachage déterministe simple, stable d'une session à l'autre. */
function hashFactionId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function patternFor(id: string): FactionPattern {
  // Index toujours dans [0, PATTERNS.length) — modulo garanti par le hachage.
  return PATTERNS[hashFactionId(id) % PATTERNS.length] ?? 'stripes';
}

function colorFor(id: string): string {
  // Index toujours dans [0, COLORS.length) — modulo garanti par le hachage.
  return COLORS[Math.floor(hashFactionId(id) / PATTERNS.length) % COLORS.length] ?? '#546e7a';
}

/**
 * Badge de faction réutilisable : prend un `factionId` opaque (aucun littéral
 * de nom de faction) et rend un motif + couleur déterministes en SVG inline.
 * Utilisé au minimum dans l'en-tête de l'écran de ville (doc 08 §2.2).
 */
export function FactionBadge({ factionId }: { factionId: string }) {
  const pattern = useMemo(() => patternFor(factionId), [factionId]);
  const color = useMemo(() => colorFor(factionId), [factionId]);

  return (
    <span
      class="faction-badge"
      role="img"
      aria-label={t('faction.badge', { id: factionId })}
      data-testid="faction-badge"
      data-pattern={pattern}
    >
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="1.5" y="1.5" width="29" height="29" rx="7" fill={color} stroke="#e8e2d0" stroke-width="1.5" />
        <PatternMark pattern={pattern} />
      </svg>
    </span>
  );
}

function PatternMark({ pattern }: { pattern: FactionPattern }) {
  switch (pattern) {
    case 'stripes':
      return (
        <g stroke="#f5f3ec" stroke-width="3.2" stroke-linecap="round" opacity="0.9">
          <line x1="5" y1="25" x2="13" y2="6" />
          <line x1="13" y1="27" x2="21" y2="6" />
          <line x1="21" y1="27" x2="27" y2="12" />
        </g>
      );
    case 'checker':
      return (
        <g fill="#f5f3ec" opacity="0.9">
          <rect x="5" y="5" width="9.5" height="9.5" />
          <rect x="17.5" y="17.5" width="9.5" height="9.5" />
        </g>
      );
    case 'diamonds':
      return (
        <g fill="#f5f3ec" opacity="0.9">
          <rect x="10.5" y="4.5" width="10" height="10" transform="rotate(45 15.5 9.5)" />
          <rect x="10.5" y="17.5" width="10" height="10" transform="rotate(45 15.5 22.5)" />
        </g>
      );
    case 'dots':
      return (
        <g fill="#f5f3ec" opacity="0.9">
          <circle cx="9" cy="9" r="2.6" />
          <circle cx="23" cy="9" r="2.6" />
          <circle cx="9" cy="23" r="2.6" />
          <circle cx="23" cy="23" r="2.6" />
          <circle cx="16" cy="16" r="2.6" />
        </g>
      );
    default:
      return null;
  }
}
