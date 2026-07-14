import { beginGuardianCombat, beginHeroCombat } from '../combat/setup';
import type { GameEvent } from '../core/events';
import { areAllies, type GameState, type HeroState, type PlayerState, type ResourceId } from '../core/state';
import { heroVisionRadius } from '../hero/skills';
import { learnGuildSpellsAtTown } from '../town/mage-guild';
import { revealAround } from './fog';
import { revealStructure } from './vision';
import { samePos, type GridPos } from './map';
import { stepCost } from './path';
import { fireVisitTrigger } from './triggers';
import { recruitDwelling, visitBonus } from './visitable';

export interface AdvanceOptions {
  /**
   * Appelé après l'ouverture d'un combat d'interception (gardien OU héros ennemi,
   * H-VS-H). Le handler humain (`MoveHero`) le laisse indéfini : le combat reste
   * interactif (l'état conserve `draft.combat`). L'IA d'aventure y résout le
   * combat immédiatement (`runAutoCombat`) — déterministe.
   */
  onCombatEngaged?: () => void;
  /**
   * Appelé quand un trésor vient d'être foulé (`pendingTreasure` posé). Le
   * handler humain le laisse indéfini : le choix or/XP reste interactif. L'IA
   * d'aventure y résout le choix immédiatement (déterministe).
   */
  onTreasureFound?: () => void;
}

/**
 * Avance `hero` le long de `path`, pas à pas — logique unique partagée par le
 * handler `MoveHero` (joueur humain) et l'IA d'aventure (`runAiTurn`) :
 * décompte des PM (arrêt quand les points du jour ne suffisent plus,
 * doc 02 §1.5), interception de gardien (le héros paie le pas d'engagement
 * mais n'entre pas sur la tuile, décision plan phase-2.4), ramassage en
 * passant de ressource/artefact (le héros ne s'arrête pas — fidélité HoMM,
 * D6 ; seul un trésor à choix or/XP interrompt), révélation du brouillard.
 *
 * Seule divergence humain/IA : la résolution du combat de gardien, injectée
 * via `options.onCombatEngaged` (cf. `AdvanceOptions`).
 */
export function advanceHeroAlongPath(
  draft: GameState,
  hero: HeroState,
  player: PlayerState,
  path: readonly GridPos[],
  events: GameEvent[],
  options: AdvanceOptions = {},
): void {
  const map = draft.map;
  const config = draft.config;
  if (!map || !config) return;
  for (const step of path) {
    const cost = stepCost(config, map, hero.pos, step);
    if (cost > hero.movementPoints) break;
    const guardian = map.objects.find((o) => o.type === 'guardian' && samePos(o.pos, step));
    if (guardian) {
      hero.movementPoints -= cost;
      beginGuardianCombat(draft, hero.id, guardian.id, events);
      options.onCombatEngaged?.();
      return;
    }
    // Héros ENNEMI sur la tuile (H-VS-H, doc 02 §1.5/§5) : combat d'interception —
    // le héros paie le pas d'engagement mais n'entre pas sur la tuile (comme un
    // gardien). Allié/soi ne sont jamais sur le chemin (bloqués par `validatePath`).
    const enemyHero = draft.heroes.find((h) => {
      if (h.id === hero.id || !samePos(h.pos, step)) return false;
      const occPlayer = draft.players.find((p) => p.id === h.playerId);
      return h.playerId !== player.id && !(occPlayer && areAllies(player, occPlayer));
    });
    if (enemyHero) {
      hero.movementPoints -= cost;
      beginHeroCombat(draft, hero.id, enemyHero.id, events);
      options.onCombatEngaged?.();
      return;
    }
    const from = { ...hero.pos };
    hero.movementPoints -= cost;
    hero.pos = { ...step };
    revealAround(
      player.explored,
      map,
      hero.pos,
      heroVisionRadius(hero, config.visionRadius, draft.skillCatalog, draft.artifactCatalog),
    );
    events.push({
      type: 'MoveStepped',
      heroId: hero.id,
      from,
      to: { ...step },
      movementPointsLeft: hero.movementPoints,
    });
    // Monolithe apparié (M-NAV a, doc 02 §2.1) : fouler l'un téléporte vers son
    // jumeau et INTERROMPT le déplacement (le reste du chemin part de l'entrée,
    // devenu invalide). Le héros arrive sur la tuile de sortie sans re-téléporter
    // (il n'y « entre » pas au sens d'un pas) — pas de boucle.
    const monolith = map.objects.find((o) => o.type === 'monolith' && samePos(o.pos, hero.pos));
    if (monolith && monolith.type === 'monolith') {
      const exit = map.objects.find(
        (o) => o.type === 'monolith' && o.pairId === monolith.pairId && o.id !== monolith.id,
      );
      if (exit) {
        // B9 (revue 2026-07) : la tuile de sortie peut être OCCUPÉE — jamais
        // deux héros superposés (invariant « un héros par tuile » : occupant =
        // premier `find`, ciblage H-VS-H, rendu). Ennemi ⇒ combat
        // d'interception à travers le monolithe (comme un pas normal) ;
        // allié/soi ⇒ passage bloqué, le déplacement s'arrête sur l'entrée.
        const occupant = draft.heroes.find((h) => h.id !== hero.id && samePos(h.pos, exit.pos));
        if (occupant) {
          const occPlayer = draft.players.find((p) => p.id === occupant.playerId);
          const hostile =
            occupant.playerId !== player.id && !(occPlayer && areAllies(player, occPlayer));
          if (hostile) {
            beginHeroCombat(draft, hero.id, occupant.id, events);
            options.onCombatEngaged?.();
            return;
          }
          break;
        }
        const fromPos = { ...hero.pos };
        hero.pos = { ...exit.pos };
        revealAround(
          player.explored,
          map,
          hero.pos,
          heroVisionRadius(hero, config.visionRadius, draft.skillCatalog, draft.artifactCatalog),
        );
        events.push({ type: 'HeroTeleported', heroId: hero.id, from: fromPos, to: { ...exit.pos } });
        break;
      }
    }
    // Trigger de visite (doc 02 §2.1) — la tuile foulée peut porter un effet.
    fireVisitTrigger(draft, player, hero.pos, events);
    // Guilde des mages (G2) : fouler une de ses villes fait apprendre les sorts
    // du pool que le héros peut apprendre (cercle ≤ Sagesse).
    for (const town of draft.towns) {
      if (town.ownerPlayerId === player.id && samePos(town.pos, hero.pos))
        learnGuildSpellsAtTown(draft, hero, town, events);
    }
    // Lieu de bonus / habitation (doc 02 §2.2) : visite en passant, comme la mine.
    for (const obj of map.objects) {
      if (!samePos(obj.pos, hero.pos)) continue;
      if (obj.type === 'visitable') visitBonus(draft, hero, player, obj, events);
      else if (obj.type === 'dwelling') {
        // Habitation de carte capturable (M-DWELLOWN, doc 02 §2.2) : la fouler la
        // fait passer au joueur (drapeau + vision), qui touchera son réassort hebdo
        // (`applyWeeklyGrowth`). Recapturable par un adversaire — comme une mine.
        if (obj.ownerId !== player.id) {
          obj.ownerId = player.id;
          revealStructure(draft, player.id, obj.pos);
        }
        recruitDwelling(draft, hero, player, obj, events);
      }
    }
    // Mine (doc 02 §2.2) : capture en passant — le héros ne s'arrête pas, et
    // une mine adverse est recapturée par le même geste.
    const mine = map.objects.find((o) => o.type === 'mine' && samePos(o.pos, hero.pos));
    if (mine && mine.type === 'mine' && mine.ownerId !== player.id) {
      mine.ownerId = player.id;
      revealStructure(draft, player.id, mine.pos); // F1 : mine capturée = vision de son voisinage
      events.push({
        type: 'MineCaptured',
        playerId: player.id,
        objectId: mine.id,
        resource: mine.resource,
        amount: mine.amount,
        pos: { ...hero.pos },
      });
    }
    const objIndex = map.objects.findIndex(
      (o) =>
        (o.type === 'resource' || o.type === 'treasure' || o.type === 'artifact') &&
        samePos(o.pos, hero.pos),
    );
    if (objIndex !== -1) {
      const obj = map.objects[objIndex];
      // M-GUARDLINK (doc 02 §2.2) : un objet gardé reste inerte tant que sa
      // sentinelle existe — impossible de contourner le gardien pour rafler le
      // butin. La sentinelle défaite est retirée de `map.objects` ⇒ objet libéré.
      const guarded =
        obj &&
        'guardedBy' in obj &&
        obj.guardedBy !== undefined &&
        map.objects.some((g) => g.id === obj.guardedBy);
      if (guarded) continue;
      if (obj && obj.type === 'resource') {
        player.resources[obj.resource as ResourceId] += obj.amount;
        map.objects.splice(objIndex, 1);
        events.push({
          type: 'ResourcePicked',
          heroId: hero.id,
          playerId: player.id,
          objectId: obj.id,
          resource: obj.resource,
          amount: obj.amount,
          pos: { ...hero.pos },
        });
        // Ramassage en passant (doc 02 §2.2, fidélité HoMM, D6) : le héros ne
        // s'arrête pas — comme la mine, il poursuit son chemin.
        continue;
      }
      // Trésor (doc 02 §2.2) : arrêt et choix or/XP en attente — l'objet n'est
      // retiré qu'à la résolution (`ResolveTreasure`).
      if (obj && obj.type === 'treasure') {
        draft.pendingTreasure = {
          heroId: hero.id,
          playerId: player.id,
          objectId: obj.id,
          gold: obj.gold,
          xp: obj.xp,
        };
        events.push({
          type: 'TreasureFound',
          heroId: hero.id,
          playerId: player.id,
          objectId: obj.id,
          gold: obj.gold,
          xp: obj.xp,
          pos: { ...hero.pos },
        });
        options.onTreasureFound?.();
        break;
      }
      // Artefact au sol (doc 02 §2.2) : ramassé vers le 1er slot équipé libre ;
      // s'il n'y en a aucun, il tombe dans le SAC (H-ARTEQUIP — plus rien de
      // perdu au sol). Ramassé en passant (D6) : le héros ne s'arrête pas.
      if (obj && obj.type === 'artifact') {
        const slot = hero.artifacts.indexOf(null);
        if (slot !== -1) hero.artifacts[slot] = obj.artifactId;
        else (hero.backpack ??= []).push(obj.artifactId);
        map.objects.splice(objIndex, 1);
        events.push({
          type: 'ArtifactPicked',
          heroId: hero.id,
          playerId: player.id,
          objectId: obj.id,
          artifactId: obj.artifactId,
          pos: { ...hero.pos },
        });
      }
    }
  }
}
