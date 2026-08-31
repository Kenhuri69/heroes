/**
 * Calendrier — événements hebdomadaires (M-CALENDAR, doc 02 §2.3). Tirage
 * pondéré déterministe (RNG seedé) à chaque bascule de semaine ; le
 * `growthFactor` de l'événement tiré module la croissance hebdomadaire
 * (`town/economy.ts`). Purement data-driven : les événements vivent dans
 * `config.calendar.events`, le moteur ne connaît que des ids opaques.
 */
import type { CalendarEventDef, CalendarMonthEventDef } from './config';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { rollRange } from '../core/rng';
import { tileIndex } from './map';
import { isPassable } from './path';

/** Tirage pondéré partagé semaine/mois — consomme le RNG seedé de l'état. */
function weightedPick<T extends { weight: number }>(draft: GameState, pool: readonly T[]): T | null {
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  if (pool.length === 0 || total <= 0) return null;
  const roll = rollRange(draft.rng, 0, total - 1);
  draft.rng = roll.state;
  let acc = 0;
  for (const e of pool) {
    acc += e.weight;
    if (roll.value < acc) return e;
  }
  return pool[pool.length - 1] as T; // filet (arrondi/poids)
}

/**
 * Tire l'événement de la semaine courante (pondéré par `weight`), le stocke dans
 * `calendar.weekEventId` et le renvoie. Consomme le RNG seedé. Renvoie `null`
 * (et laisse `weekEventId` à `null`) si aucun événement n'est configuré.
 * « Semaine de X » (doc 18 A4) : si l'événement tiré porte `growthUnit`, l'unité
 * ciblée est TIRÉE parmi les recrutables du catalogue (`growthPerWeek` > 0,
 * clés triées — déterministe) et stockée dans `weekEventUnitId` ; sinon le champ
 * est EFFACÉ (forme d'état minimale — jamais posé sans un tel événement).
 */
export function rollWeekEvent(draft: GameState): CalendarEventDef | null {
  const events = draft.config?.calendar?.events ?? [];
  const picked = weightedPick(draft, events);
  if (!picked) {
    draft.calendar.weekEventId = null;
    return null;
  }
  draft.calendar.weekEventId = picked.id;
  if (picked.growthUnit) {
    const unitId = pickRecruitableUnit(draft);
    if (unitId) {
      draft.calendar.weekEventUnitId = unitId;
      return picked;
    }
  }
  delete draft.calendar.weekEventUnitId;
  return picked;
}

/**
 * Tire l'événement du MOIS courant (doc 18 A4, lot 2.5) à la bascule de mois —
 * pondéré, stocké dans `calendar.monthEventId`. No-op total (RNG non consommé,
 * champ jamais posé) sans `calendar.monthEvents` configuré : les parties et
 * sauvegardes existantes gardent leur séquence RNG et leur forme d'état.
 */
export function rollMonthEvent(draft: GameState): CalendarMonthEventDef | null {
  const events = draft.config?.calendar?.monthEvents ?? [];
  const picked = weightedPick(draft, events);
  if (!picked) return null;
  draft.calendar.monthEventId = picked.id;
  return picked;
}

/** Unité recrutable tirée au RNG seedé (clés triées ⇒ déterministe), ou `null`. */
function pickRecruitableUnit(draft: GameState): string | null {
  const candidates = Object.keys(draft.unitCatalog)
    .filter((id) => (draft.unitCatalog[id]?.growthPerWeek ?? 0) > 0)
    .sort();
  if (candidates.length === 0) return null;
  const roll = rollRange(draft.rng, 0, candidates.length - 1);
  draft.rng = roll.state;
  return candidates[roll.value] ?? null;
}

/**
 * « Mois des créatures » (doc 02 §2.3, lot L8) : pose `stacks` piles NEUTRES
 * d'une unité tirée au sort sur des tuiles libres — la carte se repeuple, comme
 * les mois à créatures de HoMM3. Déterministe (RNG de l'état) ; une carte
 * saturée en accueille simplement moins (essais bornés). No-op sans
 * `spawnCreatures` sur l'événement du mois, donc aucune partie existante ne
 * change de séquence.
 */
export function applyMonthSpawn(
  draft: GameState,
  event: CalendarMonthEventDef,
  events: GameEvent[],
): void {
  const spawn = event.spawnCreatures;
  const map = draft.map;
  const config = draft.config;
  if (!spawn || !map || !config || spawn.stacks <= 0 || spawn.size <= 0) return;
  const unitId = pickRecruitableUnit(draft);
  if (!unitId) return;
  const taken = new Set<number>();
  for (const o of map.objects) taken.add(tileIndex(map, o.pos));
  for (const h of draft.heroes) taken.add(tileIndex(map, h.pos));
  for (const t of draft.towns) taken.add(tileIndex(map, t.pos));
  let placed = 0;
  // Essais bornés : `stacks × 8` tirages au plus — jamais de boucle non bornée
  // sur une carte pleine (le RNG consommé reste donc borné et reproductible).
  for (let attempt = 0; attempt < spawn.stacks * 8 && placed < spawn.stacks; attempt++) {
    const rx = rollRange(draft.rng, 0, map.width - 1);
    draft.rng = rx.state;
    const ry = rollRange(draft.rng, 0, map.height - 1);
    draft.rng = ry.state;
    const pos = { x: rx.value, y: ry.value };
    const idx = tileIndex(map, pos);
    if (taken.has(idx) || !isPassable(config, map, pos)) continue;
    taken.add(idx);
    map.objects.push({
      id: `spawn-${event.id}-${draft.calendar.day}-${placed}`,
      type: 'guardian',
      pos,
      unitId,
      count: spawn.size,
    });
    placed++;
  }
  if (placed > 0)
    events.push({ type: 'CalendarCreaturesSpawned', unitId, stacks: placed, size: spawn.size });
}

/**
 * Facteur multiplicatif de croissance hebdomadaire de la semaine courante
 * (1 si aucun événement / événement inconnu).
 */
export function weekGrowthFactor(state: GameState): number {
  const id = state.calendar.weekEventId;
  if (id === null) return 1;
  return state.config?.calendar?.events.find((e) => e.id === id)?.growthFactor ?? 1;
}

/**
 * Facteur de croissance CIBLÉ d'un palier (M-CALENDAR « Semaine de X ») : si
 * l'événement de la semaine courante cible ce `tier`, son `growthTier.factor`,
 * sinon 1 (pas de ciblage). Multiplié au facteur global par la croissance hebdo.
 */
export function weekGrowthTierFactor(state: GameState, tier: number | undefined): number {
  const id = state.calendar.weekEventId;
  if (id === null || tier === undefined) return 1;
  const gt = state.config?.calendar?.events.find((e) => e.id === id)?.growthTier;
  return gt && gt.tier === tier ? gt.factor : 1;
}

/**
 * Facteur de croissance ciblé sur UNE unité (« semaine de X », doc 18 A4) : si
 * l'événement de la semaine courante porte `growthUnit` et que `unitId` est
 * l'unité tirée (`weekEventUnitId`), son `factor` — sinon 1.
 */
export function weekGrowthUnitFactor(state: GameState, unitId: string): number {
  const id = state.calendar.weekEventId;
  const target = state.calendar.weekEventUnitId;
  if (id === null || target == null || target !== unitId) return 1;
  return state.config?.calendar?.events.find((e) => e.id === id)?.growthUnit?.factor ?? 1;
}

/**
 * Facteur de croissance du MOIS courant (doc 18 A4) — 1 si aucun événement de
 * mois tiré / configuré. Cumulé (multiplié) aux facteurs de semaine.
 */
export function monthGrowthFactor(state: GameState): number {
  const id = state.calendar.monthEventId;
  if (id == null) return 1;
  return state.config?.calendar?.monthEvents?.find((e) => e.id === id)?.growthFactor ?? 1;
}
