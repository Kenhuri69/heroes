import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/core/engine';
import type { PlayerSetup } from '../src/core/commands';
import { createEmptyState, emptyResources, type GameState } from '../src/core/state';
import type { GameEvent } from '../src/core/events';
import type { GuardianRewardConfig } from '../src/adventure/config';
import { rewardGuardianDefeat } from '../src/adventure/guardian-reward';
import type { AdventureMapDef } from '../src/adventure/map';
import { testCatalog, testConfig, testMap } from './fixtures';

/**
 * Butin de gardien (doc 02 §2.2) : or gradué par les PV totaux du gardien
 * (`hp × count`), ressource au-delà d'un seuil, artefact au-delà d'un seuil plus
 * haut — tout au RNG seedé, générique (ids opaques). Config absente ⇒ no-op.
 */

const REWARD: GuardianRewardConfig = {
  goldPerHp: 3,
  variancePercent: 20,
  resources: ['wood', 'ore', 'crystal'],
  resourceThresholdHp: 400,
  resourceAmount: { min: 2, max: 5 },
  artifactThresholdHp: 1200,
  artifactChancePercent: 100, // déterministe pour le test « artefact au niveau élevé »
};

function mapWithGuardian(count: number): AdventureMapDef {
  const base = testMap();
  return {
    ...base,
    objects: [
      ...base.objects,
      { id: 'guardian-1', type: 'guardian', pos: { x: 0, y: 5 }, unitId: 'blue-wolf', count },
    ],
  };
}

function startedGame(guardianCount: number, reward?: GuardianRewardConfig): GameState {
  const players: PlayerSetup[] = [
    { id: 'p1', startingResources: emptyResources(), startingArmy: [{ unitId: 'red-grunt', count: 100 }] },
  ];
  return apply(createEmptyState(), {
    type: 'StartGame',
    seed: 7,
    players,
    map: mapWithGuardian(guardianCount),
    config: { ...testConfig(), guardianReward: reward },
    unitCatalog: testCatalog(),
    buildingCatalog: {},
    towns: [],
  }).state;
}

/** Récompense un gardien encore présent (avant le retrait), comme `applyConsequences`. */
function reward(state: GameState): { next: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const next = produce(state, (draft) => {
    const hero = draft.heroes.find((h) => h.id === 'hero-p1')!;
    rewardGuardianDefeat(draft, hero, 'guardian-1', events);
  });
  return { next, events };
}

describe('rewardGuardianDefeat', () => {
  it('gardien faible : or toujours crédité, ni ressource ni artefact', () => {
    // blue-wolf hp10 × 5 = 50 PV < seuils (400 / 1200).
    const { next, events } = reward(startedGame(5, REWARD));
    const player = next.players.find((p) => p.id === 'p1')!;
    expect(player.resources.gold).toBeGreaterThan(0);
    expect(player.resources.wood + player.resources.ore + player.resources.crystal).toBe(0);
    const ev = events.find((e) => e.type === 'GuardianVanquished');
    expect(ev).toBeDefined();
    if (ev && ev.type === 'GuardianVanquished') {
      expect(ev.gold).toBe(player.resources.gold);
      expect(ev.resource).toBeNull();
      expect(ev.artifactId).toBeNull();
    }
    // Aucun artefact ramassé (10 slots restés nuls).
    expect(next.heroes[0]?.artifacts.every((a) => a === null)).toBe(true);
  });

  it('gardien moyen : ressource non-or accordée au-delà du seuil, pas d’artefact', () => {
    // hp10 × 50 = 500 PV ≥ 400 (ressource) mais < 1200 (artefact).
    const { next, events } = reward(startedGame(50, REWARD));
    const player = next.players.find((p) => p.id === 'p1')!;
    const totalRes = player.resources.wood + player.resources.ore + player.resources.crystal;
    expect(totalRes).toBeGreaterThanOrEqual(REWARD.resourceAmount.min);
    expect(totalRes).toBeLessThanOrEqual(REWARD.resourceAmount.max);
    const ev = events.find((e) => e.type === 'GuardianVanquished');
    if (ev && ev.type === 'GuardianVanquished') {
      expect(ev.resource).not.toBeNull();
      expect(REWARD.resources).toContain(ev.resource!);
      expect(ev.artifactId).toBeNull();
    }
  });

  it('gardien fort (niveau élevé) : artefact tombé au-delà du seuil haut', () => {
    // hp10 × 130 = 1300 PV ≥ 1200 ⇒ artefact (chance 100 %).
    const events: GameEvent[] = [];
    const state = startedGame(130, REWARD);
    const next = produce(state, (draft) => {
      draft.artifactCatalog = {
        'test-relic': { id: 'test-relic', bonus: { attack: 1 } },
      };
      const hero = draft.heroes.find((h) => h.id === 'hero-p1')!;
      rewardGuardianDefeat(draft, hero, 'guardian-1', events);
    });
    const hero = next.heroes.find((h) => h.id === 'hero-p1')!;
    expect(hero.artifacts[0]).toBe('test-relic');
    const ev = events.find((e) => e.type === 'GuardianVanquished');
    if (ev && ev.type === 'GuardianVanquished') expect(ev.artifactId).toBe('test-relic');
  });

  it('config absente : no-op (aucun or, aucun événement, RNG inchangé)', () => {
    const state = startedGame(50, undefined);
    const { next, events } = reward(state);
    const player = next.players.find((p) => p.id === 'p1')!;
    expect(player.resources.gold).toBe(0);
    expect(events.some((e) => e.type === 'GuardianVanquished')).toBe(false);
    expect(next.rng).toEqual(state.rng); // aucun tirage consommé
  });

  it('déterministe : même graine ⇒ même or', () => {
    const a = reward(startedGame(50, REWARD)).next.players[0]!.resources.gold;
    const b = reward(startedGame(50, REWARD)).next.players[0]!.resources.gold;
    expect(a).toBe(b);
  });
});

/**
 * E4.3 — Butin partagé en coop : or & ressource (divisibles) répartis également
 * entre les joueurs des héros co-participants ; l'artefact (indivisible) au lead.
 */
describe('rewardGuardianDefeat — coop (E4.3)', () => {
  it('or & ressource partagés également ; artefact au lead ; événement = total', () => {
    const events: GameEvent[] = [];
    // hp10 × 130 = 1300 PV ≥ tous les seuils ⇒ or + ressource + artefact.
    const state = startedGame(130, REWARD);
    const next = produce(state, (draft) => {
      draft.players.push({
        id: 'p2', resources: emptyResources(), factionResources: {}, explored: [],
        controller: 'human', eliminated: false, townlessDays: 0, huntContract: null, team: 1,
      });
      draft.players[0]!.team = 1; // p1 & p2 alliés
      // Fresh artifacts array (le spread est superficiel — sinon l'allié partage
      // le tableau du lead et « voit » son artefact).
      draft.heroes.push({
        ...draft.heroes[0]!, id: 'hero-ally', playerId: 'p2',
        artifacts: Array.from({ length: 10 }, () => null),
      });
      draft.artifactCatalog = { 'test-relic': { id: 'test-relic', bonus: { attack: 1 } } };
      const hero = draft.heroes.find((h) => h.id === 'hero-p1')!;
      rewardGuardianDefeat(draft, hero, 'guardian-1', events, ['hero-p1', 'hero-ally']);
    });
    const p1 = next.players.find((p) => p.id === 'p1')!;
    const p2 = next.players.find((p) => p.id === 'p2')!;
    // Or partagé ~moitié : les deux en reçoivent, écart ≤ 1 (reste au lead), total conservé.
    expect(p1.resources.gold).toBeGreaterThan(0);
    expect(p2.resources.gold).toBeGreaterThan(0);
    expect(p1.resources.gold - p2.resources.gold).toBeLessThanOrEqual(1);
    // Ressource idem : l'allié en reçoit sa part.
    const p2res = p2.resources.wood + p2.resources.ore + p2.resources.crystal;
    expect(p2res).toBeGreaterThan(0);
    // Artefact (indivisible) au lead ; l'allié n'en reçoit pas.
    expect(next.heroes.find((h) => h.id === 'hero-p1')!.artifacts[0]).toBe('test-relic');
    expect(next.heroes.find((h) => h.id === 'hero-ally')!.artifacts.every((a) => a === null)).toBe(true);
    // L'événement rapporte le TOTAL lâché par le gardien (sémantique « drop »).
    const ev = events.find((e) => e.type === 'GuardianVanquished');
    if (ev && ev.type === 'GuardianVanquished') {
      expect(ev.gold).toBe(p1.resources.gold + p2.resources.gold);
      const p1res = p1.resources.wood + p1.resources.ore + p1.resources.crystal;
      expect(ev.resourceAmount).toBe(p1res + p2res);
    }
  });

  it('solo (coopHeroIds au seul lead) : tout au lead, bit-identique', () => {
    const withList: GameEvent[] = [];
    const withoutList: GameEvent[] = [];
    const base = startedGame(130, REWARD);
    const a = produce(base, (d) => {
      d.artifactCatalog = { 'r': { id: 'r', bonus: { attack: 1 } } };
      rewardGuardianDefeat(d, d.heroes.find((h) => h.id === 'hero-p1')!, 'guardian-1', withList, ['hero-p1']);
    });
    const b = produce(base, (d) => {
      d.artifactCatalog = { 'r': { id: 'r', bonus: { attack: 1 } } };
      rewardGuardianDefeat(d, d.heroes.find((h) => h.id === 'hero-p1')!, 'guardian-1', withoutList);
    });
    expect(a.players[0]!.resources).toEqual(b.players[0]!.resources);
    expect(a.rng).toEqual(b.rng); // même séquence RNG (aucun tirage ajouté)
  });
});
