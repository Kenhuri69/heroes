import type { HeroState } from '../core/state';
import type { ArtifactDef } from './types';

/**
 * Artefacts (doc 02 §1.1, doc 08 §2.3, décision plan phase-3.2 #9) : bonus
 * déclaratifs cumulatifs, sommés sur les slots équipés (10, `null` = vide).
 */

/** Total des bonus déclaratifs des artefacts équipés — 0 par champ si aucun. */
export interface ArtifactBonusTotal {
  attack: number;
  defense: number;
  power: number;
  knowledge: number;
  luck: number;
  morale: number;
  manaMax: number;
}

/** Somme des `bonus` de chaque artefact équipé (slot vide ou id inconnu ignoré). */
export function heroArtifactBonus(
  hero: HeroState,
  catalog: Record<string, ArtifactDef>,
): ArtifactBonusTotal {
  const total: ArtifactBonusTotal = {
    attack: 0,
    defense: 0,
    power: 0,
    knowledge: 0,
    luck: 0,
    morale: 0,
    manaMax: 0,
  };
  for (const artifactId of hero.artifacts) {
    if (!artifactId) continue;
    const def = catalog[artifactId];
    if (!def) continue;
    total.attack += def.bonus.attack ?? 0;
    total.defense += def.bonus.defense ?? 0;
    total.power += def.bonus.power ?? 0;
    total.knowledge += def.bonus.knowledge ?? 0;
    total.luck += def.bonus.luck ?? 0;
    total.morale += def.bonus.morale ?? 0;
    total.manaMax += def.bonus.manaMax ?? 0;
  }
  return total;
}

/**
 * Mana max effectif (doc 02 §1.1 : Mana = Savoir × 10 + artefacts) : le Savoir
 * des artefacts (`bonus.knowledge`, ex. Orbe de savoir) compte comme du Savoir,
 * en plus du bonus direct `manaMax`.
 */
export function heroManaMax(hero: HeroState, catalog: Record<string, ArtifactDef>): number {
  const bonus = heroArtifactBonus(hero, catalog);
  return (hero.attributes.knowledge + bonus.knowledge) * 10 + bonus.manaMax;
}
