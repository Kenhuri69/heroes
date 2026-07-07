import { grantXp } from '../adventure/experience';
import { applyFactionVictoryEffects } from '../faction/effects';
import { rewardHuntContract } from '../town/hunt-contract';
import type { GameEvent } from '../core/events';
import { rollRange } from '../core/rng';
import { evaluateOutcome } from '../scenario/outcome';
import type { Draft } from './draft';
import { collectCasualties, combatRules, effectiveSpeed, moraleOf } from './state-helpers';
import type { CombatSideId, CombatStack, CombatState } from './types';

/**
 * Ordre de jeu par vagues (doc 02 §5.2) : vitesse décroissante, attente en fin
 * de round par vitesse croissante ; moral négatif peut sauter un tour au
 * moment où il arrive. Fin de combat : victoire/conséquences/CombatEnded.
 */

/** Vitesse effective + `speedMod` des statuts actifs (buff/debuff de vitesse, doc 02 §1.4). */
function speedWithStatus(stack: CombatStack, combat: CombatState, catalog: Draft['unitCatalog']): number {
  return effectiveSpeed(stack, combat, catalog) + stack.statuses.reduce((sum, s) => sum + s.speedMod, 0);
}

function pickNext(
  candidates: CombatStack[],
  combat: CombatState,
  catalog: Draft['unitCatalog'],
  direction: 'asc' | 'desc',
): CombatStack | undefined {
  const sorted = [...candidates].sort((a, b) => {
    const sa = speedWithStatus(a, combat, catalog);
    const sb = speedWithStatus(b, combat, catalog);
    if (sa !== sb) return direction === 'desc' ? sb - sa : sa - sb;
    if (a.side !== b.side) return a.side === 'attacker' ? -1 : 1;
    return a.slot - b.slot;
  });
  return sorted[0];
}

/**
 * Choisit la prochaine pile active : vagues normales (vitesse décroissante),
 * puis piles en attente (vitesse croissante), sinon nouveau round. Applique
 * le saut de tour pour moral négatif. Émet CombatRoundStarted/CombatTurnStarted.
 */
export function advanceTurn(draft: Draft, events: GameEvent[]): void {
  const combat = draft.combat;
  if (!combat || combat.finished) return;
  const rules = combatRules(draft);
  for (;;) {
    const alive = combat.stacks;
    const mainPhase = alive.filter((s) => !s.acted && !s.waited);
    const waitPhase = alive.filter((s) => !s.acted && s.waited);
    let next = mainPhase.length > 0 ? pickNext(mainPhase, combat, draft.unitCatalog, 'desc') : undefined;
    if (!next) next = waitPhase.length > 0 ? pickNext(waitPhase, combat, draft.unitCatalog, 'asc') : undefined;
    if (!next) {
      // Round terminé : personne à faire jouer — round suivant. Le héros
      // regagne son sort (décision plan phase-3.2 #2) et les statuts de
      // sort expirent (roundsLeft décrémenté, retirés à 0 — doc 02 §1.4).
      combat.round += 1;
      combat.heroCastThisRound = false;
      for (const s of alive) {
        s.acted = false;
        s.waited = false;
        s.retaliationsLeft = 1;
        if (s.statuses.length > 0) {
          s.statuses = s.statuses
            .map((st) => ({ ...st, roundsLeft: st.roundsLeft - 1 }))
            .filter((st) => st.roundsLeft > 0);
        }
      }
      events.push({ type: 'CombatRoundStarted', round: combat.round });
      continue;
    }
    // Immobilisation (doc 05 §3.1 `pinningShot`) : la pile saute son tour, la
    // charge d'immobilisation baisse d'un cran (même patron que le malus moral).
    if (next.immobilizedRounds > 0) {
      next.immobilizedRounds -= 1;
      next.acted = true;
      events.push({ type: 'StackImmobilized', stackId: next.id });
      continue;
    }
    const moral = moraleOf(next, combat, draft);
    if (moral < 0) {
      const roll = rollRange(draft.rng, 0, 99);
      draft.rng = roll.state;
      if (roll.value < Math.abs(moral) * rules.moraleChancePerPoint * 100) {
        next.acted = true;
        events.push({ type: 'MoraleTriggered', stackId: next.id, positive: false });
        continue;
      }
    }
    // Le bonus de défense n'est levé que lorsque la pile prend RÉELLEMENT son
    // tour (remédiation R1) : une pile sautée (immobilisation/moral négatif)
    // n'a pas agi, elle conserve sa posture défensive (doc 02 §5.2).
    next.defending = false;
    combat.activeStackId = next.id;
    events.push({ type: 'CombatTurnStarted', stackId: next.id });
    return;
  }
}

/**
 * Fin de combat : un camp sans pile ⇒ victoire de l'autre. Applique les
 * conséquences (armée du héros, gardien) AVANT de nullifier `draft.combat`.
 * Retourne `true` si le combat est bien terminé (le code appelant doit
 * s'arrêter immédiatement, ne pas tenter d'avancer le tour).
 */
export function checkCombatEnd(draft: Draft, events: GameEvent[]): boolean {
  const combat = draft.combat;
  if (!combat) return true;
  const attackerAlive = combat.stacks.some((s) => s.side === 'attacker' && s.count > 0);
  const defenderAlive = combat.stacks.some((s) => s.side === 'defender' && s.count > 0);
  if (attackerAlive && defenderAlive) return false;
  const winner: CombatSideId = attackerAlive ? 'attacker' : 'defender';
  combat.finished = true;
  combat.winner = winner;
  combat.activeStackId = null;
  const casualties = collectCasualties(combat);
  applyConsequences(draft, combat, winner, casualties, events);
  // Un héros peut disparaître (défaite) : conditions de victoire/défaite
  // (doc 02 §6, plan phase-3.5) — no-op hors scénario.
  evaluateOutcome(draft, events);
  events.push({ type: 'CombatEnded', winner, playerSide: combat.playerSide, casualties });
  grantHeroCombatXp(draft, combat, winner, casualties, events);
  // Chance de fontaine (doc 02 §2.2, effet `luck`) : consommée à la FIN du
  // combat, pour chaque héros engagé encore vivant (le vaincu a disparu).
  for (const heroId of [combat.attackerHeroId, combat.defenderHeroId]) {
    const hero = heroId ? draft.heroes.find((h) => h.id === heroId) : undefined;
    if (hero) hero.visitLuck = 0;
  }
  draft.combat = null;
  return true;
}

/**
 * XP d'aventure (doc 02 §1.2, décision plan #2) : victoire du héros (toujours
 * attaquant en interception, cf. `beginGuardianCombat`) uniquement — arène
 * (`heroId` null) et défaite n'accordent rien. `XP = Σ(PV unitaire × pertes
 * infligées au camp adverse) × xpPerHpKilled`, arrondi entier au total.
 */
function grantHeroCombatXp(
  draft: Draft,
  combat: CombatState,
  winner: CombatSideId,
  casualties: { side: CombatSideId; unitId: string; lost: number }[],
  events: GameEvent[],
): void {
  // D1 : le héros du camp VAINQUEUR gagne l'XP — plus seulement l'attaquant : un
  // héros qui l'emporte en DÉFENSE (siège subi) en bénéficie aussi. Arène (aucun
  // héros lié) : rien. XP = Σ(PV unitaire × pertes infligées au camp PERDANT).
  const winnerHeroId = winner === 'attacker' ? combat.attackerHeroId : combat.defenderHeroId;
  if (!winnerHeroId) return;
  const loserSide: CombatSideId = winner === 'attacker' ? 'defender' : 'attacker';
  const xpPerHpKilled = draft.config?.hero.xpPerHpKilled ?? 0;
  const hpLost = casualties
    .filter((c) => c.side === loserSide)
    .reduce((sum, c) => sum + (draft.unitCatalog[c.unitId]?.stats.hp ?? 0) * c.lost, 0);
  grantXp(draft, events, winnerHeroId, Math.round(hpLost * xpPerHpKilled));
}

function applyConsequences(
  draft: Draft,
  combat: CombatState,
  winner: CombatSideId,
  casualties: { side: CombatSideId; unitId: string; lost: number }[],
  events: GameEvent[],
): void {
  if (!combat.heroId) return; // arène : rien à appliquer
  const hero = draft.heroes.find((h) => h.id === combat.heroId);
  if (winner === 'attacker') {
    if (hero) {
      // Reconstruit l'armée depuis les survivants — SAUF les machines de guerre
      // (doc 02 §5) : elles persistent sur `hero.warMachines`, jamais dans l'armée
      // (sinon elles seraient absorbées comme pile normale après le combat).
      hero.army = combat.stacks
        .filter((s) => s.side === 'attacker' && s.count > 0 && !hero.warMachines.includes(s.unitId))
        .map((s) => ({ unitId: s.unitId, count: s.count }));
      // Effets de faction déclaratifs post-victoire (doc 06 §4) — après la
      // reconstruction de l'armée, jamais un nom de faction dans le moteur.
      applyFactionVictoryEffects(draft, combat, hero, casualties, events);
    }
    if (draft.map && combat.guardianObjectId) {
      // Contrat de chasse (doc 05 §3.3) : si ce gardien était la cible assignée,
      // crédite la récompense — avant de retirer l'objet de la carte.
      if (hero) rewardHuntContract(draft, hero, combat.guardianObjectId, events);
      const idx = draft.map.objects.findIndex((o) => o.id === combat.guardianObjectId);
      if (idx !== -1) draft.map.objects.splice(idx, 1);
    }
    // Siège gagné (doc 02 §4.1, Alpha 4.13) : la garnison est anéantie ⇒ la ville
    // change de main, garnison vidée.
    if (combat.townId && hero) {
      const town = draft.towns.find((t) => t.id === combat.townId);
      if (town) {
        town.ownerPlayerId = hero.playerId;
        town.garrison = [];
        events.push({ type: 'TownCaptured', townId: town.id, playerId: hero.playerId });
      }
    }
  } else {
    if (hero) {
      const idx = draft.heroes.findIndex((h) => h.id === combat.heroId);
      if (idx !== -1) draft.heroes.splice(idx, 1);
    }
    if (draft.map && combat.guardianObjectId) {
      const obj = draft.map.objects.find((o) => o.id === combat.guardianObjectId);
      if (obj && obj.type === 'guardian') {
        obj.count = combat.stacks
          .filter((s) => s.side === 'defender')
          .reduce((sum, s) => sum + s.count, 0);
      }
    }
    // Siège repoussé : la garnison survivante est réécrite sur la ville.
    if (combat.townId) {
      const town = draft.towns.find((t) => t.id === combat.townId);
      if (town) {
        town.garrison = combat.stacks
          .filter((s) => s.side === 'defender' && s.count > 0)
          .map((s) => ({ unitId: s.unitId, count: s.count }));
      }
    }
  }
}
