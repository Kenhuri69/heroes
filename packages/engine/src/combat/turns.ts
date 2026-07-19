import { grantXp } from '../adventure/experience';
import { rewardGuardianDefeat } from '../adventure/guardian-reward';
import { queueGuardianRespawn } from '../adventure/respawn';
import { fireFlagCaptureTrigger } from '../adventure/triggers';
import { revealStructure } from '../adventure/vision';
import { applyFactionVictoryEffects } from '../faction/effects';
import { rewardHuntContract } from '../town/hunt-contract';
import type { GameEvent } from '../core/events';
import { armyStrength } from '../core/power';
import { rollRange } from '../core/rng';
import { evaluateOutcome } from '../scenario/outcome';
import { tryRebirth } from './death';
import type { Draft } from './draft';
import { collectCasualties, collectSurvivors, combatRules, compareInitiative, hasAbility, moraleOf, otherSide, recordLoss, recordRevive, stackLostSoFar } from './state-helpers';
import { COMBAT_ROWS } from './hex';
import type { CombatSideId, CombatStack, CombatState } from './types';

/**
 * Ordre de jeu par vagues (doc 02 §5.2) : vitesse décroissante, attente en fin
 * de round par vitesse croissante ; moral négatif peut sauter un tour au
 * moment où il arrive. Fin de combat : victoire/conséquences/CombatEnded.
 */

function pickNext(
  candidates: CombatStack[],
  combat: CombatState,
  catalog: Draft['unitCatalog'],
  direction: 'asc' | 'desc',
  state: Draft,
): CombatStack | undefined {
  const sorted = [...candidates].sort((a, b) => compareInitiative(a, b, combat, catalog, direction, state));
  return sorted[0];
}

/**
 * Tick de poison au début de round (A2f, `poisonSting` doc 05 §4) : chaque pile
 * vivante portant un/des statut(s) toxique(s) (`damagePerRound > 0`) subit la
 * SOMME de leurs dégâts (plats, sans RNG). Peut tuer — la pile est alors retirée.
 * Appelé AVANT la décroissance des statuts pour que la dernière tranche compte.
 * Retourne `true` si au moins une pile est morte (⇒ vérifier la fin de combat).
 */
function applyPoisonTicks(draft: Draft, events: GameEvent[]): boolean {
  const combat = draft.combat;
  if (!combat) return false;
  let anyDeath = false;
  for (const stack of combat.stacks) {
    if (stack.count <= 0) continue;
    const poison = stack.statuses.reduce((sum, st) => sum + Math.max(0, st.damagePerRound), 0);
    if (poison <= 0) continue;
    const def = draft.unitCatalog[stack.unitId];
    if (!def) continue;
    const pool = (stack.count - 1) * def.stats.hp + stack.firstHp;
    const remaining = Math.max(0, pool - poison);
    const newCount = remaining <= 0 ? 0 : Math.min(stack.count, Math.ceil(remaining / def.stats.hp));
    const kills = stack.count - newCount;
    stack.count = newCount;
    stack.firstHp = newCount > 0 ? remaining - (newCount - 1) * def.stats.hp : 0;
    recordLoss(combat, stack, kills);
    events.push({ type: 'StackPoisoned', stackId: stack.id, damage: Math.min(poison, pool), kills });
    if (newCount <= 0 && !tryRebirth(combat, stack, def, events)) {
      // Renaissance (CAP-LIFE.2) : si la pile ne renaît pas, elle meurt — le splice
      // reste batché après la boucle (on itère `combat.stacks`).
      events.push({ type: 'StackDied', stackId: stack.id });
      anyDeath = true;
    }
  }
  if (anyDeath) {
    for (let i = combat.stacks.length - 1; i >= 0; i--) {
      if ((combat.stacks[i] as CombatStack).count <= 0) combat.stacks.splice(i, 1);
    }
  }
  return anyDeath;
}

/**
 * Choisit la prochaine pile active : vagues normales (vitesse décroissante),
 * puis piles en attente (vitesse croissante), sinon nouveau round. Applique
 * le saut de tour pour moral négatif. Émet CombatRoundStarted/CombatTurnStarted.
 */
/**
 * C-SIEGE2.6 : au début d'un round, une catapulte (`siegeBreaker`) encore vivante
 * côté assaillant bombarde UN segment de rempart (le plus proche du centre de la
 * porte, pour élargir la brèche de façon contiguë). Segment à 0 PV ⇒ ouvert. No-op
 * hors siège avec catapulte (`siegeWallHp` absent) ⇒ murs indestructibles.
 */
function bombardWalls(draft: Draft, events: GameEvent[]): void {
  const combat = draft.combat;
  if (!combat?.siegeWallHp || !combat.siegeWalls || combat.siegeWalls.length === 0) return;
  const catapult = combat.stacks.find((s) => {
    const def = draft.unitCatalog[s.unitId];
    return s.side === 'attacker' && s.count > 0 && !!def && hasAbility(def, 'siegeBreaker');
  });
  if (!catapult) return; // catapulte détruite ⇒ plus d'érosion
  const hp = combat.siegeWallHp;
  const center = (COMBAT_ROWS - 1) / 2;
  const target = combat.siegeWalls
    .filter((w) => (hp[`${w.col},${w.row}`] ?? 0) > 0)
    .sort((a, b) => Math.abs(a.row - center) - Math.abs(b.row - center) || a.row - b.row)[0];
  if (!target) return;
  const def = draft.unitCatalog[catapult.unitId]!;
  const [dmin, dmax] = def.stats.damage;
  const roll = rollRange(draft.rng, dmin, dmax);
  draft.rng = roll.state;
  const key = `${target.col},${target.row}`;
  const left = (hp[key] ?? 0) - roll.value;
  if (left <= 0) {
    delete hp[key];
    combat.siegeWalls = combat.siegeWalls.filter((w) => !(w.col === target.col && w.row === target.row));
    events.push({ type: 'WallBombarded', col: target.col, row: target.row, destroyed: true });
  } else {
    hp[key] = left;
    events.push({ type: 'WallBombarded', col: target.col, row: target.row, destroyed: false });
  }
}

/**
 * Machines de soutien (doc 18 B2, doc 02 §5) : au début de chaque round (dès le
 * 2ᵉ — les transitions seulement, comme le poison), toute pile vivante portant
 * une capacité de soutien agit passivement :
 * - `healPerRound { amount }` : soigne la pile ALLIÉE la plus blessée (manque
 *   de PV maximal, égalité départagée par l'ordre du tableau — déterministe),
 *   plafonnée à son effectif initial (même patron que `lifeDrain`) ;
 * - `replenishAmmo { amount }` : recharge chaque tireur allié entamé, plafonné
 *   à sa réserve initiale (param `ammo` de sa capacité `shooter`).
 * Générique : aucune notion de « machine » ici — la capacité fait foi.
 */
function applySupportTicks(draft: Draft, events: GameEvent[]): void {
  const combat = draft.combat;
  if (!combat) return;
  for (const support of combat.stacks) {
    if (support.count <= 0) continue;
    const supportDef = draft.unitCatalog[support.unitId];
    if (!supportDef) continue;
    const healAmount = Number(supportDef.abilities.find((a) => a.id === 'healPerRound')?.params?.['amount'] ?? 0);
    if (healAmount > 0) {
      let target: CombatStack | undefined;
      let worstMissing = 0;
      for (const s of combat.stacks) {
        if (s.side !== support.side || s.id === support.id || s.count <= 0) continue;
        const def = draft.unitCatalog[s.unitId];
        if (!def) continue;
        const pool = (s.count - 1) * def.stats.hp + s.firstHp;
        const missing = (s.count + stackLostSoFar(combat, s)) * def.stats.hp - pool;
        if (missing > worstMissing) {
          worstMissing = missing;
          target = s;
        }
      }
      if (target) {
        const def = draft.unitCatalog[target.unitId]!;
        const pool = (target.count - 1) * def.stats.hp + target.firstHp;
        // Plafond intra-pile + relève dans la limite de l'effectif initial —
        // même règle que `lifeDrain`/le soin de sort (combat/damage.ts).
        const maxCount = target.count + stackLostSoFar(combat, target);
        const newPool = Math.min(maxCount * def.stats.hp, pool + healAmount);
        if (newPool > pool) {
          const newCount = Math.min(maxCount, Math.max(1, Math.ceil(newPool / def.stats.hp)));
          recordRevive(combat, target, newCount - target.count);
          target.count = newCount;
          target.firstHp = newPool - (newCount - 1) * def.stats.hp;
          events.push({ type: 'StackHealed', stackId: target.id, amount: newPool - pool });
        }
      }
    }
    const ammoAmount = Number(supportDef.abilities.find((a) => a.id === 'replenishAmmo')?.params?.['amount'] ?? 0);
    if (ammoAmount > 0) {
      for (const s of combat.stacks) {
        if (s.side !== support.side || s.id === support.id || s.count <= 0 || s.ammo === null) continue;
        const def = draft.unitCatalog[s.unitId];
        if (!def) continue;
        const initial = Number(def.abilities.find((a) => a.id === 'shooter')?.params?.['ammo'] ?? 0);
        if (initial <= 0 || s.ammo >= initial) continue;
        const restored = Math.min(initial, s.ammo + ammoAmount) - s.ammo;
        s.ammo += restored;
        events.push({ type: 'StackAmmoReplenished', stackId: s.id, amount: restored });
      }
    }
  }
}

export function advanceTurn(draft: Draft, events: GameEvent[]): void {
  const combat = draft.combat;
  if (!combat || combat.finished) return;
  const rules = combatRules(draft);
  for (;;) {
    const alive = combat.stacks;
    const mainPhase = alive.filter((s) => !s.acted && !s.waited);
    const waitPhase = alive.filter((s) => !s.acted && s.waited);
    let next = mainPhase.length > 0 ? pickNext(mainPhase, combat, draft.unitCatalog, 'desc', draft) : undefined;
    if (!next) next = waitPhase.length > 0 ? pickNext(waitPhase, combat, draft.unitCatalog, 'asc', draft) : undefined;
    if (!next) {
      // Round terminé : personne à faire jouer — round suivant. Le héros
      // regagne son sort (décision plan phase-3.2 #2) et les statuts de
      // sort expirent (roundsLeft décrémenté, retirés à 0 — doc 02 §1.4).
      combat.round += 1;
      // Mort subite (doc 18 B4, MMHO) : à l'ATTEINTE du round configuré, le
      // combat est résolu de force — le camp au plus fort `armyStrength`
      // restant l'emporte (égalité ⇒ défenseur, convention B17), conséquences
      // normales. Opt-in par données (PvP en ligne) ; absent ⇒ aucune borne.
      const sd = rules.suddenDeath;
      if (sd && combat.round >= sd.round) {
        const strengthOf = (side: CombatSideId): number =>
          armyStrength(
            combat.stacks
              .filter((s) => s.side === side && s.count > 0)
              .map((s) => ({ unitId: s.unitId, count: s.count })),
            draft.unitCatalog,
          );
        const winner: CombatSideId =
          strengthOf('attacker') > strengthOf('defender') ? 'attacker' : 'defender';
        events.push({ type: 'CombatSuddenDeath', round: combat.round, winner });
        finishCombat(draft, combat, winner, events);
        return;
      }
      combat.heroCastThisRound = [];
      // Retour de jeu 2026-07 : l'attaque du héros est UNE action de héros par
      // round (doc 02 §1 : « agit une fois par round, sort OU attaque »), donc
      // réinitialisée chaque round au même titre que le sort — plus 1×/combat.
      combat.heroAttackUsed = [];
      for (const s of alive) {
        s.acted = false;
        s.waited = false;
        s.retaliationsLeft = 1;
      }
      // A2f : le poison ronge AVANT la décroissance des statuts (dernière tranche
      // incluse) ; s'il vide un camp, le combat s'arrête (fin gérée normalement).
      const poisonKilled = applyPoisonTicks(draft, events);
      for (const s of combat.stacks) {
        if (s.statuses.length > 0) {
          s.statuses = s.statuses
            .map((st) => ({ ...st, roundsLeft: st.roundsLeft - 1 }))
            .filter((st) => st.roundsLeft > 0);
        }
      }
      // Heure de la Curée (F-SCHOOLS.6) : effet de camp à durée en rounds, décru
      // comme les statuts et retiré à expiration.
      if (combat.markedNoRetaliation) {
        combat.markedNoRetaliation.roundsLeft -= 1;
        if (combat.markedNoRetaliation.roundsLeft <= 0) delete combat.markedNoRetaliation;
      }
      if (poisonKilled && checkCombatEnd(draft, events)) return;
      // C-SIEGE2.6 : la catapulte assaillante érode le rempart en début de round.
      bombardWalls(draft, events);
      events.push({ type: 'CombatRoundStarted', round: combat.round });
      // Doc 18 B2 : tente de soins / chariot de munitions — tick passif de round.
      applySupportTicks(draft, events);
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
  finishCombat(draft, combat, attackerAlive ? 'attacker' : 'defender', events);
  return true;
}

/**
 * Termine le combat avec un vainqueur DÉSIGNÉ et les conséquences normales
 * (armée reconstruite, gardien/ville/héros, XP, effets de faction). Partagé
 * entre la fin par anéantissement (`checkCombatEnd`) et la résolution forcée
 * de mort subite (doc 18 B4) — à ne pas confondre avec `endLeftCombat`
 * (leave.ts : le héros SURVIT, aucune conséquence de vainqueur).
 */
function finishCombat(
  draft: Draft,
  combat: CombatState,
  winner: CombatSideId,
  events: GameEvent[],
): void {
  combat.finished = true;
  combat.winner = winner;
  combat.activeStackId = null;
  const casualties = collectCasualties(combat);
  const survivors = collectSurvivors(combat);
  // UX-ENDSTATS : attribuer les pertes de chaque camp au joueur de ce camp AVANT
  // `applyConsequences` (qui peut retirer le héros vaincu, cassant le lien camp→joueur).
  accumulateUnitsLost(draft, combat, casualties);
  applyConsequences(draft, combat, winner, casualties, events);
  // Un héros peut disparaître (défaite) : conditions de victoire/défaite
  // (doc 02 §6, plan phase-3.5) — no-op hors scénario.
  evaluateOutcome(draft, events);
  events.push({ type: 'CombatEnded', winner, playerSide: combat.playerSide, casualties, survivors });
  grantHeroCombatXp(draft, combat, winner, casualties, events);
  // Chance de fontaine (doc 02 §2.2, effet `luck`) : consommée à la FIN du
  // combat, pour chaque héros engagé encore vivant (le vaincu a disparu).
  for (const heroId of [combat.attackerHeroId, combat.defenderHeroId]) {
    const hero = heroId ? draft.heroes.find((h) => h.id === heroId) : undefined;
    if (hero) {
      hero.visitLuck = 0;
      hero.visitMorale = 0; // moral de temple consommé avec la chance de fontaine
    }
  }
  draft.combat = null;
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
  const xp = Math.round(hpLost * xpPerHpKilled);
  // Coop (E4.2, doc 18 E4) : partage ÉGAL de l'XP entre les héros propriétaires
  // du camp attaquant vainqueur. Hors coop (ou victoire en défense) ⇒ un seul
  // héros ⇒ part = total (bit-identique).
  const owners = winner === 'attacker' ? [...coopAttackerOwners(combat)] : [winnerHeroId];
  const share = Math.round(xp / owners.length);
  for (const id of owners) grantXp(draft, events, id, share);
}

/**
 * Conséquences d'un combat héros-vs-héros (H-VS-H, doc 02 §1.5/§5) :
 * - le VAINQUEUR reconstruit son armée depuis ses survivants (machines de guerre
 *   exclues, elles persistent sur `hero.warMachines`) et bénéficie des effets de
 *   faction post-victoire (ex. Nécromancie) ;
 * - le VAINCU est retiré de la partie (il meurt — règle de disparition déjà en
 *   place pour l'attaquant vaincu) ;
 * - DÉPOUILLE (arbitrage doc silencieux, fidélité HoMM) : les artefacts du vaincu
 *   passent au vainqueur (1ers slots libres) ; le surplus va dans SON SAC
 *   (`backpack`, jamais perdu), comme tout autre ramassage d'artefact
 *   (carte/gardien/visitable) — plus de dépôt au sol récupérable par l'ennemi.
 * L'XP du vainqueur est accordée par `grantHeroCombatXp` (PV ennemis tués).
 */
function applyHeroVsHeroConsequences(
  draft: Draft,
  combat: CombatState,
  winner: CombatSideId,
  _casualties: { side: CombatSideId; unitId: string; lost: number }[],
  events: GameEvent[],
): void {
  const winnerId = winner === 'attacker' ? combat.attackerHeroId : combat.defenderHeroId;
  const loserId = winner === 'attacker' ? combat.defenderHeroId : combat.attackerHeroId;
  const winnerHero = draft.heroes.find((h) => h.id === winnerId);
  const loserHero = draft.heroes.find((h) => h.id === loserId);
  if (!winnerHero || !loserHero) return;
  // Armée du vainqueur = survivants de SON camp (machines de guerre exclues).
  winnerHero.army = combat.stacks
    .filter((s) => s.side === winner && s.count > 0 && !winnerHero.warMachines.includes(s.unitId))
    .map((s) => ({ unitId: s.unitId, count: s.count }));
  // B5 : le camp vaincu est l'AUTRE camp — le vainqueur peut être défenseur.
  applyFactionVictoryEffects(draft, combat, winnerHero, _casualties, otherSide(winner), events);
  // Dépouille : artefacts du vaincu → slots libres du vainqueur, surplus au SAC
  // (jamais perdu — même routage que le ramassage carte/gardien/visitable).
  const spoils = loserHero.artifacts.filter((a): a is string => a !== null);
  for (const artifactId of spoils) {
    const slot = winnerHero.artifacts.indexOf(null);
    if (slot !== -1) winnerHero.artifacts[slot] = artifactId;
    else (winnerHero.backpack ??= []).push(artifactId);
  }
  // Le vaincu meurt (retiré de la partie).
  const idx = draft.heroes.findIndex((h) => h.id === loserHero.id);
  if (idx !== -1) draft.heroes.splice(idx, 1);
}

/**
 * UX-ENDSTATS (doc 08 §2.5) : cumule les unités perdues par joueur. Les pertes
 * d'un camp reviennent au joueur du héros lié à ce camp (`attackerHeroId`/
 * `defenderHeroId` → `hero.playerId`) ; un camp neutre (gardien, sans héros)
 * n'est attribué à personne. Générique — aucune faction, aucun `if` de faction.
 */
function accumulateUnitsLost(
  draft: Draft,
  combat: CombatState,
  casualties: { side: CombatSideId; unitId: string; lost: number }[],
): void {
  const playerForSide = (side: CombatSideId): string | undefined => {
    const heroId = side === 'attacker' ? combat.attackerHeroId : combat.defenderHeroId;
    return heroId ? draft.heroes.find((h) => h.id === heroId)?.playerId : undefined;
  };
  const attackerPlayer = playerForSide('attacker');
  const defenderPlayer = playerForSide('defender');
  for (const c of casualties) {
    const pid = c.side === 'attacker' ? attackerPlayer : defenderPlayer;
    if (!pid) continue; // camp neutre (gardien) : aucune attribution
    const player = draft.players.find((p) => p.id === pid);
    if (player) player.unitsLost = (player.unitsLost ?? 0) + c.lost;
  }
}

function applyConsequences(
  draft: Draft,
  combat: CombatState,
  winner: CombatSideId,
  casualties: { side: CombatSideId; unitId: string; lost: number }[],
  events: GameEvent[],
): void {
  if (!combat.heroId) return; // arène : rien à appliquer
  // Combat héros-vs-héros (H-VS-H, doc 02 §1.5/§5) : les DEUX camps portent un
  // héros ⇒ conséquences dédiées (vainqueur reconstruit son armée, vaincu retiré,
  // dépouille d'artefacts transférée). Aucun gardien/ville en jeu.
  if (combat.attackerHeroId && combat.defenderHeroId) {
    applyHeroVsHeroConsequences(draft, combat, winner, casualties, events);
    return;
  }
  const hero = draft.heroes.find((h) => h.id === combat.heroId);
  if (winner === 'attacker') {
    if (hero) {
      // Reconstruit l'armée depuis les survivants — routés vers leur héros
      // PROPRIÉTAIRE (coop E4.2 : lead sans `ownerHeroId` ⇒ `combat.heroId`).
      // Machines de guerre exclues (doc 02 §5) : elles persistent sur
      // `hero.warMachines`, jamais dans l'armée. Un allié sans survivant ⇒ armée
      // vide (il a tout engagé). Hors coop : un seul owner ⇒ bit-identique.
      for (const ownerId of coopAttackerOwners(combat)) {
        const owner = draft.heroes.find((h) => h.id === ownerId);
        if (!owner) continue;
        owner.army = combat.stacks
          .filter(
            (s) =>
              s.side === 'attacker' &&
              s.count > 0 &&
              (s.ownerHeroId ?? combat.heroId) === ownerId &&
              !owner.warMachines.includes(s.unitId),
          )
          .map((s) => ({ unitId: s.unitId, count: s.count }));
      }
      // Effets de faction déclaratifs post-victoire (doc 06 §4) — pour le lead ;
      // après la reconstruction de l'armée, jamais un nom de faction dans le moteur.
      applyFactionVictoryEffects(draft, combat, hero, casualties, 'defender', events);
    }
    if (draft.map && combat.guardianObjectId) {
      // Butin de gardien (doc 02 §2.2) : or/ressource/artefact gradué par la force
      // du gardien — avant le retrait (lit encore `guardian.count`). Puis contrat
      // de chasse (doc 05 §3.3) si ce gardien était la cible assignée.
      // Coop (E4.3) : or/ressource partagés entre les joueurs des héros
      // propriétaires survivants (mêmes participants que le partage d'XP).
      if (hero) rewardGuardianDefeat(draft, hero, combat.guardianObjectId, events, [...coopAttackerOwners(combat)]);
      if (hero) rewardHuntContract(draft, hero, combat.guardianObjectId, events);
      const idx = draft.map.objects.findIndex((o) => o.id === combat.guardianObjectId);
      const gobj = idx !== -1 ? draft.map.objects[idx] : undefined;
      // Respawn opt-in (doc 18 A2b) : mis en file AVANT le retrait — `count`
      // porte encore l'effectif pré-combat (le butin ci-dessus le lit intact).
      if (gobj && gobj.type === 'guardian') queueGuardianRespawn(draft, gobj, gobj.count);
      if (idx !== -1) draft.map.objects.splice(idx, 1);
    }
    // Siège gagné (doc 02 §4.1, Alpha 4.13) : la garnison est anéantie ⇒ la ville
    // change de main, garnison vidée.
    if (combat.townId && hero) {
      const town = draft.towns.find((t) => t.id === combat.townId);
      if (town) {
        town.ownerPlayerId = hero.playerId;
        town.garrison = [];
        // B25 : la préférence de croissance partagée du VAINCU ne doit pas
        // guider la semaine du conquérant (même reset que la capture immédiate,
        // `town/capture.ts` — le repli « 1er membre présent » couvre le vide).
        town.sharedGrowthChoice = {};
        events.push({ type: 'TownCaptured', townId: town.id, playerId: hero.playerId });
        revealStructure(draft, hero.playerId, town.pos); // F1 : ville prise = vision de son voisinage
        // Trigger de capture de drapeau (doc 18 A5) : effet scripté pour le vainqueur.
        const capturer = draft.players.find((p) => p.id === hero.playerId);
        if (capturer) fireFlagCaptureTrigger(draft, town.id, capturer, hero, events);
      }
    }
  } else {
    if (hero) {
      const idx = draft.heroes.findIndex((h) => h.id === combat.heroId);
      if (idx !== -1) draft.heroes.splice(idx, 1);
    }
    // Coop (E4.2) : le lead meurt (ci-dessus) ; un allié invité SURVIT mais perd
    // l'armée engagée — déjà vidée à l'engagement (`beginGuardianCombat`).
    persistDefenderRemnants(draft, combat);
  }
}

/**
 * Ensemble des héros PROPRIÉTAIRES de piles VIVANTES du camp attaquant (coop
 * E4.2) : le lead (`combat.heroId`) plus tout allié dont une pile a survécu.
 * Hors coop ⇒ juste le lead (comportement historique). L'armée d'un allié est
 * vidée à l'engagement (engagée dans le combat) ⇒ un allié entièrement anéanti
 * termine avec une armée vide sans traitement dédié.
 */
function coopAttackerOwners(combat: CombatState): Set<string> {
  const owners = new Set<string>();
  if (combat.heroId) owners.add(combat.heroId);
  for (const s of combat.stacks) {
    if (s.side === 'attacker' && s.count > 0 && s.ownerHeroId) owners.add(s.ownerHeroId);
  }
  return owners;
}

/**
 * Réécrit sur la carte les vestiges du camp DÉFENSEUR d'un combat qu'il n'a pas
 * perdu — le gardien et la garnison gardent leurs pertes :
 *  - gardien ramené à ses survivants ; réduit à 0 il est RETIRÉ (B17,
 *    anéantissement mutuel au tick de poison : un combat contre ce fantôme
 *    serait insoluble, aucune pile à tuer de part et d'autre) ;
 *  - garnison réécrite `count > 0` SAUF la tour de tir injectée par le siège
 *    (B8 : `warMachine` n'est pas une créature de garnison ; sans ce filtre elle
 *    s'accumulait dans les slots, transférable au héros et dupliquée à chaque
 *    siège repoussé).
 * Partagé entre la défaite normale (`applyConsequences` ci-dessus) et le départ
 * volontaire du joueur (`endLeftCombat`, leave.ts — B21 : fuir/se rendre/
 * abandonner ne « soigne » pas le camp adverse à son effectif initial).
 */
export function persistDefenderRemnants(draft: Draft, combat: CombatState): void {
  if (draft.map && combat.guardianObjectId) {
    const idx = draft.map.objects.findIndex((o) => o.id === combat.guardianObjectId);
    const obj = idx !== -1 ? draft.map.objects[idx] : undefined;
    if (obj && obj.type === 'guardian') {
      // Respawn opt-in (doc 18 A2b) : le count pré-combat est capturé AVANT
      // l'écrasement — l'anéantissement mutuel (B17) ne doit pas queuer un 0.
      const preCombatCount = obj.count;
      obj.count = combat.stacks
        .filter((s) => s.side === 'defender' && s.count > 0)
        .reduce((sum, s) => sum + s.count, 0);
      if (obj.count <= 0) {
        queueGuardianRespawn(draft, obj, preCombatCount);
        draft.map.objects.splice(idx, 1);
      }
    }
  }
  if (combat.townId) {
    const town = draft.towns.find((t) => t.id === combat.townId);
    if (town) {
      town.garrison = combat.stacks
        .filter((s) => {
          const def = draft.unitCatalog[s.unitId];
          return s.side === 'defender' && s.count > 0 && !(def && hasAbility(def, 'warMachine'));
        })
        .map((s) => ({ unitId: s.unitId, count: s.count }));
    }
  }
}
