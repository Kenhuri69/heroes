import { Container, Graphics, Point } from 'pixi.js';
import type { SpellKind } from '@heroes/engine';

/**
 * FX de combat **purement présentation** (sprint 1, B6, doc 18 §2.B) : projectiles
 * de tir et retours visuels de sorts. Aucun état moteur touché ; consommé depuis
 * la file d'animations de `CombatScene` (jamais en parallèle sauvage). Déterministe
 * (aucun `Math.random` — les variations sont géométriques), objets transitoires
 * auto-détruits (patron `spawnFloatingLabel`), `prefers-reduced-motion` respecté.
 */

/** Compteur de FX émis — hook de test headless (smoke « projectile visible »). */
export const combatFxStats = { projectiles: 0, impacts: 0 };

/**
 * Amplitude max courante (px) de l'oscillation idle des jetons (I2) — hook de
 * test headless (« les jetons respirent, coupé en reduce-motion »). Mis à jour
 * par la boucle `ticker` de `CombatScene` ; 0 tant qu'aucun jeton ne bouge.
 */
export const combatIdleStats = { bob: 0 };

/**
 * Nombre de micro-secousses du plateau émises (I5, kill de pile entière) — hook
 * de test headless. Incrémenté par `CombatScene.shakeBoard`.
 */
export const combatShakeStats = { count: 0 };

const MS_PER_PX = 0.6; // vitesse de vol du projectile
const MIN_FLIGHT_MS = 90;
const MAX_FLIGHT_MS = 350; // plafond : n'allonge pas les combats auto
const IMPACT_MS = 280;

function fxTween(durationMs: number, onProgress: (t: number) => void): Promise<void> {
  if (durationMs <= 0) {
    onProgress(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (): void => {
      const t = Math.min(1, (performance.now() - start) / durationMs);
      onProgress(t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    step();
  });
}

/**
 * Projectile de tir : trait lumineux étiré volant `from`→`to` (léger arc
 * quadratique au-delà de ~4 hexes, façon boulet). `reduced` ⇒ résolution
 * immédiate (aucun vol animé, l'impact suit quand même côté appelant).
 */
export async function spawnProjectile(
  layer: Container,
  from: Point,
  to: Point,
  opts: { speed: number; reduced: boolean },
): Promise<void> {
  combatFxStats.projectiles += 1;
  if (opts.reduced) return; // a11y : pas de vol animé
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const arc = dist > 96 ? Math.min(40, dist * 0.12) : 0; // arc si distance > ~4 hexes
  const duration = Math.min(MAX_FLIGHT_MS, Math.max(MIN_FLIGHT_MS, dist * MS_PER_PX)) / Math.max(1, opts.speed);
  const g = new Graphics();
  layer.addChild(g);
  await fxTween(duration, (t) => {
    if (g.destroyed) return;
    const headX = from.x + dx * t;
    const headY = from.y + dy * t - arc * Math.sin(Math.PI * t);
    const tailT = Math.max(0, t - 0.15);
    const tailX = from.x + dx * tailT;
    const tailY = from.y + dy * tailT - arc * Math.sin(Math.PI * tailT);
    g.clear();
    g.moveTo(tailX, tailY).lineTo(headX, headY).stroke({ width: 3, color: 0xffe08a, alpha: 0.85 });
    g.circle(headX, headY, 3.5).fill({ color: 0xfff3cf });
  });
  if (!g.destroyed) g.destroy();
}

type FxFamily = 'damage' | 'heal' | 'buff' | 'debuff';

/** Réduit les ~15 `SpellKind` à 4 familles visuelles distinctes. */
function fxFamily(kind: SpellKind): FxFamily {
  switch (kind) {
    case 'heal':
    case 'cure':
    case 'resurrectFull':
      return 'heal';
    case 'buff':
    case 'rally':
    case 'stealth':
    case 'dispel':
    case 'summon':
      return 'buff';
    case 'debuff':
    case 'silence':
    case 'banish':
    case 'applyMarks':
      return 'debuff';
    default:
      return 'damage'; // dégâts + repli
  }
}

const FAMILY_COLOR: Record<FxFamily, number> = {
  damage: 0xff7a3c,
  heal: 0x6fe08a,
  buff: 0x8fd3ff,
  debuff: 0xb07de0,
};

/**
 * Retour visuel d'un sort sur la cible, DISTINCT de la frappe physique :
 * `damage` = onde circulaire expansive + flash ; `heal` = étincelles montantes ;
 * `buff` = halo bref ascendant ; `debuff` = halo bref descendant sombre.
 * Procédural (zéro asset), transitoire auto-détruit. `reduced` ⇒ aucun FX animé.
 */
export async function spawnSpellImpact(
  layer: Container,
  at: Point,
  kind: SpellKind,
  opts: { speed: number; reduced: boolean },
): Promise<void> {
  combatFxStats.impacts += 1;
  if (opts.reduced) return;
  const family = fxFamily(kind);
  const color = FAMILY_COLOR[family];
  const g = new Graphics();
  g.position.set(at.x, at.y);
  layer.addChild(g);
  await fxTween(IMPACT_MS / Math.max(1, opts.speed), (t) => {
    if (g.destroyed) return;
    g.clear();
    const alpha = 1 - t;
    if (family === 'damage') {
      g.circle(0, 0, 6 + 34 * t).stroke({ width: 3, color, alpha });
      if (t < 0.3) g.circle(0, 0, 10).fill({ color: 0xffffff, alpha: (0.3 - t) * 2 });
    } else if (family === 'heal') {
      for (let i = 0; i < 4; i++) {
        const ox = (i - 1.5) * 9;
        const oy = -30 * t - (i % 2) * 6;
        g.circle(ox, oy, 2.6).fill({ color, alpha });
      }
    } else {
      // buff monte, debuff descend : anneau qui glisse verticalement.
      const dir = family === 'buff' ? -1 : 1;
      g.circle(0, dir * 22 * t, 16 - 6 * t).stroke({ width: 3, color, alpha });
    }
  });
  if (!g.destroyed) g.destroy();
}
