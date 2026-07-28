import type { LoadReport } from '@heroes/content';
import { describe, expect, it } from 'vitest';
import { buildDailyQuests } from './daily';

/**
 * Contrats journaliers (doc 13 §4.2, N4c) — B7 : le joueur visé est celui que
 * l'appelant PASSE, jamais une constante `'player-1'` en dur (remédiation R3).
 * Fixture minimale (ids de faction fictifs : le garde-fou CI interdit un id réel
 * dans `packages/`).
 */
const FACTION = 'fixture-house';

const report = {
  content: {
    dailyTemplates: [
      {
        id: 'recruit',
        condition: { type: 'recruitTier', tier: 1, count: 10 },
        reward: { type: 'resources', resources: { gold: 500 } },
        titleKey: '@loc:daily.recruit.title',
      },
      {
        id: 'build',
        condition: { type: 'buildStructure', buildingId: 'fort' },
        reward: { type: 'resources', resources: { gold: 300 } },
        titleKey: '@loc:daily.build.title',
      },
    ],
    packs: [
      {
        manifest: { id: FACTION, town: { dwellings: [{ tier: 1, unitId: 'fixture-recruit' }] } },
        units: [{ id: 'fixture-recruit', tier: 1 }],
      },
    ],
  },
} as unknown as LoadReport;

describe('buildDailyQuests (B7 — identité du joueur)', () => {
  it('attribue les contrats au joueur PASSÉ, pas à player-1', () => {
    const { questState } = buildDailyQuests(report, FACTION, 'player-3', 1234);
    expect(questState.quests.length).toBe(2);
    for (const q of questState.quests) expect(q.def.playerId).toBe('player-3');
  });

  it('suit l’id fourni quel qu’il soit (siège nommé par un scénario)', () => {
    const { questState } = buildDailyQuests(report, FACTION, 'blue', 1234);
    expect(questState.quests.map((q) => q.def.playerId)).toEqual(['blue', 'blue']);
  });

  it('reste déterministe et indépendant du joueur (même seed ⇒ mêmes contrats)', () => {
    const a = buildDailyQuests(report, FACTION, 'player-1', 77);
    const b = buildDailyQuests(report, FACTION, 'player-2', 77);
    expect(a.questState.quests.map((q) => q.def.id)).toEqual(
      b.questState.quests.map((q) => q.def.id),
    );
    expect(a.metas.map((m) => m.id)).toEqual(b.metas.map((m) => m.id));
  });
});
