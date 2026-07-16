import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import { grailRevealedTo, obeliskCount, type MapObjectDef } from '../src/adventure/map';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * T-GRAIL lot 1 (doc 02 §2.2) : obélisques & révélation du Graal. Visiter TOUS
 * les obélisques révèle la tuile enterrée du Graal (`AdventureMapDef.grailPos`)
 * au joueur — dédup par obélisque, événement `ObeliskVisited`.
 */
function started(objects: MapObjectDef[], grailPos: { x: number; y: number } | null): GameState {
  const map = testMap();
  map.objects = objects;
  map.grailPos = grailPos;
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed: 42,
    players: [{ id: 'p1', startingResources: { ...emptyResources() } }],
    map,
    config: testConfig(),
    unitCatalog: testCatalog(),
  }).state;
}

const move = (state: GameState, path: { x: number; y: number }[]) =>
  apply(state, { type: 'MoveHero', heroId: 'hero-p1', path });

const obelisk = (id: string, x: number, y: number): MapObjectDef => ({ id, type: 'obelisk', pos: { x, y } });

describe('T-GRAIL — obélisques & révélation du Graal (doc 02 §2.2)', () => {
  it('visiter tous les obélisques révèle la tuile du Graal', () => {
    const s0 = started([obelisk('ob-1', 1, 0), obelisk('ob-2', 2, 0)], { x: 0, y: 1 });
    expect(obeliskCount(s0.map!)).toBe(2);
    expect(grailRevealedTo(s0.map!, s0.players[0]!.obelisksVisited)).toBe(false);

    // 1er obélisque : progression 1/2, pas encore révélé.
    const r1 = move(s0, [{ x: 1, y: 0 }]);
    expect(r1.state.players[0]!.obelisksVisited).toEqual(['ob-1']);
    expect(r1.events).toContainEqual({
      type: 'ObeliskVisited',
      playerId: 'p1',
      objectId: 'ob-1',
      visited: 1,
      total: 2,
      grailRevealed: false,
    });
    expect(grailRevealedTo(r1.state.map!, r1.state.players[0]!.obelisksVisited)).toBe(false);

    // 2ᵉ obélisque : 2/2 ⇒ Graal révélé.
    const r2 = move(r1.state, [{ x: 2, y: 0 }]);
    expect(r2.state.players[0]!.obelisksVisited).toEqual(['ob-1', 'ob-2']);
    expect(r2.events).toContainEqual({
      type: 'ObeliskVisited',
      playerId: 'p1',
      objectId: 'ob-2',
      visited: 2,
      total: 2,
      grailRevealed: true,
    });
    expect(grailRevealedTo(r2.state.map!, r2.state.players[0]!.obelisksVisited)).toBe(true);
  });

  it('re-visiter un obélisque ne le recompte pas', () => {
    const s0 = started([obelisk('ob-1', 1, 0), obelisk('ob-2', 2, 0)], { x: 0, y: 1 });
    const r1 = move(s0, [{ x: 1, y: 0 }]);
    // repasser sur ob-1 : aucun nouvel événement, compteur inchangé.
    const back = move(r1.state, [{ x: 0, y: 0 }]).state;
    const again = move(back, [{ x: 1, y: 0 }]);
    expect(again.state.players[0]!.obelisksVisited).toEqual(['ob-1']);
    expect(again.events.some((e) => e.type === 'ObeliskVisited')).toBe(false);
  });

  it('sans Graal (grailPos null), tout visiter ne révèle rien', () => {
    const s0 = started([obelisk('ob-1', 1, 0)], null);
    const r1 = move(s0, [{ x: 1, y: 0 }]);
    expect(r1.state.players[0]!.obelisksVisited).toEqual(['ob-1']);
    expect(grailRevealedTo(r1.state.map!, r1.state.players[0]!.obelisksVisited)).toBe(false);
    expect(r1.events).toContainEqual(
      expect.objectContaining({ type: 'ObeliskVisited', grailRevealed: false }),
    );
  });
});

describe('T-GRAIL lot 2 — fouille (Dig) & obtention du Graal', () => {
  it('fouiller la tuile du Graal donne le Graal au joueur et consomme la journée', () => {
    const onGrail = move(started([], { x: 1, y: 0 }), [{ x: 1, y: 0 }]).state;
    const r = apply(onGrail, { type: 'Dig', heroId: 'hero-p1' });
    expect(r.state.players[0]!.hasGrail).toBe(true);
    expect(r.state.heroes[0]!.movementPoints).toBe(0);
    expect(r.events).toContainEqual({
      type: 'GrailFound',
      playerId: 'p1',
      heroId: 'hero-p1',
      pos: { x: 1, y: 0 },
    });
  });

  it('fouiller hors de la tuile du Graal est refusé', () => {
    const s0 = started([], { x: 5, y: 5 }); // héros en (0,0), Graal ailleurs
    expect(() => apply(s0, { type: 'Dig', heroId: 'hero-p1' })).toThrow(/Graal/);
  });

  it('fouiller deux fois est refusé (Graal déjà possédé)', () => {
    const onGrail = move(started([], { x: 1, y: 0 }), [{ x: 1, y: 0 }]).state;
    const after = apply(onGrail, { type: 'Dig', heroId: 'hero-p1' }).state;
    expect(() => apply(after, { type: 'Dig', heroId: 'hero-p1' })).toThrow();
  });
});
