import { describe, expect, it } from 'vitest';
import type { AdventureMapDef } from '@heroes/engine';
import { FogOverlay } from './fog';
import { CHUNK } from './tilemap';

/**
 * Revue 2026-09 (R6) : le brouillard ne retessèle que les chunks TOUCHÉS par un
 * changement (disque de vision déplacé, tuile révélée) — un pas de héros sur une
 * 64² ne rebâtit plus les 16 chunks.
 */
function map(size: number): AdventureMapDef {
  return {
    id: 'fog-test',
    width: size,
    height: size,
    terrain: Array<string>(size * size).fill('grass'),
    road: Array<boolean>(size * size).fill(false),
    triggers: [],
    objects: [],
    startPositions: [{ x: 0, y: 0 }],
  };
}

describe('FogOverlay — redessin incrémental', () => {
  it('premier update : tous les chunks ; pas de héros dans un coin : seuls les chunks touchés', () => {
    const size = CHUNK * 4; // 4×4 chunks
    const fog = new FogOverlay(map(size));
    const explored = Array<number>(size * size).fill(0);
    fog.update(explored, [{ pos: { x: 2, y: 2 }, radius: 2 }]);
    expect(fog.lastRedrawn).toBe(16);
    // Même `explored` (référence), la vision glisse d'une tuile dans le même chunk.
    fog.update(explored, [{ pos: { x: 3, y: 2 }, radius: 2 }]);
    expect(fog.lastRedrawn).toBe(1);
  });

  it('une tuile révélée hors des disques de vision ne redessine que son chunk', () => {
    const size = CHUNK * 4;
    const fog = new FogOverlay(map(size));
    const explored = Array<number>(size * size).fill(0);
    const sightings = [{ pos: { x: 1, y: 1 }, radius: 1 }];
    fog.update(explored, sightings);
    const next = [...explored];
    next[(size - 1) * size + (size - 1)] = 1; // coin opposé (dernier chunk)
    fog.update(next, sightings);
    // Le chunk de la vision (inchangée mais toujours « touchée ») + le chunk révélé.
    expect(fog.lastRedrawn).toBe(2);
  });

  it('rien n’a changé ⇒ aucun redessin', () => {
    const size = CHUNK * 2;
    const fog = new FogOverlay(map(size));
    const explored = Array<number>(size * size).fill(0);
    const sightings = [{ pos: { x: 1, y: 1 }, radius: 1 }];
    fog.update(explored, sightings);
    expect(fog.lastRedrawn).toBe(4); // 1er passage : les 4 chunks
    fog.update(explored, sightings);
    expect(fog.lastRedrawn).toBe(4); // inchangé : early return, aucun redessin
  });
});
