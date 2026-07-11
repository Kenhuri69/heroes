import { terrainAt } from '../adventure/map';
import type { CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import { rollRange } from '../core/rng';
import type { GameState } from '../core/state';
import { heroManaMax } from '../hero/artifacts';
import { heroTacticsColumns } from '../hero/skills';
import { runAiIfNeeded } from './ai';
import type { Draft } from './draft';
import { COMBAT_COLS, COMBAT_ROWS, inCombatBounds, sameHex, type OffsetPos } from './hex';
import { advanceTurn } from './turns';
import { initLedger, shooterAmmo } from './state-helpers';
import { spellcasterParams } from './spell-effect';
import type { ArmyStack, CombatSideId, CombatState, CombatStack, CombatUnitDef } from './types';

/**
 * Mise en place du combat (doc 02 §5.1, décisions plan #6/#7) : placement
 * automatique par slot, obstacles tirés au RNG du combat.
 */

function placeSide(
  side: CombatSideId,
  army: ArmyStack[],
  catalog: Record<string, CombatUnitDef>,
  col: number,
): CombatStack[] {
  const n = army.length;
  return army.map((stack, i) => {
    const def = catalog[stack.unitId];
    const row = Math.floor((i + 0.5) * (COMBAT_ROWS / n));
    return {
      id: `${side}-${i}`,
      side,
      slot: i,
      unitId: stack.unitId,
      count: stack.count,
      firstHp: def?.stats.hp ?? 0,
      pos: { col, row },
      retaliationsLeft: 1,
      waited: false,
      defending: false,
      ammo: def ? shooterAmmo(def) : null,
      spellCharges: def ? (spellcasterParams(def)?.charges ?? 0) : 0,
      marks: 0,
      immobilizedRounds: 0,
      transformed: false,
      symbiosisStacks: 0,
      acted: false,
      statuses: [],
    };
  });
}

function drawObstacles(draft: Draft, min: number, max: number): OffsetPos[] {
  const countRoll = rollRange(draft.rng, min, max);
  draft.rng = countRoll.state;
  const obstacles: OffsetPos[] = [];
  while (obstacles.length < countRoll.value) {
    // Colonnes centrales uniquement : 3 tuiles de marge depuis chaque bord de
    // spawn (0 et COMBAT_COLS-1) ⇒ obstacles symétriques dans le no-man's land,
    // jamais sur/adjacents à une colonne de départ.
    const colRoll = rollRange(draft.rng, 3, COMBAT_COLS - 4);
    draft.rng = colRoll.state;
    const rowRoll = rollRange(draft.rng, 0, COMBAT_ROWS - 1);
    draft.rng = rowRoll.state;
    const pos = { col: colRoll.value, row: rowRoll.value };
    if (!obstacles.some((o) => sameHex(o, pos))) obstacles.push(pos);
  }
  return obstacles;
}

/** Remplit la mana des héros liés au combat à leur `manaMax` effectif (décision plan phase-3.2 #1). */
function initHeroMana(draft: Draft, combat: CombatState): void {
  for (const heroId of [combat.attackerHeroId, combat.defenderHeroId]) {
    if (!heroId) continue;
    const hero = draft.heroes.find((h) => h.id === heroId);
    if (!hero) continue;
    const manaMax = heroManaMax(hero, draft.artifactCatalog);
    hero.manaMax = manaMax;
    hero.mana = manaMax;
  }
}

function checkArmy(
  army: ArmyStack[],
  label: string,
  catalog: Record<string, CombatUnitDef>,
): CommandError | null {
  if (army.length === 0) return { code: 'invalidArmy', message: `armée ${label} vide` };
  if (army.length > 7) return { code: 'invalidArmy', message: `armée ${label} : plus de 7 piles` };
  for (const s of army) {
    if (!(s.unitId in catalog))
      return { code: 'invalidArmy', message: `armée ${label} : unité inconnue '${s.unitId}'` };
    if (s.count <= 0)
      return { code: 'invalidArmy', message: `armée ${label} : effectif non positif pour '${s.unitId}'` };
  }
  return null;
}

export function validateStartCombat(
  state: GameState,
  cmd: { attacker: ArmyStack[]; defender: ArmyStack[]; terrain: string },
): CommandError | null {
  if (!state.config) return { code: 'invalidAction', message: 'config absente' };
  return (
    checkArmy(cmd.attacker, 'attaquante', state.unitCatalog) ??
    checkArmy(cmd.defender, 'défenseure', state.unitCatalog) ??
    (cmd.terrain in state.config.terrains
      ? null
      : { code: 'invalidAction', message: `terrain inconnu '${cmd.terrain}'` })
  );
}

export function handleStartCombat(
  draft: Draft,
  cmd: { attacker: ArmyStack[]; defender: ArmyStack[]; terrain: string },
  events: GameEvent[],
): void {
  const rules = draft.config?.combat;
  if (!rules) throw new Error('handleStartCombat: config absente');
  const stacks = [
    ...placeSide('attacker', cmd.attacker, draft.unitCatalog, 0),
    ...placeSide('defender', cmd.defender, draft.unitCatalog, COMBAT_COLS - 1),
  ];
  const obstacles = drawObstacles(draft, rules.obstaclesMin, rules.obstaclesMax);
  draft.combat = {
    terrain: cmd.terrain,
    phase: 'battle', // arène sans héros : jamais de phase de placement (C-TACTICS)
    round: 1,
    obstacles,
    stacks,
    activeStackId: null,
    playerSide: 'attacker',
    heroId: null,
    guardianObjectId: null,
    townId: null,
    wallDefenseBonus: 0,
    attackerHeroId: null,
    defenderHeroId: null,
    heroCastThisRound: [],
    heroAttackUsed: [],
    finished: false,
    winner: null,
  };
  initLedger(draft.combat);
  initHeroMana(draft, draft.combat);
  events.push({ type: 'CombatStarted', terrain: cmd.terrain, heroId: null, guardianObjectId: null });
  events.push({ type: 'CombatRoundStarted', round: 1 });
  advanceTurn(draft, events);
  runAiIfNeeded(draft, events);
}

/** Ouvre un combat d'interception héros ↔ gardien (câblage `MoveHero` au lot D). */
export function beginGuardianCombat(
  draft: Draft,
  heroId: string,
  guardianObjectId: string,
  events: GameEvent[],
): void {
  const hero = draft.heroes.find((h) => h.id === heroId);
  const map = draft.map;
  const rules = draft.config?.combat;
  if (!hero || !map || !rules) throw new Error('beginGuardianCombat: héros, carte ou config absents');
  const guardian = map.objects.find((o) => o.id === guardianObjectId);
  if (!guardian || guardian.type !== 'guardian')
    throw new Error(`beginGuardianCombat: gardien introuvable '${guardianObjectId}'`);
  const terrain = terrainAt(map, guardian.pos);
  // Les machines de guerre du héros (doc 02 §5, Alpha 4.12) rejoignent son camp
  // comme piles supplémentaires (count 1), hors cap 7 de l'armée.
  const attacker: ArmyStack[] = [
    ...hero.army,
    ...hero.warMachines.map((unitId) => ({ unitId, count: 1 })),
  ];
  // B5 : armée vide ⇒ refus d'engager (garde-fou parallèle au validateur humain,
  // remédiation R1 E1) — un héros sans troupe ne déclenche pas de combat de gardien.
  if (attacker.length === 0) return;
  const defender: ArmyStack[] = [{ unitId: guardian.unitId, count: guardian.count }];
  const stacks = [
    ...placeSide('attacker', attacker, draft.unitCatalog, 0),
    ...placeSide('defender', defender, draft.unitCatalog, COMBAT_COLS - 1),
  ];
  const obstacles = drawObstacles(draft, rules.obstaclesMin, rules.obstaclesMax);
  draft.combat = {
    terrain,
    phase: 'battle',
    round: 1,
    obstacles,
    stacks,
    activeStackId: null,
    playerSide: 'attacker',
    heroId,
    guardianObjectId,
    townId: null,
    wallDefenseBonus: 0,
    // L'attaquant est le héros joueur ; le gardien neutre n'a pas de héros.
    attackerHeroId: heroId,
    defenderHeroId: null,
    heroCastThisRound: [],
    heroAttackUsed: [],
    finished: false,
    winner: null,
  };
  initLedger(draft.combat);
  initHeroMana(draft, draft.combat);
  events.push({ type: 'CombatStarted', terrain, heroId, guardianObjectId });
  events.push({ type: 'CombatRoundStarted', round: 1 });
  openPlacementOrBattle(draft, events);
}

/**
 * Ouvre un combat de siège héros ↔ garnison de ville (doc 02 §4.1, Alpha 4.13).
 * Jumeau de `beginGuardianCombat` : attaquant = armée du héros + machines de
 * guerre, défenseur = garnison ; le Fort accorde un bonus de défense « murs ».
 * Câblé depuis `CaptureTown` (ville défendue).
 */
export function beginTownCombat(
  draft: Draft,
  heroId: string,
  townId: string,
  wallDefenseBonus: number,
  events: GameEvent[],
): void {
  const hero = draft.heroes.find((h) => h.id === heroId);
  const town = draft.towns.find((t) => t.id === townId);
  const rules = draft.config?.combat;
  if (!hero || !town || !rules) throw new Error('beginTownCombat: héros, ville ou config absents');
  const terrain = draft.map ? terrainAt(draft.map, town.pos) : 'grass';
  const attacker: ArmyStack[] = [
    ...hero.army,
    ...hero.warMachines.map((unitId) => ({ unitId, count: 1 })),
  ];
  const defender: ArmyStack[] = town.garrison.map((s) => ({ ...s }));
  const stacks = [
    ...placeSide('attacker', attacker, draft.unitCatalog, 0),
    ...placeSide('defender', defender, draft.unitCatalog, COMBAT_COLS - 1),
  ];
  const obstacles = drawObstacles(draft, rules.obstaclesMin, rules.obstaclesMax);
  draft.combat = {
    terrain,
    phase: 'battle',
    round: 1,
    obstacles,
    stacks,
    activeStackId: null,
    playerSide: 'attacker',
    heroId,
    guardianObjectId: null,
    townId,
    wallDefenseBonus,
    attackerHeroId: heroId,
    defenderHeroId: null,
    heroCastThisRound: [],
    heroAttackUsed: [],
    finished: false,
    winner: null,
  };
  initLedger(draft.combat);
  initHeroMana(draft, draft.combat);
  events.push({ type: 'CombatStarted', terrain, heroId, guardianObjectId: null });
  events.push({ type: 'CombatRoundStarted', round: 1 });
  openPlacementOrBattle(draft, events);
}

/**
 * C-TACTICS (doc 02 §5.1) : profondeur de la bande de placement du camp JOUEUR
 * (héros lié à `playerSide` doté de la compétence Tactique). 0 ⇒ pas de phase de
 * placement (comportement historique).
 */
export function combatTacticsColumns(draft: GameState, combat: CombatState): number {
  const heroId = combat.playerSide === 'attacker' ? combat.attackerHeroId : combat.defenderHeroId;
  const hero = heroId ? draft.heroes.find((h) => h.id === heroId) : undefined;
  return hero ? Math.max(0, heroTacticsColumns(hero, draft.skillCatalog)) : 0;
}

/**
 * À l'ouverture d'un combat de héros : entre en **phase de placement** si le
 * camp joueur a la Tactique (le joueur repositionne ses piles avant la bataille,
 * `FinishPlacement` la clôt), sinon démarre la bataille immédiatement.
 */
function openPlacementOrBattle(draft: Draft, events: GameEvent[]): void {
  const combat = draft.combat;
  if (!combat) return;
  if (combatTacticsColumns(draft, combat) > 0) {
    combat.phase = 'placement'; // activeStackId reste null : aucun tour tant que FinishPlacement
    return;
  }
  beginBattlePhase(draft, events);
}

/**
 * Démarre la bataille (premier tour d'initiative + relais IA) — appelé soit à
 * l'ouverture (sans Tactique), soit à `FinishPlacement`, soit par l'auto-combat
 * qui saute une phase de placement pendante.
 */
export function beginBattlePhase(draft: Draft, events: GameEvent[]): void {
  const combat = draft.combat;
  if (!combat) return;
  combat.phase = 'battle';
  advanceTurn(draft, events);
  runAiIfNeeded(draft, events);
}

/** Bande de placement du camp joueur (C-TACTICS) : colonnes [0, cols] côté attaquant,
 *  [COMBAT_COLS-1-cols, COMBAT_COLS-1] côté défenseur — depuis la colonne de spawn. */
function placementBandCols(playerSide: CombatSideId, cols: number): { min: number; max: number } {
  return playerSide === 'attacker'
    ? { min: 0, max: cols }
    : { min: COMBAT_COLS - 1 - cols, max: COMBAT_COLS - 1 };
}

/** Validation de `PlaceStack` (C-TACTICS) : phase de placement, pile du camp joueur, cible dans la bande, libre. */
export function validatePlaceStack(
  state: GameState,
  cmd: { stackId: string; to: OffsetPos },
): CommandError | null {
  const combat = state.combat;
  if (!combat) return { code: 'noCombat', message: 'aucun combat en cours' };
  if (combat.phase !== 'placement')
    return { code: 'invalidAction', message: 'placement hors de la phase de placement' };
  const stack = combat.stacks.find((s) => s.id === cmd.stackId);
  if (!stack || stack.count <= 0) return { code: 'invalidTarget', message: `pile invalide '${cmd.stackId}'` };
  if (stack.side !== combat.playerSide)
    return { code: 'invalidTarget', message: 'seules les piles du camp joueur se placent' };
  if (!inCombatBounds(cmd.to)) return { code: 'invalidTarget', message: 'case hors du plateau' };
  const cols = combatTacticsColumns(state, combat);
  const band = placementBandCols(combat.playerSide, cols);
  if (cmd.to.col < band.min || cmd.to.col > band.max)
    return { code: 'invalidTarget', message: 'case hors de la bande de placement' };
  if (combat.obstacles.some((o) => sameHex(o, cmd.to)))
    return { code: 'invalidTarget', message: 'case occupée par un obstacle' };
  if (combat.stacks.some((s) => s.id !== cmd.stackId && s.count > 0 && sameHex(s.pos, cmd.to)))
    return { code: 'invalidTarget', message: 'case occupée par une autre pile' };
  return null;
}

export function handlePlaceStack(
  draft: Draft,
  cmd: { stackId: string; to: OffsetPos },
  events: GameEvent[],
): void {
  const combat = draft.combat;
  if (!combat) return; // exclu par validate
  const stack = combat.stacks.find((s) => s.id === cmd.stackId);
  if (!stack) return;
  const from = { ...stack.pos };
  stack.pos = { ...cmd.to };
  events.push({ type: 'StackPlaced', stackId: stack.id, from, to: { ...cmd.to } });
}

export function validateFinishPlacement(state: GameState): CommandError | null {
  const combat = state.combat;
  if (!combat) return { code: 'noCombat', message: 'aucun combat en cours' };
  if (combat.phase !== 'placement')
    return { code: 'invalidAction', message: 'aucune phase de placement à clore' };
  return null;
}

export function handleFinishPlacement(draft: Draft, events: GameEvent[]): void {
  if (!draft.combat || draft.combat.phase !== 'placement') return; // exclu par validate
  beginBattlePhase(draft, events);
}
