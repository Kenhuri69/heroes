import { isAdjacent, terrainAt } from '../adventure/map';
import type { CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import { rollRange } from '../core/rng';
import { areAllies, type GameState, type HeroState } from '../core/state';
import { heroManaMax } from '../hero/artifacts';
import { heroTacticsColumns, sumHeroEffectField } from '../hero/skills';
import { symbiosisParams } from './damage';
import { runAiIfNeeded } from './ai';
import type { Draft } from './draft';
import { COMBAT_COLS, COMBAT_ROWS, inCombatBounds, sameHex, type OffsetPos } from './hex';
import { advanceTurn } from './turns';
import { hasAbility, initLedger, shooterAmmo } from './state-helpers';
import { spellcasterParams } from './spell-effect';
import type { ArmyStack, CombatSideId, CombatState, CombatStack, CombatUnitDef } from './types';

/**
 * Mise en place du combat (doc 02 §5.1, décisions plan #6/#7) : placement
 * automatique par slot, obstacles tirés au RNG du combat.
 */

export function placeSide(
  side: CombatSideId,
  army: ArmyStack[],
  catalog: Record<string, CombatUnitDef>,
  col: number,
): CombatStack[] {
  const n = army.length;
  const dir = col < COMBAT_COLS / 2 ? 1 : -1;
  // S5b : une machine de guerre (`warMachine`) est placée HORS formation, sur des
  // emplacements réservés en fin de colonne de départ — jamais dans la colonne de
  // front (audit doc 19 §2.5 : le chariot débordait en 1ʳᵉ ligne). Décision
  // GÉNÉRIQUE par capacité (donnée), aucun id d'unité/faction en dur.
  const isMachine = (s: ArmyStack): boolean =>
    (catalog[s.unitId]?.abilities ?? []).some((a) => a.id === 'warMachine');
  const machineCount = army.reduce((k, s) => (isMachine(s) ? k + 1 : k), 0);

  // Positions par index d'armée (l'ordre des piles/ids `${side}-${i}` est
  // INCHANGÉ — seul `pos` diffère). SANS machine ⇒ formule historique EXACTE
  // (B33 : n ≤ ROWS bande pleine, sinon débordement round-robin) ⇒ golden intact.
  const positions: OffsetPos[] = new Array<OffsetPos>(n);
  if (machineCount === 0) {
    const overflow = n > COMBAT_ROWS;
    for (let i = 0; i < n; i++) {
      positions[i] = overflow
        ? { col: col + dir * Math.floor(i / COMBAT_ROWS), row: i % COMBAT_ROWS }
        : { col, row: Math.floor((i + 0.5) * (COMBAT_ROWS / n)) };
    }
  } else {
    // Créatures capées à `ROWS − machineCount` rangées de tête ; machines dans les
    // dernières rangées du MÊME `col` (rangée arrière, hors colonne de front).
    const creatureRows = Math.max(1, COMBAT_ROWS - machineCount);
    const nc = n - machineCount;
    let ci = 0;
    let mi = 0;
    for (let i = 0; i < n; i++) {
      if (isMachine(army[i]!)) {
        positions[i] = { col, row: COMBAT_ROWS - machineCount + mi };
        mi++;
      } else {
        positions[i] =
          nc <= creatureRows
            ? { col, row: Math.floor((ci + 0.5) * (creatureRows / nc)) }
            : { col: col + dir * Math.floor(ci / creatureRows), row: ci % creatureRows };
        ci++;
      }
    }
  }

  return army.map((stack, i) => {
    const def = catalog[stack.unitId];
    const pos = positions[i]!;
    return {
      id: `${side}-${i}`,
      side,
      slot: i,
      unitId: stack.unitId,
      count: stack.count,
      firstHp: def?.stats.hp ?? 0,
      pos,
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

// C-SIEGE2 : rempart devant le défenseur (colonne fixe, hors zone d'obstacles
// centrale 3..COMBAT_COLS-4) avec une PORTE centrale (rangées ouvertes).
const SIEGE_WALL_COL = COMBAT_COLS - 4;
const SIEGE_GATE_ROWS: readonly number[] = [Math.floor(COMBAT_ROWS / 2) - 1, Math.floor(COMBAT_ROWS / 2)];

/**
 * Murs de siège (C-SIEGE2, doc 02 §5) : une ville à Fort dresse un rempart sur
 * `SIEGE_WALL_COL`, toutes rangées sauf la **porte** centrale. `fortLevel < 1`
 * (ville sans Fort) ⇒ aucun mur (siège v1 inchangé). `breached` (C-SIEGE2.2) :
 * une **catapulte** assaillante a bombardé le rempart ⇒ la porte est élargie
 * (les rangées qui la flanquent sont retirées), doublant l'ouverture.
 */
function buildSiegeWalls(fortLevel: number, breached: boolean): OffsetPos[] {
  if (fortLevel < 1) return [];
  const open = new Set<number>(SIEGE_GATE_ROWS);
  if (breached) {
    open.add(SIEGE_GATE_ROWS[0]! - 1);
    open.add(SIEGE_GATE_ROWS[SIEGE_GATE_ROWS.length - 1]! + 1);
  }
  const walls: OffsetPos[] = [];
  for (let row = 0; row < COMBAT_ROWS; row++) {
    if (open.has(row)) continue; // porte / brèche
    walls.push({ col: SIEGE_WALL_COL, row });
  }
  return walls;
}

// C-SIEGE2.3 : douve devant le rempart (colonne juste en amont), pour une ville
// bien fortifiée (Fort ≥ 2). Colonne pleine : franchir la douve coûte un tour.
const SIEGE_MOAT_COL = SIEGE_WALL_COL - 1;
const SIEGE_MOAT_MIN_FORT = 2;
// C-SIEGE2.4 : dégâts subis en s'arrêtant dans la douve (échelle Fort).
const SIEGE_MOAT_DAMAGE_PER_FORT = 20;
// C-SIEGE2.6 : PV d'un segment de rempart quand une catapulte l'érode round après
// round (≈ 2-3 tirs par segment aux dégâts de la catapulte). Exporté pour turns.ts.
export const SIEGE_WALL_HP = 30;

/** Douve de siège (C-SIEGE2.3) : colonne d'hexes devant le mur, gatée Fort ≥ 2. */
function buildMoat(fortLevel: number): OffsetPos[] {
  if (fortLevel < SIEGE_MOAT_MIN_FORT) return [];
  const moat: OffsetPos[] = [];
  for (let row = 0; row < COMBAT_ROWS; row++) moat.push({ col: SIEGE_MOAT_COL, row });
  return moat;
}

// C-SIEGE2.5 : tour de tir d'une ville très fortifiée (Fort ≥ 3, Château). Pile
// tireuse IMMOBILE (capacité `immobile` : `reachableHexes` renvoie vide) plantée
// DERRIÈRE la porte, donc atteignable par l'assaillant qui la franchit (pas de
// stalemate). Col > zone d'obstacles et hors colonne de douve ⇒ aucune collision.
const SIEGE_TOWER_MIN_FORT = 3;
const SIEGE_TOWER_UNIT = 'arrow-tower';
const SIEGE_TOWER_POS: OffsetPos = { col: SIEGE_WALL_COL + 1, row: SIEGE_GATE_ROWS[0]! };

/**
 * Une tour de tir apparaîtrait-elle en défense (C-SIEGE2.5/2.7a) ? Vrai si Fort ≥ 3
 * ET l'unité `arrow-tower` est chargée. Sert à `capture.ts` : une ville qui pose
 * une tour se défend même à garnison vide (défense tour-seule).
 */
export function wouldSpawnSiegeTower(fortLevel: number, catalog: Record<string, CombatUnitDef>): boolean {
  return fortLevel >= SIEGE_TOWER_MIN_FORT && !!catalog[SIEGE_TOWER_UNIT];
}

/**
 * Pile « tour de tir » côté défenseur (C-SIEGE2.5), ou null si `fortLevel < 3`
 * ou si l'unité `arrow-tower` est absente du catalogue (données non chargées).
 * Slot dédié `tower` (jamais en collision avec les slots numérotés de garnison).
 */
function buildTowerStack(fortLevel: number, catalog: Record<string, CombatUnitDef>): CombatStack | null {
  if (!wouldSpawnSiegeTower(fortLevel, catalog)) return null;
  const def = catalog[SIEGE_TOWER_UNIT]!;
  return {
    id: 'defender-tower',
    side: 'defender',
    slot: 99,
    unitId: SIEGE_TOWER_UNIT,
    count: 1,
    firstHp: def.stats.hp,
    pos: { ...SIEGE_TOWER_POS },
    retaliationsLeft: 1,
    waited: false,
    defending: false,
    ammo: shooterAmmo(def),
    spellCharges: 0,
    marks: 0,
    immobilizedRounds: 0,
    transformed: false,
    symbiosisStacks: 0,
    acted: false,
    statuses: [],
  };
}

function drawObstacles(draft: Draft, min: number, max: number, maxCol = COMBAT_COLS - 4): OffsetPos[] {
  const countRoll = rollRange(draft.rng, min, max);
  draft.rng = countRoll.state;
  const obstacles: OffsetPos[] = [];
  while (obstacles.length < countRoll.value) {
    // Colonnes centrales uniquement : 3 tuiles de marge depuis chaque bord de
    // spawn (0 et COMBAT_COLS-1) ⇒ obstacles symétriques dans le no-man's land,
    // jamais sur/adjacents à une colonne de départ. En SIÈGE, `maxCol` resserre
    // la plage à gauche de la douve/du rempart (B6) : un obstacle tiré sur la
    // porte (seule ouverture) rendait le combat insoluble pour la mêlée.
    const colRoll = rollRange(draft.rng, 3, maxCol);
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
/** Cap de piles d'armée d'un camp (doc 02 §5.1) — 7 slots, PARTAGÉS en coop. */
const COOP_ARMY_CAP = 7;

/**
 * Résout un allié invité VALIDE pour un combat coopératif PvE (E4.2, doc 18 E4) :
 * un autre héros, **allié** (`areAllies`), **adjacent** à la tuile du lead, à
 * l'armée non vide. Sinon `undefined` (le combat se joue en solo — invite ignorée).
 */
function resolveCoopAlly(draft: GameState, hero: HeroState, allyHeroId: string | undefined): HeroState | undefined {
  if (!allyHeroId || allyHeroId === hero.id) return undefined;
  const ally = draft.heroes.find((h) => h.id === allyHeroId);
  if (!ally || ally.army.length === 0) return undefined;
  const heroPlayer = draft.players.find((p) => p.id === hero.playerId);
  const allyPlayer = draft.players.find((p) => p.id === ally.playerId);
  if (!heroPlayer || !allyPlayer || !areAllies(heroPlayer, allyPlayer)) return undefined;
  if (!isAdjacent(hero.pos, ally.pos)) return undefined;
  return ally;
}

/**
 * Armée coop combinée (E4.2/E4.2b) : piles du lead puis de l'allié invité valide,
 * cap **7 PARTAGÉ** (lead prioritaire). Retourne le tableau parallèle des
 * propriétaires (`undefined` = lead ⇒ owner implicite `combat.heroId`) et l'allié
 * résolu (ou `undefined`). PUR : aucun effet de bord (l'appelant garde le contrôle
 * de l'ordre entre garde-fou d'armée vide et engagement de l'allié).
 */
function combineCoopArmy(
  draft: GameState,
  hero: HeroState,
  allyHeroId: string | undefined,
): { capped: ArmyStack[]; cappedOwners: (string | undefined)[]; ally: HeroState | undefined } {
  const ally = resolveCoopAlly(draft, hero, allyHeroId);
  const army: ArmyStack[] = [];
  const owners: (string | undefined)[] = [];
  for (const s of hero.army) {
    army.push(s);
    owners.push(undefined); // lead : owner implicite = combat.heroId
  }
  if (ally) for (const s of ally.army.filter((a) => a.count > 0)) {
    army.push(s);
    owners.push(ally.id);
  }
  return { capped: army.slice(0, COOP_ARMY_CAP), cappedOwners: owners.slice(0, COOP_ARMY_CAP), ally };
}

/**
 * Marque chaque pile d'attaque de son héros propriétaire coop — jamais celles du
 * lead (`owner` undefined ⇒ champ omis ⇒ combat mono-héros bit-identique, golden
 * épargné). Les piles au-delà de `owners` (machines de guerre du lead) restent au lead.
 */
function tagCoopOwners(stacks: CombatStack[], owners: (string | undefined)[]): void {
  stacks.forEach((st, i) => {
    const owner = owners[i];
    if (owner) st.ownerHeroId = owner;
  });
}

/**
 * Engage l'armée d'un allié coop dans le combat : vidée sur la carte (reconstruite
 * depuis ses survivants à la victoire, `applyConsequences`, symétrique au lead) et
 * émission de `AllyJoinedCombat`. No-op sans allié.
 */
function engageCoopAlly(ally: HeroState | undefined, heroId: string, events: GameEvent[]): void {
  if (!ally) return;
  ally.army = [];
  events.push({ type: 'AllyJoinedCombat', heroId, allyHeroId: ally.id });
}

export function beginGuardianCombat(
  draft: Draft,
  heroId: string,
  guardianObjectId: string,
  events: GameEvent[],
  /** Coop (E4.2, doc 18 E4) : héros allié invité dont l'armée rejoint le camp. */
  allyHeroId?: string,
): void {
  const hero = draft.heroes.find((h) => h.id === heroId);
  const map = draft.map;
  const rules = draft.config?.combat;
  if (!hero || !map || !rules) throw new Error('beginGuardianCombat: héros, carte ou config absents');
  const guardian = map.objects.find((o) => o.id === guardianObjectId);
  if (!guardian || guardian.type !== 'guardian')
    throw new Error(`beginGuardianCombat: gardien introuvable '${guardianObjectId}'`);
  const terrain = terrainAt(map, guardian.pos);
  // Coop (E4.2) : armée combinée lead + allié invité, cap 7 PARTAGÉ (lead
  // prioritaire). Chaque pile porte son héros propriétaire (`owners`) pour router
  // les survivants à la fin. Machines de guerre du lead HORS cap (piles extra).
  const { capped, cappedOwners, ally } = combineCoopArmy(draft, hero, allyHeroId);
  const attacker: ArmyStack[] = [...capped, ...hero.warMachines.map((unitId) => ({ unitId, count: 1 }))];
  // B5 : armée vide ⇒ refus d'engager (garde-fou parallèle au validateur humain,
  // remédiation R1 E1) — un héros sans troupe ne déclenche pas de combat de gardien.
  if (attacker.length === 0) return;
  const defender: ArmyStack[] = [{ unitId: guardian.unitId, count: guardian.count }];
  const attackerStacks = placeSide('attacker', attacker, draft.unitCatalog, 0);
  tagCoopOwners(attackerStacks, cappedOwners);
  engageCoopAlly(ally, heroId, events);
  const stacks = [...attackerStacks, ...placeSide('defender', defender, draft.unitCatalog, COMBAT_COLS - 1)];
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
 * Ouvre un combat d'**embuscade** (trigger `ambush`, doc 18 A5) : le héros qui a
 * foulé la tuile piégée affronte l'armée SCRIPTÉE déclarée par le trigger —
 * jumeau de `beginGuardianCombat` sans objet de carte (`guardianObjectId: null` ;
 * la fin de combat générique gère XP/survivants/mort du héros). Le terrain est
 * celui de la tuile du héros (il est DESSUS — piège, pas interception).
 */
export function beginAmbushCombat(
  draft: Draft,
  heroId: string,
  army: readonly { unitId: string; count: number }[],
  events: GameEvent[],
): void {
  const hero = draft.heroes.find((h) => h.id === heroId);
  const map = draft.map;
  const rules = draft.config?.combat;
  if (!hero || !map || !rules) throw new Error('beginAmbushCombat: héros, carte ou config absents');
  const terrain = terrainAt(map, hero.pos);
  const attacker: ArmyStack[] = [
    ...hero.army,
    ...hero.warMachines.map((unitId) => ({ unitId, count: 1 })),
  ];
  const defender: ArmyStack[] = army.filter((s) => s.count > 0).map((s) => ({ ...s }));
  if (attacker.length === 0 || defender.length === 0) return; // gardés par l'appelant/le schéma
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
    townId: null,
    wallDefenseBonus: 0,
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
  fortLevel: number,
  events: GameEvent[],
  /** Coop (E4.2b, doc 18 E4) : héros allié invité dont l'armée rejoint l'assaut. */
  allyHeroId?: string,
): void {
  const hero = draft.heroes.find((h) => h.id === heroId);
  const town = draft.towns.find((t) => t.id === townId);
  const rules = draft.config?.combat;
  if (!hero || !town || !rules) throw new Error('beginTownCombat: héros, ville ou config absents');
  const terrain = draft.map ? terrainAt(draft.map, town.pos) : 'grass';
  // Coop (E4.2b) : mêmes règles que le gardien — armée combinée lead + allié
  // invité, cap 7 PARTAGÉ, piles alliées taguées, armée de l'allié vidée à
  // l'engagement (survivants routés par owner à la victoire, `applyConsequences`).
  const { capped, cappedOwners, ally } = combineCoopArmy(draft, hero, allyHeroId);
  const attacker: ArmyStack[] = [...capped, ...hero.warMachines.map((unitId) => ({ unitId, count: 1 }))];
  const defender: ArmyStack[] = town.garrison.map((s) => ({ ...s }));
  // C-SIEGE2.5 : une ville très fortifiée (Fort ≥ 3) ajoute une tour de tir au
  // camp défenseur (pile immobile derrière la porte). Absente sinon.
  const tower = buildTowerStack(fortLevel, draft.unitCatalog);
  const attackerStacks = placeSide('attacker', attacker, draft.unitCatalog, 0);
  tagCoopOwners(attackerStacks, cappedOwners);
  engageCoopAlly(ally, heroId, events);
  const stacks = [
    ...attackerStacks,
    ...placeSide('defender', defender, draft.unitCatalog, COMBAT_COLS - 1),
    ...(tower ? [tower] : []),
  ];
  // B6 : dès qu'un rempart existe (Fort ≥ 1), les obstacles restent strictement
  // à gauche de la douve/du rempart — jamais sur la porte ni la douve.
  const obstacleMaxCol = fortLevel >= 1 ? SIEGE_MOAT_COL - 1 : COMBAT_COLS - 4;
  const obstacles = drawObstacles(draft, rules.obstaclesMin, rules.obstaclesMax, obstacleMaxCol);
  // C-SIEGE2.2 : une catapulte (machine de guerre `siegeBreaker`) portée par
  // l'assaillant élargit la brèche du rempart au montage du siège.
  const breached = hero.warMachines.some((id) => {
    const d = draft.unitCatalog[id];
    return d ? hasAbility(d, 'siegeBreaker') : false;
  });
  const siegeWalls = buildSiegeWalls(fortLevel, breached);
  const moat = buildMoat(fortLevel);
  // C-SIEGE2.6 : une catapulte assaillante (`breached`) érode le rempart round
  // après round ⇒ les segments restants gagnent des PV. Sans catapulte, murs
  // indestructibles (champ absent).
  const siegeWallHp: Record<string, number> | undefined =
    breached && siegeWalls.length > 0
      ? Object.fromEntries(siegeWalls.map((w) => [`${w.col},${w.row}`, SIEGE_WALL_HP]))
      : undefined;
  draft.combat = {
    terrain,
    phase: 'battle',
    round: 1,
    obstacles,
    ...(siegeWalls.length > 0 ? { siegeWalls } : {}),
    ...(siegeWallHp ? { siegeWallHp } : {}),
    ...(moat.length > 0 ? { moat, moatDamage: fortLevel * SIEGE_MOAT_DAMAGE_PER_FORT } : {}),
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
 * Ouvre un combat héros ↔ héros (H-VS-H, doc 02 §1.5/§5). Jumeau de
 * `beginTownCombat` : attaquant = armée du héros mouvant + machines de guerre,
 * défenseur = armée du héros ennemi + ses machines de guerre. Les DEUX
 * `attackerHeroId`/`defenderHeroId` sont posés (contrairement au gardien/siège) ;
 * les conséquences (dépouille, mort du vaincu) sont gérées dans `turns.ts`.
 * Câblé depuis `advanceHeroAlongPath` (le héros mouvant reste adjacent).
 */
export function beginHeroCombat(
  draft: Draft,
  attackerHeroId: string,
  defenderHeroId: string,
  events: GameEvent[],
): void {
  const attacker = draft.heroes.find((h) => h.id === attackerHeroId);
  const defender = draft.heroes.find((h) => h.id === defenderHeroId);
  const rules = draft.config?.combat;
  if (!attacker || !defender || !rules) throw new Error('beginHeroCombat: héros ou config absents');
  const terrain = draft.map ? terrainAt(draft.map, defender.pos) : 'grass';
  const attackerArmy: ArmyStack[] = [
    ...attacker.army,
    ...attacker.warMachines.map((unitId) => ({ unitId, count: 1 })),
  ];
  // Garde-fou (parallèle à `beginGuardianCombat`) : armée vide ⇒ pas de combat
  // (le validateur de `MoveHero` refuse déjà, ceci est une sécurité).
  if (attackerArmy.length === 0) return;
  const defenderArmy: ArmyStack[] = [
    ...defender.army,
    ...defender.warMachines.map((unitId) => ({ unitId, count: 1 })),
  ];
  const stacks = [
    ...placeSide('attacker', attackerArmy, draft.unitCatalog, 0),
    ...placeSide('defender', defenderArmy, draft.unitCatalog, COMBAT_COLS - 1),
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
    // `heroId` = héros mouvant (attaquant) : conserve la sémantique « héros joueur »
    // pour les conséquences ; les DEUX camps portent un héros ici.
    heroId: attackerHeroId,
    guardianObjectId: null,
    townId: null,
    wallDefenseBonus: 0,
    attackerHeroId,
    defenderHeroId,
    heroCastThisRound: [],
    heroAttackUsed: [],
    finished: false,
    winner: null,
  };
  initLedger(draft.combat);
  initHeroMana(draft, draft.combat);
  events.push({ type: 'CombatStarted', terrain, heroId: attackerHeroId, guardianObjectId: null });
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
/**
 * Spécialité EXACTE Faelar (H-COND-EXACT, doc 14 §5) : au début du combat, les
 * piles de CHAQUE camp portant un héros doté de `startingSymbiosisStacks`
 * démarrent à ce nombre de paliers de Symbiose (borné par `maxStacks` de l'unité)
 * au lieu de 0 — seulement les piles réellement dotées de la capacité
 * `symbiosis`. Générique : aucun nom de faction/héros, seul le module de
 * capacité `symbiosis` et un champ d'effet déclaratif sont lus.
 */
function applyStartingSymbiosis(draft: Draft, combat: CombatState): void {
  const sides: [CombatSideId, string | null][] = [
    ['attacker', combat.attackerHeroId],
    ['defender', combat.defenderHeroId],
  ];
  for (const [side, heroId] of sides) {
    const hero = heroId ? draft.heroes.find((h) => h.id === heroId) : undefined;
    if (!hero) continue;
    const start = sumHeroEffectField(hero, 'startingSymbiosisStacks');
    if (start <= 0) continue;
    for (const stack of combat.stacks) {
      if (stack.side !== side) continue;
      const def = draft.unitCatalog[stack.unitId];
      const params = def ? symbiosisParams(def) : null;
      if (!params) continue;
      stack.symbiosisStacks = Math.min(start, params.maxStacks);
    }
  }
}

function openPlacementOrBattle(draft: Draft, events: GameEvent[]): void {
  const combat = draft.combat;
  if (!combat) return;
  applyStartingSymbiosis(draft, combat);
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
