import type { DailyTemplate, LoadReport } from '@heroes/content';
import type { QuestCondition, QuestState } from '@heroes/engine';
import { seedRng, rollRange } from '@heroes/engine';

/**
 * Quêtes journalières du mode libre (doc 13 §4.2/§5.3, N4c) : petites missions
 * « contrats » instanciées depuis des gabarits data-driven, de manière
 * DÉTERMINISTE via le RNG seedé de la partie (PCG32 exporté par `@heroes/engine`
 * — même seed ⇒ mêmes contrats). Zéro diff moteur : le résultat est un
 * `QuestState` embarqué dans `StartGame`, exactement comme les quêtes de scénario.
 */

/** Métadonnées journal d'une quête journalière (`kind: daily`) — couche narrative. */
export interface DailyQuestMeta {
  id: string;
  titleKey: string;
  descriptionKey?: string;
  kind: 'daily';
  steps: { id: string }[];
}

export interface DailyQuests {
  questState: QuestState;
  metas: DailyQuestMeta[];
}

const HUMAN_PLAYER_ID = 'player-1';

/** Unité de tier N d'une faction, dérivée **génériquement** du manifeste (dwellings). */
function factionUnitAtTier(report: LoadReport, factionId: string, tier: number): string | null {
  const pack = report.content.packs.find((p) => p.manifest.id === factionId);
  if (!pack) return null;
  const dwelling = pack.manifest.town?.dwellings.find((d) => d.tier === tier);
  if (dwelling) return dwelling.unitId;
  return pack.units.find((u) => u.tier === tier)?.id ?? null;
}

/** Résout une condition de gabarit en `QuestCondition` moteur (null si irrésoluble). */
function resolveCondition(
  report: LoadReport,
  factionId: string,
  c: DailyTemplate['condition'],
): QuestCondition | null {
  if (c.type === 'recruitTier') {
    const unitId = factionUnitAtTier(report, factionId, c.tier);
    return unitId ? { type: 'ownUnits', unitId, count: c.count } : null;
  }
  if (c.type === 'buildStructure') return { type: 'buildStructure', buildingId: c.buildingId };
  return { type: 'surviveDays', days: c.days };
}

/** Génère `count` quêtes journalières distinctes (déterministe, RNG seedé). */
export function buildDailyQuests(
  report: LoadReport,
  humanFactionId: string,
  seed: number,
  count = 2,
): DailyQuests {
  // Ne garde que les gabarits résolubles pour cette faction (tier existant).
  const pool = report.content.dailyTemplates
    .map((tpl) => ({ tpl, condition: resolveCondition(report, humanFactionId, tpl.condition) }))
    .filter((e): e is { tpl: DailyTemplate; condition: QuestCondition } => e.condition !== null);

  const remaining = [...pool];
  const chosen: typeof pool = [];
  let rng = seedRng(seed);
  const n = Math.min(count, remaining.length);
  for (let i = 0; i < n; i++) {
    const roll = rollRange(rng, 0, remaining.length - 1);
    rng = roll.state;
    chosen.push(remaining.splice(roll.value, 1)[0]!);
  }

  const questState: QuestState = {
    quests: chosen.map(({ tpl, condition }) => ({
      def: {
        id: `daily-${tpl.id}`,
        playerId: HUMAN_PLAYER_ID,
        steps: [{ id: `${tpl.id}-step`, condition }],
        rewards: [tpl.reward],
      },
      stepIndex: 0,
      status: 'active' as const,
    })),
  };
  const metas: DailyQuestMeta[] = chosen.map(({ tpl }) => ({
    id: `daily-${tpl.id}`,
    titleKey: tpl.titleKey,
    ...(tpl.descriptionKey !== undefined ? { descriptionKey: tpl.descriptionKey } : {}),
    kind: 'daily' as const,
    steps: [{ id: `${tpl.id}-step` }],
  }));
  return { questState, metas };
}
