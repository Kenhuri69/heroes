import type { CommandError } from '../core/commands';
import type { GameEvent } from '../core/events';
import { rollRange } from '../core/rng';
import type { GameState } from '../core/state';
import { chargePerHex, performStrike, symbiosisParams } from './damage';
import type { Draft } from './draft';
import { COMBAT_COLS, COMBAT_ROWS, hexDistance, hexLine, hexNeighbors, sameHex, type OffsetPos } from './hex';
import { advanceTurn, checkCombatEnd } from './turns';
import { combatRules, hasAbility, isShooterMeleePenalized, moraleOf, moveRange } from './state-helpers';
import type { CombatActionInput, CombatStack, CombatState } from './types';

/**
 * Actions de la pile active (doc 02 §5.2) : déplacement (BFS hex), tir/mêlée,
 * attendre, défendre. `reachableHexes`/`canShoot` sont aussi exposés à l'UI
 * (surbrillances, prévisualisation) et réutilisés par l'IA (`ai.ts`).
 */

function hexKey(p: OffsetPos): string {
  return `${p.col},${p.row}`;
}

/** Hexes atteignables en déplacement (portée = vitesse effective) — BFS coût 1/hex. */
export function reachableHexes(state: GameState, stackId: string): OffsetPos[] {
  const combat = state.combat;
  if (!combat) return [];
  const stack = combat.stacks.find((s) => s.id === stackId);
  if (!stack) return [];
  const def = state.unitCatalog[stack.unitId];
  if (!def) return [];
  // Portée = vitesse effective + speedMod des statuts (Hâte/Lenteur/Entraves), ≥ 0 (A4).
  const speed = moveRange(stack, combat, state.unitCatalog);
  const flying = hasAbility(def, 'flying');

  const blocked = new Set<string>();
  for (const o of combat.obstacles) blocked.add(hexKey(o));
  for (const s of combat.stacks) if (s.id !== stackId) blocked.add(hexKey(s.pos));

  if (flying) {
    const out: OffsetPos[] = [];
    for (let col = 0; col < COMBAT_COLS; col++) {
      for (let row = 0; row < COMBAT_ROWS; row++) {
        const p = { col, row };
        if (sameHex(p, stack.pos)) continue;
        if (hexDistance(stack.pos, p) > speed) continue;
        if (blocked.has(hexKey(p))) continue;
        out.push(p);
      }
    }
    return out;
  }

  const dist = new Map<string, number>();
  dist.set(hexKey(stack.pos), 0);
  const queue: OffsetPos[] = [stack.pos];
  const out: OffsetPos[] = [];
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++] as OffsetPos;
    const d = dist.get(hexKey(cur)) as number;
    if (d >= speed) continue;
    for (const n of hexNeighbors(cur)) {
      const nk = hexKey(n);
      if (dist.has(nk) || blocked.has(nk)) continue;
      dist.set(nk, d + 1);
      queue.push(n);
      out.push(n);
    }
  }
  return out;
}

/** La pile peut-elle tirer (tireur, munitions > 0, aucun ennemi adjacent) ? */
export function canShoot(state: GameState, stackId: string): boolean {
  const combat = state.combat;
  if (!combat) return false;
  const stack = combat.stacks.find((s) => s.id === stackId);
  if (!stack) return false;
  if (stack.ammo === null || stack.ammo <= 0) return false;
  const adjacent = combat.stacks.some(
    (s) => s.side !== stack.side && s.count > 0 && hexDistance(s.pos, stack.pos) === 1,
  );
  return !adjacent;
}

/**
 * Ligne de vue (C-LOS, doc 02 §5.4) : un **obstacle** sur le segment strict
 * entre `from` et `to` bloque la vue ; les **piles** ne bloquent pas (décision
 * design 2026-07-10). Pure (lit `combat.obstacles`), déterministe.
 */
export function hasLineOfSight(combat: CombatState, from: OffsetPos, to: OffsetPos): boolean {
  const blocked = new Set<string>();
  for (const o of combat.obstacles) blocked.add(hexKey(o));
  const line = hexLine(from, to);
  // Hexes STRICTEMENT intermédiaires (on exclut le tireur et la cible).
  for (let i = 1; i < line.length - 1; i++) {
    if (blocked.has(hexKey(line[i] as OffsetPos))) return false;
  }
  return true;
}

/**
 * La pile peut-elle **tirer sur cette cible** (C-LOS) : tireur en mode tir
 * (`canShoot`) ET ligne de vue dégagée jusqu'à la cible. Un tireur sans ligne
 * de vue tombe en mêlée (comme au contact) — jamais de tir « à travers » un
 * obstacle. C'est le critère par cible partagé par la validation, la
 * résolution (`applyAttack`), la préviz (`estimateDamage`) et l'UI/IA.
 */
export function canShootTarget(state: GameState, stackId: string, targetId: string): boolean {
  const combat = state.combat;
  if (!combat) return false;
  if (!canShoot(state, stackId)) return false;
  const stack = combat.stacks.find((s) => s.id === stackId);
  const target = combat.stacks.find((s) => s.id === targetId);
  if (!stack || !target) return false;
  return hasLineOfSight(combat, stack.pos, target.pos);
}

/**
 * Piles ennemies que la pile active peut attaquer ce tour-ci (remédiation
 * CL9) : tireur non entravé ⇒ toutes les cibles vivantes ; sinon les cibles
 * adjacentes ou dont un hex adjacent est atteignable. Helper pur consommé par
 * le client (surbrillances) à la place d'une réimplémentation. L'IA
 * (`ai.ts`) garde son propre parcours scoré `{target, from}` (déterminisme).
 */
export function attackableTargets(state: GameState, stackId: string): CombatStack[] {
  const combat = state.combat;
  if (!combat) return [];
  const stack = combat.stacks.find((s) => s.id === stackId);
  if (!stack) return [];
  // C-LOS : le mode tir se décide PAR CIBLE (ligne de vue) ⇒ une cible sans LoS
  // n'est atteignable qu'en mêlée. On calcule toujours la portée de mêlée.
  const shootMode = canShoot(state, stackId);
  const reachSet = new Set(reachableHexes(state, stackId).map(hexKey));
  return combat.stacks.filter((s) => {
    if (s.side === stack.side || s.count <= 0) return false;
    if (shootMode && hasLineOfSight(combat, stack.pos, s.pos)) return true; // tir
    return hexDistance(stack.pos, s.pos) === 1 || hexNeighbors(s.pos).some((p) => reachSet.has(hexKey(p)));
  });
}

/**
 * Hex d'origine candidats pour attaquer `targetId` en mêlée : la pile active
 * elle-même si déjà adjacente, sinon les hex atteignables adjacents à la
 * cible. Renvoie l'ENSEMBLE (non ordonné) — la *politique* de choix reste au
 * consommateur (le client prend le plus proche, l'IA le mieux scoré).
 */
export function meleeOriginsFor(state: GameState, stackId: string, targetId: string): OffsetPos[] {
  const combat = state.combat;
  if (!combat) return [];
  const stack = combat.stacks.find((s) => s.id === stackId);
  const target = combat.stacks.find((s) => s.id === targetId);
  if (!stack || !target) return [];
  if (hexDistance(stack.pos, target.pos) === 1) return [stack.pos];
  const reachSet = new Set(reachableHexes(state, stackId).map(hexKey));
  return hexNeighbors(target.pos).filter((p) => reachSet.has(hexKey(p)));
}

export function validateCombatAction(state: GameState, cmd: { action: CombatActionInput }): CommandError | null {
  const combat = state.combat;
  if (!combat) return { code: 'noCombat', message: 'aucun combat en cours' };
  const stack = combat.stacks.find((s) => s.id === combat.activeStackId);
  if (!stack) return { code: 'invalidAction', message: 'aucune pile active' };
  if (stack.side !== combat.playerSide)
    return { code: 'invalidAction', message: 'ce n’est pas au joueur de jouer' };
  const def = state.unitCatalog[stack.unitId];
  if (!def) return { code: 'invalidAction', message: `unité inconnue '${stack.unitId}'` };

  const action = cmd.action;
  switch (action.type) {
    case 'move': {
      const reachable = reachableHexes(state, stack.id);
      if (!reachable.some((p) => sameHex(p, action.to)))
        return { code: 'invalidAction', message: 'hex non atteignable' };
      return null;
    }
    case 'attack': {
      const target = combat.stacks.find((s) => s.id === action.targetStackId);
      if (!target || target.side === stack.side || target.count <= 0)
        return { code: 'invalidAction', message: 'cible invalide' };
      // C-LOS : tir autorisé seulement avec ligne de vue sur CETTE cible ;
      // sinon (obstacle sur le segment) le tireur doit frapper en mêlée.
      if (canShootTarget(state, stack.id, target.id)) return null;
      const dist = hexDistance(stack.pos, target.pos);
      const from = action.from;
      // A1 (CRITIQUE) : `from` doit TOUJOURS être validé quand fourni — y compris
      // cible déjà adjacente. Sans ça, `applyAttack` téléportait la pile sur le
      // `from` arbitraire (hors plateau/sur obstacle/sur une autre pile) avant de
      // frapper. Sans `from`, frappe sur place autorisée seulement si adjacent.
      if (!from) {
        if (dist === 1) return null;
        return { code: 'invalidAction', message: 'cible non adjacente : hex de départ requis' };
      }
      if (hexDistance(from, target.pos) !== 1)
        return { code: 'invalidAction', message: 'hex de départ non adjacent à la cible' };
      // `from` accepté s'il est la position actuelle (déjà adjacent) ou atteignable.
      if (!sameHex(from, stack.pos) && !reachableHexes(state, stack.id).some((p) => sameHex(p, from)))
        return { code: 'invalidAction', message: 'hex de départ inatteignable' };
      return null;
    }
    case 'wait':
      if (stack.waited) return { code: 'invalidAction', message: 'attente déjà utilisée ce round' };
      return null;
    case 'defend':
      return null;
  }
}

/** Résout l'action de `stackId` (pile active), avance le tour — sans jouer l'IA (voir index.ts). */
export function applyAction(
  draft: Draft,
  events: GameEvent[],
  stackId: string,
  action: CombatActionInput,
): void {
  switch (action.type) {
    case 'move':
      applyMove(draft, events, stackId, action);
      break;
    case 'attack':
      applyAttack(draft, events, stackId, action);
      break;
    case 'wait':
      applyWait(draft, events, stackId);
      break;
    case 'defend':
      applyDefend(draft, events, stackId);
      break;
  }
}

function afterAction(
  draft: Draft,
  events: GameEvent[],
  actorId: string,
  wasFirstAction: boolean,
  actionType: CombatActionInput['type'],
): void {
  const combat = draft.combat;
  if (!combat) return; // combat déjà terminé (checkCombatEnd a nullifié draft.combat)
  const actor = combat.stacks.find((s) => s.id === actorId);
  if (actor && actionType !== 'wait') {
    actor.acted = true;
    if (wasFirstAction) {
      const rules = combatRules(draft);
      const moral = moraleOf(actor, combat, draft);
      if (moral > 0) {
        const roll = rollRange(draft.rng, 0, 99);
        draft.rng = roll.state;
        if (roll.value < moral * rules.moraleChancePerPoint * 100) {
          events.push({ type: 'MoraleTriggered', stackId: actor.id, positive: true });
          actor.defending = false;
          combat.activeStackId = actor.id;
          events.push({ type: 'CombatTurnStarted', stackId: actor.id });
          return;
        }
      }
    }
  }
  advanceTurn(draft, events);
}

function applyMove(
  draft: Draft,
  events: GameEvent[],
  stackId: string,
  action: Extract<CombatActionInput, { type: 'move' }>,
): void {
  const combat = draft.combat as NonNullable<Draft['combat']>;
  const stack = combat.stacks.find((s) => s.id === stackId) as CombatStack;
  const wasFirstAction = !stack.acted;
  const from = { ...stack.pos };
  stack.pos = { ...action.to };
  // Symbiose (doc 14 §2) : un déplacement volontaire rompt l'enracinement.
  stack.symbiosisStacks = 0;
  events.push({ type: 'StackMoved', stackId: stack.id, from, to: { ...stack.pos } });
  afterAction(draft, events, stack.id, wasFirstAction, 'move');
}

function applyWait(draft: Draft, events: GameEvent[], stackId: string): void {
  const combat = draft.combat as NonNullable<Draft['combat']>;
  const stack = combat.stacks.find((s) => s.id === stackId) as CombatStack;
  stack.waited = true;
  afterAction(draft, events, stack.id, false, 'wait');
}

function applyDefend(draft: Draft, events: GameEvent[], stackId: string): void {
  const combat = draft.combat as NonNullable<Draft['combat']>;
  const stack = combat.stacks.find((s) => s.id === stackId) as CombatStack;
  const wasFirstAction = !stack.acted;
  stack.defending = true;
  // Symbiose (doc 14 §2) : Défendre enracine un palier de plus (plafonné).
  const def = draft.unitCatalog[stack.unitId];
  const params = def ? symbiosisParams(def) : null;
  if (params) stack.symbiosisStacks = Math.min(params.maxStacks, stack.symbiosisStacks + 1);
  afterAction(draft, events, stack.id, wasFirstAction, 'defend');
}

function applyAttack(
  draft: Draft,
  events: GameEvent[],
  stackId: string,
  action: Extract<CombatActionInput, { type: 'attack' }>,
): void {
  const combat = draft.combat as NonNullable<Draft['combat']>;
  const rules = combatRules(draft);
  const catalog = draft.unitCatalog;
  const attacker = combat.stacks.find((s) => s.id === stackId) as CombatStack;
  const attackerDef = catalog[attacker.unitId];
  const target = combat.stacks.find((s) => s.id === action.targetStackId);
  if (!attackerDef || !target) return; // défensif : déjà validé
  const targetDef = catalog[target.unitId];
  if (!targetDef) return;
  const wasFirstAction = !attacker.acted;
  // C-LOS : tir seulement avec ligne de vue sur la cible ; sinon mêlée forcée.
  const ranged = canShootTarget(draft, attacker.id, target.id);
  const hasDoubleAttack = hasAbility(attackerDef, 'doubleAttack');

  if (ranged) {
    let shots = hasDoubleAttack ? 2 : 1;
    shots = Math.min(shots, attacker.ammo ?? 0);
    for (let i = 0; i < shots; i++) {
      if (!combat.stacks.some((s) => s.id === target.id)) break;
      attacker.ammo = (attacker.ammo ?? 0) - 1;
      const { targetDied } = performStrike(draft, events, {
        striker: attacker,
        victim: target,
        strikerDef: attackerDef,
        victimDef: targetDef,
        meleePenalized: false,
        retaliation: false,
        ranged: true,
        rules,
      });
      if (checkCombatEnd(draft, events)) return;
      if (targetDied) break;
    }
  } else {
    // `charge` (A2a, doc 03/04 §3) : bonus = `perHex × hexes parcourus` AVANT la
    // frappe — mesuré depuis la position d'origine, donc capturé avant le
    // repositionnement. Une frappe sur place (pas de `from`) ne charge pas.
    const chargeMoved = action.from ? hexDistance(attacker.pos, action.from) : 0;
    const chargeBonus = chargePerHex(attackerDef) * chargeMoved;
    // `strikeAndReturn` (Lame du Serment, doc 05 §4, A2b) : la pile frappe puis
    // regagne sa case d'origine et n'essuie AUCUNE riposte (repli « harpie »).
    const strikeAndReturn = hasAbility(attackerDef, 'strikeAndReturn');
    const originPos = { ...attacker.pos };
    // Repositionnement avant la frappe (validé par `validateCombatAction`, A1) —
    // ignoré si `from` est déjà la position actuelle (pas de StackMoved à vide).
    if (action.from && !sameHex(action.from, attacker.pos)) {
      const from = { ...attacker.pos };
      attacker.pos = { ...action.from };
      events.push({ type: 'StackMoved', stackId: attacker.id, from, to: { ...attacker.pos } });
    }
    const meleePenalized = isShooterMeleePenalized(attackerDef);
    const first = performStrike(draft, events, {
      striker: attacker,
      victim: target,
      strikerDef: attackerDef,
      victimDef: targetDef,
      meleePenalized,
      retaliation: false,
      ranged: false,
      rules,
      chargeBonus,
    });
    if (checkCombatEnd(draft, events)) return;
    let attackerAlive = combat.stacks.some((s) => s.id === attacker.id);
    if (!first.targetDied && attackerAlive) {
      // `noRetaliation` (doc 02 §5.4) est une capacité de l'ATTAQUANT : elle prive
      // la victime de riposte (Vampire doc 04, Manticore doc 05). A2.
      // `unlimitedRetaliation` (Griffon, doc 03 §3, A2a) : ripostes non limitées.
      const canRetaliate =
        (target.retaliationsLeft > 0 || hasAbility(targetDef, 'unlimitedRetaliation')) &&
        !hasAbility(attackerDef, 'noRetaliation') &&
        !strikeAndReturn;
      if (canRetaliate) {
        if (target.retaliationsLeft > 0) target.retaliationsLeft -= 1;
        const retMeleePenalized = isShooterMeleePenalized(targetDef);
        performStrike(draft, events, {
          striker: target,
          victim: attacker,
          strikerDef: targetDef,
          victimDef: attackerDef,
          meleePenalized: retMeleePenalized,
          retaliation: true,
          ranged: false,
          rules,
        });
        if (checkCombatEnd(draft, events)) return;
        attackerAlive = combat.stacks.some((s) => s.id === attacker.id);
      }
    }
    const targetAlive = combat.stacks.some((s) => s.id === target.id);
    if (hasDoubleAttack && attackerAlive && targetAlive) {
      performStrike(draft, events, {
        striker: attacker,
        victim: target,
        strikerDef: attackerDef,
        victimDef: targetDef,
        meleePenalized,
        retaliation: false,
        ranged: false,
        rules,
        chargeBonus,
      });
      if (checkCombatEnd(draft, events)) return;
    }
    // `strikeAndReturn` (A2b) : retour à la case d'origine si la pile a bougé et
    // survit encore (la case d'origine est forcément libre — seule cette pile
    // l'a quittée). Aucune riposte n'a été essuyée (repli).
    if (strikeAndReturn && combat.stacks.some((s) => s.id === attacker.id) && !sameHex(attacker.pos, originPos)) {
      const from = { ...attacker.pos };
      attacker.pos = { ...originPos };
      events.push({ type: 'StackMoved', stackId: attacker.id, from, to: { ...originPos } });
    }
  }
  // Symbiose (doc 14 §2) : l'attaque VOLONTAIRE dépense l'enracinement (le bonus a
  // profité aux frappes ci-dessus) — remis à 0. La riposte, elle, ne réinitialise pas.
  attacker.symbiosisStacks = 0;
  afterAction(draft, events, attacker.id, wasFirstAction, 'attack');
}
