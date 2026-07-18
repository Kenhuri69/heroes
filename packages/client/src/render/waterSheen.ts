import { Container, Graphics } from 'pixi.js';
import type { AdventureMapDef } from '@heroes/engine';
import { isoDiamond } from './projection';

/**
 * Eau vivante (I12, Lot 8.2) : un voile clair posé sur les tuiles d'eau dont
 * l'**alpha** oscille lentement (respiration de la surface), **sans
 * re-tesselation** — la géométrie est construite une seule fois, l'animation ne
 * touche qu'une propriété `alpha` (coût O(1)/frame). Coupé en reduce-motion.
 */
const SHEEN_COLOR = 0x7fc2df; // reflet clair (écume/ciel sur l'eau)
const SHEEN_MAX_ALPHA = 0.1; // discret : ne délave pas la texture d'eau
const SHEEN_PERIOD_S = 6; // cycle lent (respiration)

/** Amplitude/compteur courant du miroitement — hook de test headless. */
export const waterSheenStats = { alpha: 0 };

/**
 * Voile de miroitement (losange iso par tuile d'eau), `alpha=0` au repos.
 * Invisible si la carte n'a aucune eau. À placer AU-DESSUS de la tuile et SOUS
 * les entités/brouillard.
 */
export function buildWaterSheen(map: AdventureMapDef): Container {
  const g = new Graphics();
  let hasWater = false;
  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const terrain = map.terrain[ty * map.width + tx];
      if (terrain === 'water' || terrain === 'river') {
        g.poly(isoDiamond(tx, ty)).fill(SHEEN_COLOR);
        hasWater = true;
      }
    }
  }
  const container = new Container();
  container.eventMode = 'none'; // purement décoratif
  container.alpha = 0;
  container.visible = hasWater;
  container.addChild(g);
  // Anti-gel : la géométrie du voile est STATIQUE ⇒ on la cuit en une texture
  // (un seul blit alpha/frame au lieu de N remplissages de losanges — marge ×4
  // préservée). Sûr ici : le voile n'existe que sur une carte aplatie (extent iso
  // borné < taille de texture max, cf. `Tilemap.flattened`).
  if (hasWater) container.cacheAsTexture(true);
  return container;
}

/**
 * Alpha du miroitement au temps `timeSec` (secondes) : sinus lent borné
 * `[0, SHEEN_MAX_ALPHA]`. 0 en reduce-motion (surface figée). Pur → testable.
 */
export function waterSheenAlpha(timeSec: number, reduced: boolean): number {
  if (reduced) return 0;
  const osc = (Math.sin((timeSec * Math.PI * 2) / SHEEN_PERIOD_S) + 1) / 2; // 0..1
  return osc * SHEEN_MAX_ALPHA;
}
