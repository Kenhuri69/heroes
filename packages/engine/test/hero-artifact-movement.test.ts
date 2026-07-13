import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { ArtifactDef } from '../src/hero/types';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * H-ARTEQUIP (doc 02 §1.5) — bottes de vitesse : un artefact `bonus.movementFlat`
 * ajoute des PM quotidiens au héros. Bonus dérivé live (zéro save/golden).
 * Générique (ids opaques), zéro faction.
 */

const BOOTS: ArtifactDef = { id: 'art-boots', bonus: { movementFlat: 300 }, slot: 'feet' };
const BOOTS2: ArtifactDef = { id: 'art-boots2', bonus: { movementFlat: 150 }, slot: 'misc' };

function startedWith(equipped: string[]): GameState {
  const state = apply(createEmptyState(), {
    type: 'StartGame',
    seed: 42,
    players: [{ id: 'p1', startingResources: { ...emptyResources() } }],
    map: testMap(),
    config: testConfig(),
    unitCatalog: testCatalog(),
    artifactCatalog: { 'art-boots': BOOTS, 'art-boots2': BOOTS2 },
  }).state;
  // Équipe les artefacts au héros puis rejoue un début de tour pour recalculer les PM.
  const withArtifacts = {
    ...state,
    heroes: state.heroes.map((h) => ({
      ...h,
      artifacts: h.artifacts.map((a, i) => equipped[i] ?? a),
    })),
  };
  // Fin de tour → nouveau jour → recalcul des PM (heroDailyMovement).
  return apply(withArtifacts, { type: 'EndTurn', playerId: 'p1' }).state;
}

describe('H-ARTEQUIP — artefact de mouvement', () => {
  it('un artefact movementFlat ajoute des PM quotidiens', () => {
    const base = startedWith([]).heroes[0]!.movementPoints;
    const withBoots = startedWith(['art-boots']).heroes[0]!.movementPoints;
    expect(withBoots).toBe(base + 300);
  });

  it('cumul de deux artefacts de mouvement', () => {
    const base = startedWith([]).heroes[0]!.movementPoints;
    const both = startedWith(['art-boots', 'art-boots2']).heroes[0]!.movementPoints;
    expect(both).toBe(base + 450);
  });
});
