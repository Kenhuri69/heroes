import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { applyAction, canShoot, canShootTarget, reachableHexes, tauntersAdjacentTo } from './actions';
import { estimateDamage } from './damage';
import type { Draft } from './draft';
import { hexDistance, type OffsetPos } from './hex';
import { effectiveSpeed, hasAbility } from './state-helpers';
import type { CombatActionInput, CombatSideId, CombatStack, CombatState, CombatUnitDef } from './types';

/**
 * IA heuristique de combat (doc 02 §5.6) — PUREMENT DÉTERMINISTE : aucun
 * tirage RNG dans le choix d'action, tout départage se fait par ordre stable
 * (id de cible puis hex croissant col/row). Pas de recherche arborescente
 * (MVP, conforme à la doc).
 *
 * Score d'une action d'ATTAQUE (tir ou mêlée, sur place ou après déplacement) :
 *
 *   score = (dégâtsMoyens + killsMoyens × pvUnitaireCible) × valeurCible
 *           − risqueRiposte − exposition
 *
 * - `dégâtsMoyens`/`killsMoyens` : moyenne (min,max) de `estimateDamage`. Le
 *   terme `killsMoyens × pvUnitaireCible` prime les coups qui achèvent des
 *   créatures : une créature tuée retire définitivement son capital de PV
 *   (et sa capacité de nuisance future) du champ de bataille, en plus des
 *   dégâts bruts déjà comptés — une cible « qui subit plus de pertes » est
 *   ainsi préférée à une cible blindée qui encaisse sans en perdre.
 * - `valeurCible = (attaque + défense + vitesse) × 1,5` si la cible est un
 *   tireur (menace prioritaire à abattre), `× 1` sinon.
 * - `risqueRiposte` = dégâts moyens de la riposte estimée
 *   (`estimateDamage.retaliation`, déjà nul pour un tir ou contre
 *   `noRetaliation` — cf. doc 02 §5.6).
 * - `exposition` = pénalité de la case d'ARRIVÉE après l'action :
 *   `EXPOSURE_ADJACENT` par ennemi déjà adjacent à cette case,
 *   `EXPOSURE_THREAT` par ennemi qui pourrait l'atteindre au tour prochain
 *   (approximation simple et stable : `distance(ennemi, case) − 1 ≤ vitesse
 *   effective de l'ennemi`, sans tenir compte des obstacles — cohérent avec
 *   la portée de tir illimitée retenue en 2.4).
 *
 * Comportements IMPOSÉS (appliqués AVANT le score ci-dessus, doc 02 §5.6) :
 *
 * 1. KITE — un tireur qui peut tirer ce tour-ci (`canShoot`) et qui est
 *    menacé (un ennemi pourrait l'atteindre au tour prochain, cf.
 *    approximation ci-dessus) s'éloigne vers la case atteignable la plus
 *    sûre (celle qui maximise la distance au danger, si elle annule toute
 *    menace) plutôt que de tirer — la portée illimitée en 2.4 rend ce repli
 *    suffisant, pas besoin de garder une ligne de tir particulière. Si
 *    aucune case sûre n'est atteignable, le tireur tire normalement (règle
 *    de score ci-dessus).
 * 2. PROGRESSION / DÉFENSE — si la pile ne peut ni tirer ni frapper personne
 *    ce tour-ci (aucun ennemi adjacent ni atteignable), elle DÉFEND — SAUF
 *    si elle est la pile la plus rapide (vitesse effective, départage par
 *    slot croissant) encore vivante de son camp : dans ce cas elle avance
 *    vers l'ennemi le plus proche. Ceci garantit qu'au moins un camp
 *    progresse à chaque round bloqué — la property « un combat se termine
 *    toujours » ne doit jamais dépendre d'un blocage mutuel.
 *
 * Départage strictement déterministe (jamais de RNG) : à score égal,
 * plus petit id de cible (ordre lexicographique), puis plus petit hex
 * (col croissant, puis row croissant).
 */

// Constantes de l'heuristique (documentées ci-dessus) — comportement d'IA,
// pas une règle de jeu : volontairement en dur, hors `config.json` (doc 02 §5.6).
const SHOOTER_THREAT_MULTIPLIER = 1.5;
const EXPOSURE_ADJACENT = 40;
const EXPOSURE_THREAT = 15;

function compareHex(a: OffsetPos, b: OffsetPos): number {
  return a.col - b.col || a.row - b.row;
}

/**
 * Comparaison de chaînes par unités de code (remédiation R1) — déterministe et
 * indépendante de l'ICU de l'hôte, contrairement à `localeCompare` : garantit
 * le même départage IA sur toute machine (replays, futur serveur).
 */
function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Meilleur élément par score décroissant ; égalité tranchée par `compareTie` (jamais de RNG). */
function pickBestBy<T>(items: T[], score: (item: T) => number, compareTie: (a: T, b: T) => number): T | null {
  let best: T | null = null;
  let bestScore = -Infinity;
  for (const item of items) {
    const s = score(item);
    if (best === null || s > bestScore || (s === bestScore && compareTie(item, best) < 0)) {
      best = item;
      bestScore = s;
    }
  }
  return best;
}

/** Valeur intrinsèque d'une cible : menace statistique, les tireurs priment (doc 02 §5.6). */
function targetValue(def: CombatUnitDef): number {
  const base = def.stats.attack + def.stats.defense + def.stats.speed;
  return hasAbility(def, 'shooter') ? base * SHOOTER_THREAT_MULTIPLIER : base;
}

/** Approximation stable : l'ennemi pourrait-il devenir adjacent à `pos` au tour prochain ? */
function canReachAdjacency(
  enemy: CombatStack,
  combat: CombatState,
  catalog: Record<string, CombatUnitDef>,
  pos: OffsetPos,
): boolean {
  const speed = effectiveSpeed(enemy, combat, catalog);
  return hexDistance(enemy.pos, pos) - 1 <= speed;
}

function isThreatenedAt(
  pos: OffsetPos,
  enemies: CombatStack[],
  combat: CombatState,
  catalog: Record<string, CombatUnitDef>,
): boolean {
  return enemies.some((e) => canReachAdjacency(e, combat, catalog, pos));
}

/** Pénalité d'exposition de la case d'arrivée (doc 02 §5.6, approximation simple et stable). */
function exposure(
  pos: OffsetPos,
  enemies: CombatStack[],
  combat: CombatState,
  catalog: Record<string, CombatUnitDef>,
): number {
  let adjacent = 0;
  let threat = 0;
  for (const e of enemies) {
    const d = hexDistance(e.pos, pos);
    if (d === 1) adjacent++;
    else if (canReachAdjacency(e, combat, catalog, pos)) threat++;
  }
  return adjacent * EXPOSURE_ADJACENT + threat * EXPOSURE_THREAT;
}

function nearestEnemyDistance(pos: OffsetPos, enemies: CombatStack[]): number {
  let best = Infinity;
  for (const e of enemies) best = Math.min(best, hexDistance(pos, e.pos));
  return best;
}

/** Pile la plus rapide encore vivante du camp `side` (départage par slot croissant). */
function fastestOfSide(
  side: CombatSideId,
  combat: CombatState,
  catalog: Record<string, CombatUnitDef>,
): CombatStack | null {
  const mine = combat.stacks.filter((s) => s.side === side && s.count > 0);
  return pickBestBy(
    mine,
    (s) => effectiveSpeed(s, combat, catalog),
    (a, b) => a.slot - b.slot,
  );
}

interface AttackCandidate {
  target: CombatStack;
  /** Hex de départ si un déplacement est requis avant la frappe (mêlée), null sinon. */
  from: OffsetPos | null;
}

function scoreCandidate(
  state: GameState,
  stackId: string,
  candidate: AttackCandidate,
  enemies: CombatStack[],
  combat: CombatState,
  catalog: Record<string, CombatUnitDef>,
  selfPos: OffsetPos,
): number {
  const targetDef = catalog[candidate.target.unitId];
  if (!targetDef) return -Infinity;
  const est = estimateDamage(state, stackId, candidate.target.id);
  const avgDamage = (est.damageMin + est.damageMax) / 2;
  const avgKills = (est.killsMin + est.killsMax) / 2;
  const expected = avgDamage + avgKills * targetDef.stats.hp;
  const retaliationRisk = est.retaliation ? (est.retaliation.damageMin + est.retaliation.damageMax) / 2 : 0;
  const pos = candidate.from ?? selfPos;
  return expected * targetValue(targetDef) - retaliationRisk - exposure(pos, enemies, combat, catalog);
}

/**
 * Heuristique de combat (doc 02 §5.6, raffinée au lot B) — formule et règles
 * imposées (kite/défense/progression) documentées en tête de fichier.
 */
export function chooseAction(state: GameState, stackId: string): CombatActionInput {
  const combat = state.combat;
  if (!combat) throw new Error(`chooseAction: aucun combat en cours`);
  const stack = combat.stacks.find((s) => s.id === stackId);
  if (!stack) throw new Error(`chooseAction: pile introuvable '${stackId}'`);
  const catalog = state.unitCatalog;
  const enemies = combat.stacks.filter((s) => s.side !== stack.side && s.count > 0);
  if (enemies.length === 0) return { type: 'defend' };

  // Règle imposée 1 — KITE : tireur menacé qui peut s'éloigner en sécurité.
  if (canShoot(state, stackId) && isThreatenedAt(stack.pos, enemies, combat, catalog)) {
    const reachable = reachableHexes(state, stackId);
    const safeHexes = reachable.filter((p) => !isThreatenedAt(p, enemies, combat, catalog));
    if (safeHexes.length > 0) {
      const best = pickBestBy(safeHexes, (p) => nearestEnemyDistance(p, enemies), compareHex);
      if (best) return { type: 'move', to: best };
    }
  }

  // Score normal : tir (sur place, ligne de vue dégagée — C-LOS) ou mêlée (sur
  // place ou après déplacement). La décision se fait PAR CIBLE : un tireur dont
  // la ligne de vue vers une cible est bloquée génère des candidats de mêlée
  // (jamais un tir « à travers » l'obstacle).
  const candidates: AttackCandidate[] = [];
  const reachable = reachableHexes(state, stackId);
  for (const e of enemies) {
    if (canShootTarget(state, stackId, e.id)) {
      candidates.push({ target: e, from: null });
    } else if (hexDistance(stack.pos, e.pos) === 1) {
      candidates.push({ target: e, from: null });
    } else {
      for (const p of reachable) {
        if (hexDistance(p, e.pos) === 1) candidates.push({ target: e, from: p });
      }
    }
  }

  // `taunt` (doc 03 §3) : écarte les frappes de mêlée illégales — depuis une
  // case adjacente à un provocateur ennemi, seul ce provocateur est visable.
  // Le tir (from===null ET ligne de vue) n'est jamais concerné.
  const legalCandidates = candidates.filter((c) => {
    if (canShootTarget(state, stackId, c.target.id)) return true;
    const pos = c.from ?? stack.pos;
    const taunters = tauntersAdjacentTo(combat, catalog, stack.side, pos);
    return taunters.length === 0 || taunters.some((t) => t.id === c.target.id);
  });

  if (legalCandidates.length > 0) {
    const best = pickBestBy(
      legalCandidates,
      (c) => scoreCandidate(state, stackId, c, enemies, combat, catalog, stack.pos),
      (a, b) => compareCodeUnits(a.target.id, b.target.id) || compareHex(a.from ?? stack.pos, b.from ?? stack.pos),
    ) as AttackCandidate;
    return best.from
      ? { type: 'attack', targetStackId: best.target.id, from: best.from }
      : { type: 'attack', targetStackId: best.target.id };
  }

  // Règle imposée 2 — PROGRESSION/DÉFENSE : rien à attaquer ce tour-ci.
  const fastest = fastestOfSide(stack.side, combat, catalog);
  if (fastest && fastest.id === stack.id) {
    const reachable = reachableHexes(state, stackId);
    const nearest = pickBestBy(reachable, (p) => -nearestEnemyDistance(p, enemies), compareHex);
    if (nearest) return { type: 'move', to: nearest };
  }
  return { type: 'defend' };
}

/** Garde-fou : une vraie boucle infinie serait un bug de règles, pas un cas à masquer. */
const MAX_AI_ITERATIONS = 20_000;

/** Fait jouer l'IA tant que la pile active appartient au camp NON-joueur. */
export function runAiIfNeeded(draft: Draft, events: GameEvent[]): void {
  let iterations = 0;
  for (;;) {
    const combat = draft.combat;
    if (!combat || combat.finished || !combat.activeStackId) return;
    const active = combat.stacks.find((s) => s.id === combat.activeStackId);
    if (!active || active.side === combat.playerSide) return;
    if (++iterations > MAX_AI_ITERATIONS) {
      throw new Error('runAiIfNeeded: dépassement d’itérations (boucle infinie suspectée)');
    }
    const action = chooseAction(draft, active.id);
    applyAction(draft, events, active.id, action);
  }
}

/**
 * L'IA joue aussi le camp joueur jusqu'à la fin (doc 02 §5.5) — ou, si
 * `rounds` est fourni (lot M4), jusqu'à ce que le compteur de round ait
 * avancé d'autant : l'appelant (`handleAutoCombat`) rend alors la main au
 * joueur (« reprendre la main à tout round », doc 08 §2.4).
 */
export function runAutoCombat(draft: Draft, events: GameEvent[], rounds?: number): void {
  const stopAtRound = rounds !== undefined && draft.combat ? draft.combat.round + rounds : null;
  let iterations = 0;
  for (;;) {
    const combat = draft.combat;
    if (!combat || combat.finished || !combat.activeStackId) return;
    if (stopAtRound !== null && combat.round >= stopAtRound) return;
    if (++iterations > MAX_AI_ITERATIONS) {
      throw new Error('runAutoCombat: dépassement d’itérations (boucle infinie suspectée)');
    }
    const action = chooseAction(draft, combat.activeStackId);
    applyAction(draft, events, combat.activeStackId, action);
  }
}
