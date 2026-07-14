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
  movementFlat: number;
  vision: number;
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
    movementFlat: 0,
    vision: 0,
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
    total.movementFlat += def.bonus.movementFlat ?? 0;
    total.vision += def.bonus.vision ?? 0;
  }
  return total;
}

/**
 * Sorts CASTABLES du héros (H-ARTEQUIP.2) : l'union de ses sorts appris
 * (`hero.spells`) et des sorts enseignés par les artefacts ÉQUIPÉS
 * (`grantsSpell`). Pure et sans doublon ; source unique consommée par la
 * validation (combat + aventure), l'IA et l'UI (grimoire). Un sort d'artefact
 * cesse d'être castable dès le déséquipement — `hero.spells` n'est jamais muté.
 */
export function heroKnownSpellIds(hero: HeroState, catalog: Record<string, ArtifactDef>): string[] {
  const ids = [...hero.spells];
  for (const artifactId of hero.artifacts) {
    if (!artifactId) continue;
    const granted = catalog[artifactId]?.grantsSpell;
    if (granted && !ids.includes(granted)) ids.push(granted);
  }
  return ids;
}

/**
 * Mana max effectif (décision plan phase-3.2 #1/#9, A7) : (Savoir + Savoir
 * d'artefacts) × 10 + manaMax d'artefacts. Le bonus `knowledge` d'un artefact
 * (Orbe de savoir) était sommé mais ignoré ici — désormais crédité ×10.
 */
export function heroManaMax(hero: HeroState, catalog: Record<string, ArtifactDef>): number {
  const bonus = heroArtifactBonus(hero, catalog);
  return (hero.attributes.knowledge + bonus.knowledge) * 10 + bonus.manaMax;
}
