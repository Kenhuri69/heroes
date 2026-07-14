import type { Command, CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { canAffordCost, spendCost } from './resources';
import { unitWithEconomy } from './unit-economy';
import type { BuildingDef, TownState } from './types';

type UpgradeCmd = Extract<Command, { type: 'UpgradeUnits' }>;

/**
 * Upgrades d'unités (doc 02 §4.1, Alpha 4.11). Le dwelling amélioré est un
 * bâtiment GRADUÉ (niveau 1 = base, niveau 2 = amélioré) : recruter/faire
 * croître l'unité améliorée est déjà géré par le moteur existant (données
 * pures). Ce module ajoute le SEUL point d'extension : convertir une pile de
 * garnison **déjà recrutée** de base → améliorée contre le différentiel de coût.
 * Le mapping base→amélioré est **dérivé** du dwelling gradué — jamais un nom de
 * faction ni un champ de données dédié.
 */

/** Unité améliorée de `baseUnitId` si un dwelling gradué construit au niveau 2 la débloque, sinon `undefined`. */
export function upgradedUnitFor(
  town: TownState,
  catalog: Record<string, BuildingDef>,
  baseUnitId: string,
): string | undefined {
  for (const [buildingId, builtLevel] of Object.entries(town.buildings)) {
    if (builtLevel < 2) continue;
    const def = catalog[buildingId];
    const base = def?.levels[0]?.effect;
    const up = def?.levels[1]?.effect;
    if (base?.type === 'dwelling' && base.unitId === baseUnitId && up?.type === 'dwelling') {
      return up.unitId;
    }
  }
  return undefined;
}

/** Différentiel de coût base→amélioré (par ressource, plancher 0) × effectif. */
export function upgradeCost(
  state: GameState,
  baseUnitId: string,
  upgradedUnitId: string,
  count: number,
): Record<string, number> {
  const baseCost = unitWithEconomy(state.unitCatalog, baseUnitId)?.recruitCost ?? {};
  const upCost = unitWithEconomy(state.unitCatalog, upgradedUnitId)?.recruitCost ?? {};
  const diff: Record<string, number> = {};
  // Revue 2026-07 (B22) : union des clés des DEUX coûts — un `recruitCost` peut
  // porter une ressource de faction (id opaque, doc 05 §3.3), pas seulement les
  // 7 ressources core. Le paiement route déjà par clé (`spendCost`).
  for (const r of new Set([...Object.keys(baseCost), ...Object.keys(upCost)])) {
    const d = (upCost[r] ?? 0) - (baseCost[r] ?? 0);
    if (d > 0) diff[r] = d * count;
  }
  return diff;
}

export function validateUpgradeUnits(state: GameState, cmd: UpgradeCmd): CommandError | null {
  const town = state.towns.find((t) => t.id === cmd.townId);
  if (!town) return { code: 'unknownTown', message: `ville inconnue '${cmd.townId}'` };
  const player = state.players[state.currentPlayer];
  if (!player || town.ownerPlayerId !== player.id)
    return { code: 'notYourTown', message: `la ville '${cmd.townId}' n'appartient pas au joueur actif` };
  const stack = town.garrison.find((s) => s.unitId === cmd.unitId);
  if (!stack || stack.count <= 0)
    return { code: 'notUpgradable', message: `aucune pile '${cmd.unitId}' en garnison de '${cmd.townId}'` };
  const upgradedUnitId = upgradedUnitFor(town, state.buildingCatalog, cmd.unitId);
  if (!upgradedUnitId)
    return { code: 'notUpgradable', message: `'${cmd.unitId}' n'a pas de dwelling amélioré bâti dans '${cmd.townId}'` };
  if (!canAffordCost(player, upgradeCost(state, cmd.unitId, upgradedUnitId, stack.count)))
    return { code: 'cannotAfford', message: `ressources insuffisantes pour améliorer '${cmd.unitId}'` };
  return null;
}

export function handleUpgradeUnits(draft: GameState, cmd: UpgradeCmd, events: GameEvent[]): void {
  const town = draft.towns.find((t) => t.id === cmd.townId);
  const player = draft.players[draft.currentPlayer];
  if (!town || !player) return; // exclu par validate
  const stack = town.garrison.find((s) => s.unitId === cmd.unitId);
  if (!stack) return;
  const upgradedUnitId = upgradedUnitFor(town, draft.buildingCatalog, cmd.unitId);
  if (!upgradedUnitId) return;
  const count = stack.count;
  spendCost(player, upgradeCost(draft, cmd.unitId, upgradedUnitId, count));
  // Convertit la pile : fusionne si une pile améliorée existe déjà, sinon renomme.
  const existing = town.garrison.find((s) => s.unitId === upgradedUnitId);
  if (existing) {
    existing.count += count;
    town.garrison.splice(town.garrison.indexOf(stack), 1);
  } else {
    stack.unitId = upgradedUnitId;
  }
  events.push({ type: 'UnitsUpgraded', townId: town.id, fromUnitId: cmd.unitId, toUnitId: upgradedUnitId, count });
}
