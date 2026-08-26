import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { grantArtifact } from '../src/hero/equip';
import { createEmptyState, emptyResources, type GameState, type HeroState } from '../src/core/state';
import type { ArtifactDef } from '../src/hero/types';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * Revue 2026-08 — la règle des slots EXCLUSIFS (H-ARTEQUIP, doc 02 §1.1) ne
 * s'appliquait qu'à `EquipArtifact` : les 8 autres chemins d'acquisition
 * (ramassage carte, butin de gardien, trigger, lieu visitable, dépouille
 * héros-vs-héros, quête, marchand, transfert entre héros) posaient l'artefact
 * dans le 1er slot libre sans contrôle. Comme `heroArtifactBonus` somme TOUS les
 * slots, un héros cumulait N artefacts d'un même emplacement exclusif.
 *
 * Le point d'étranglement est le helper partagé `grantArtifact` : on le teste
 * directement (la règle), puis on prouve le CÂBLAGE sur deux chemins réels
 * (ramassage au sol par déplacement, transfert entre héros).
 */
const HELM: ArtifactDef = { id: 'helm-1', bonus: { attack: 1 }, slot: 'head' };
const HELM2: ArtifactDef = { id: 'helm-2', bonus: { attack: 2 }, slot: 'head' };
const TRINKET: ArtifactDef = { id: 'trinket', bonus: { attack: 1 }, slot: 'misc' };
const CATALOG = { 'helm-1': HELM, 'helm-2': HELM2, trinket: TRINKET };

function bareHero(equipped: (string | null)[] = []): HeroState {
  return {
    artifacts: Array.from({ length: 10 }, (_, i) => equipped[i] ?? null),
  } as unknown as HeroState;
}

describe('grantArtifact — règle des slots exclusifs à l’acquisition', () => {
  it('slot libre et sans conflit ⇒ équipé', () => {
    const hero = bareHero();
    expect(grantArtifact(hero, CATALOG, 'helm-1')).toBe('equipped');
    expect(hero.artifacts[0]).toBe('helm-1');
  });

  it('slot exclusif DÉJÀ occupé ⇒ le sac, jamais un 2ᵉ casque équipé', () => {
    const hero = bareHero(['helm-1']);
    expect(grantArtifact(hero, CATALOG, 'helm-2')).toBe('backpack');
    expect(hero.artifacts.filter((a) => a !== null)).toEqual(['helm-1']);
    expect(hero.backpack).toEqual(['helm-2']);
  });

  it('slot `misc` (non exclusif) ⇒ se cumule normalement', () => {
    const hero = bareHero(['trinket']);
    expect(grantArtifact(hero, CATALOG, 'trinket')).toBe('equipped');
    expect(hero.artifacts.filter((a) => a !== null)).toEqual(['trinket', 'trinket']);
  });

  it('aucun slot libre ⇒ le sac (rien n’est perdu)', () => {
    const hero = bareHero(Array.from({ length: 10 }, () => 'trinket'));
    expect(grantArtifact(hero, CATALOG, 'helm-1')).toBe('backpack');
    expect(hero.backpack).toEqual(['helm-1']);
  });
});

/** Partie démarrée avec un artefact AU SOL sur la tuile voisine du héros. */
function stateWithGroundArtifact(equipped: string | null): GameState {
  const map = testMap();
  const started = apply(createEmptyState(), {
    type: 'StartGame',
    seed: 42,
    players: [{ id: 'p1', startingResources: { ...emptyResources() } }],
    map: {
      ...map,
      objects: [...map.objects, { id: 'art-1', type: 'artifact', pos: { x: 1, y: 0 }, artifactId: 'helm-2' }],
    },
    config: testConfig(),
    unitCatalog: testCatalog(),
    artifactCatalog: CATALOG,
  }).state;
  return {
    ...started,
    heroes: started.heroes.map((h) => ({
      ...h,
      artifacts: h.artifacts.map((a, i) => (i === 0 ? equipped : a)),
    })),
  };
}

describe('câblage — ramassage au sol', () => {
  it('casque au sol alors qu’un casque est porté ⇒ va au sac (plus de cumul)', () => {
    const state = stateWithGroundArtifact('helm-1');
    const hero = state.heroes[0]!;
    const after = apply(state, { type: 'MoveHero', heroId: hero.id, path: [{ x: 1, y: 0 }] }).state;
    const moved = after.heroes[0]!;
    expect(moved.artifacts.filter((a) => a !== null)).toEqual(['helm-1']);
    expect(moved.backpack).toEqual(['helm-2']);
  });

  it('casque au sol sans casque porté ⇒ équipé (comportement inchangé)', () => {
    const state = stateWithGroundArtifact(null);
    const hero = state.heroes[0]!;
    const after = apply(state, { type: 'MoveHero', heroId: hero.id, path: [{ x: 1, y: 0 }] }).state;
    expect(after.heroes[0]!.artifacts).toContain('helm-2');
  });
});
